/**
 * Biblioteca IA — ingesta de materiales desde Moodle y búsqueda.
 *
 *  registerModuleDocuments()  → durante la sincronización, registra cada archivo/página de un módulo
 *  indexPendingDocuments()    → descarga, extrae texto, fragmenta y guarda (se llama al final de cada sync)
 *  searchChunks()             → búsqueda de texto completo (PostgreSQL, diccionario español)
 */
import { randomUUID } from "crypto";
import { prisma } from "@/lib/prisma";
import { moodleDownload, type MoodleModule } from "@/lib/moodle";

const MAX_FILE_BYTES = 20 * 1024 * 1024;   // 20 MB
const MAX_TEXT_CHARS = 200_000;
const CHUNK_SIZE = 1200;
const CHUNK_OVERLAP = 150;

export const SUPPORTED_EXT = new Set(["pdf", "docx", "txt", "md", "html", "htm", "csv"]);
export const MAX_TEXT = 200_000;

function stripHtml(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/(p|div|li|h[1-6]|tr)>/gi, "\n")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/[ \t]+/g, " ")
    .replace(/\n\s*\n+/g, "\n\n")
    .trim();
}

function extOf(name: string): string {
  return (name.split(".").pop() || "").toLowerCase();
}

function docTypeFor(modname: string, filename?: string): string {
  if (modname === "page") return "page";
  if (modname === "book") return "book";
  const e = filename ? extOf(filename) : "";
  if (e === "pdf") return "pdf";
  if (e === "docx") return "docx";
  return "texto";
}

// ---------------------------------------------------------------------------
// Registro (en la sincronización)
// ---------------------------------------------------------------------------

/**
 * Registra los documentos de un módulo de Moodle. Devuelve la cantidad registrada.
 * Los archivos no soportados se guardan con status "unsupported" para que aparezcan
 * en la Biblioteca con enlace a Moodle (aunque no se puedan buscar).
 */
export async function registerModuleDocuments(courseId: string, m: MoodleModule, moodleBase: string): Promise<number> {
  const contents = m.contents || [];
  let count = 0;

  // Páginas y libros: su contenido HTML viene embebido, no hace falta descargar
  if (m.modname === "page" || m.modname === "book") {
    const html = contents.filter((c) => c.type === "file" && (c.filename.endsWith(".html") || c.filename.endsWith(".htm")));
    const text = stripHtml(html.map((c) => c.content || "").join("\n\n"));
    const key = { moodleModuleId: m.id, moodleFileName: `__${m.modname}__` };
    const tm = contents[0]?.timemodified ? new Date(contents[0].timemodified * 1000) : null;
    if (text.length > 0) {
      const existing = await prisma.libraryDocument.findUnique({ where: { moodleModuleId_moodleFileName: key } });
      const unchanged = existing && existing.status === "indexed" && existing.timeModified?.getTime() === tm?.getTime();
      if (!unchanged) {
        const doc = await prisma.libraryDocument.upsert({
          where: { moodleModuleId_moodleFileName: key },
          update: { title: m.name, courseId, type: m.modname, content: text.slice(0, MAX_TEXT_CHARS), moodleUrl: m.url || null, timeModified: tm, status: "indexed", indexedAt: new Date(), error: null },
          create: { ...key, title: m.name, courseId, type: m.modname, content: text.slice(0, MAX_TEXT_CHARS), tags: [], moodleUrl: m.url || null, timeModified: tm, status: "indexed", indexedAt: new Date() }
        });
        await replaceChunks(doc.id, text);
      }
      count++;
    }
    return count;
  }

  // Recursos con archivos (resource, folder) — también los adjuntos de tareas/foros si vienen
  for (const c of contents) {
    if (c.type !== "file" || !c.fileurl) continue;
    // Moodle también lista archivos embebidos en la descripción; nos quedamos con los principales
    if (c.filepath && c.filepath !== "/" && m.modname !== "folder") continue;
    const ext = extOf(c.filename);
    const supported = SUPPORTED_EXT.has(ext) && (c.filesize || 0) <= MAX_FILE_BYTES;
    const tm = c.timemodified ? new Date(c.timemodified * 1000) : null;
    const key = { moodleModuleId: m.id, moodleFileName: c.filename };

    const existing = await prisma.libraryDocument.findUnique({ where: { moodleModuleId_moodleFileName: key } });
    const unchanged = existing && existing.status !== "error" && existing.timeModified?.getTime() === tm?.getTime();
    const title = contents.length > 1 ? `${m.name} — ${c.filename}` : m.name;
    const base = {
      title, courseId, type: docTypeFor(m.modname, c.filename),
      moodleFileUrl: c.fileurl, moodleUrl: m.url || null, mimeType: c.mimetype || null,
      fileSize: c.filesize || null, timeModified: tm
    };
    if (unchanged) {
      await prisma.libraryDocument.update({ where: { id: existing.id }, data: { title, courseId, moodleUrl: m.url || null } });
    } else {
      await prisma.libraryDocument.upsert({
        where: { moodleModuleId_moodleFileName: key },
        update: { ...base, status: supported ? "pending" : "unsupported", error: supported ? null : `Formato no soportado o archivo demasiado grande (.${ext})` },
        create: { ...key, ...base, content: "", tags: [], status: supported ? "pending" : "unsupported", error: supported ? null : `Formato no soportado o archivo demasiado grande (.${ext})` }
      });
    }
    count++;
  }
  return count;
}

/** Elimina los documentos de módulos que ya no existen en el curso. */
export async function pruneCourseDocuments(courseId: string, keepModuleIds: number[]) {
  await prisma.libraryDocument.deleteMany({ where: { courseId, moodleModuleId: { not: null, notIn: keepModuleIds } } });
}

// ---------------------------------------------------------------------------
// Extracción e indexado
// ---------------------------------------------------------------------------

export const MIN_PDF_TEXT_CHARS = 40; // por debajo de esto, se asume PDF escaneado y se intenta OCR

export async function extractText(buffer: Buffer, filename: string, mime?: string | null): Promise<{ text: string; ocr?: { pagesProcessed: number; truncated: boolean } }> {
  const ext = extOf(filename);
  if (ext === "pdf" || mime === "application/pdf") {
    const { extractText: pdfExtract, getDocumentProxy } = await import("unpdf");
    const pdf = await getDocumentProxy(new Uint8Array(buffer));
    const r = await pdfExtract(pdf, { mergePages: true });
    const text = String(r.text || "").trim();
    if (text.length >= MIN_PDF_TEXT_CHARS) return { text };

    // Probablemente un PDF escaneado (sin capa de texto o casi vacía): OCR en español
    const { ocrPdfBuffer } = await import("@/lib/ocr");
    const ocr = await ocrPdfBuffer(buffer);
    return { text: ocr.text, ocr: { pagesProcessed: ocr.pagesProcessed, truncated: ocr.truncated } };
  }
  if (ext === "docx") {
    const mammoth = await import("mammoth");
    const r = await mammoth.extractRawText({ buffer });
    return { text: r.value || "" };
  }
  if (ext === "html" || ext === "htm") return { text: stripHtml(buffer.toString("utf8")) };
  return { text: buffer.toString("utf8") };
}

export function chunkText(text: string): string[] {
  const clean = text.replace(/\r/g, "").replace(/[ \t]+/g, " ").replace(/\n{3,}/g, "\n\n").trim();
  if (!clean) return [];
  const paras = clean.split(/\n\n+/);
  const chunks: string[] = [];
  let buf = "";
  for (const p of paras) {
    if ((buf + "\n\n" + p).length > CHUNK_SIZE && buf) {
      chunks.push(buf.trim());
      buf = buf.slice(-CHUNK_OVERLAP) + "\n\n" + p;
    } else {
      buf = buf ? buf + "\n\n" + p : p;
    }
    // Párrafos enormes: partir por tamaño
    while (buf.length > CHUNK_SIZE * 1.5) {
      chunks.push(buf.slice(0, CHUNK_SIZE).trim());
      buf = buf.slice(CHUNK_SIZE - CHUNK_OVERLAP);
    }
  }
  if (buf.trim()) chunks.push(buf.trim());
  return chunks.filter((c) => c.length > 40);
}

export async function replaceChunks(documentId: string, text: string) {
  const chunks = chunkText(text);
  await prisma.libraryChunk.deleteMany({ where: { documentId } });
  if (chunks.length) {
    // Generamos los ids nosotros mismos para poder escribir el embedding (columna
    // pgvector, no soportada por el cliente de Prisma) en una segunda pasada por id.
    const rows = chunks.map((t, i) => ({ id: randomUUID(), documentId, order: i, text: t }));
    await prisma.libraryChunk.createMany({ data: rows });
    await embedChunks(rows).catch((e) => console.warn("Búsqueda semántica: no se pudieron generar embeddings:", e.message));
  }
  return chunks.length;
}

/** Genera y guarda los embeddings de un lote de fragmentos recién creados (si Voyage está configurado). */
async function embedChunks(rows: { id: string; text: string }[]) {
  const { voyageConfigured, embedDocuments, toVectorLiteral } = await import("@/lib/voyage");
  if (!voyageConfigured() || rows.length === 0) return;
  await ensureVectorExtension();
  const vectors = await embedDocuments(rows.map((r) => r.text));
  for (let i = 0; i < rows.length; i++) {
    await prisma.$executeRawUnsafe(
      `UPDATE "LibraryChunk" SET embedding = $1::vector WHERE id = $2`,
      toVectorLiteral(vectors[i]),
      rows[i].id
    );
  }
}

/**
 * Genera embeddings para fragmentos ya existentes que aún no lo tienen (por
 * ejemplo, indexados antes de activar Voyage AI, o si una corrida anterior
 * falló a mitad de camino). Se llama automáticamente tras cada indexado.
 */
export async function backfillEmbeddings(maxChunks = 200): Promise<{ embedded: number }> {
  const { voyageConfigured } = await import("@/lib/voyage");
  if (!voyageConfigured()) return { embedded: 0 };
  await ensureVectorExtension();

  const pending = await prisma.$queryRawUnsafe<{ id: string; text: string }[]>(
    `SELECT id, text FROM "LibraryChunk" WHERE embedding IS NULL LIMIT $1`,
    maxChunks
  );
  if (pending.length === 0) return { embedded: 0 };
  await embedChunks(pending);
  return { embedded: pending.length };
}

/** Procesa hasta `limit` documentos pendientes. Devuelve { indexed, failed }. */
export async function indexPendingDocuments(limit = 10): Promise<{ indexed: number; failed: number; errors: string[] }> {
  const pending = await prisma.libraryDocument.findMany({ where: { status: "pending", moodleFileUrl: { not: null } }, take: limit, orderBy: { createdAt: "asc" } });
  let indexed = 0, failed = 0;
  const errors: string[] = [];
  for (const d of pending) {
    try {
      const { buffer } = await moodleDownload(d.moodleFileUrl!);
      const { text: raw, ocr } = await extractText(buffer, d.moodleFileName || d.title, d.mimeType);
      const text = raw.trim();
      if (!text) throw new Error("El archivo no contiene texto extraíble, incluso tras aplicar reconocimiento óptico (OCR).");
      const n = await replaceChunks(d.id, text);
      const ocrNote = ocr ? ` (texto reconocido por OCR, ${ocr.pagesProcessed} página(s)${ocr.truncated ? " — documento largo, solo se procesaron las primeras páginas" : ""})` : "";
      await prisma.libraryDocument.update({ where: { id: d.id }, data: { content: text.slice(0, MAX_TEXT_CHARS), status: "indexed", indexedAt: new Date(), error: ocrNote ? ocrNote.trim() : null } });
      indexed++;
      if (n === 0) errors.push(`${d.title}: sin fragmentos útiles`);
    } catch (e: any) {
      failed++;
      console.error(`Biblioteca IA: error al indexar "${d.title}" (${d.moodleFileName}):`, e);
      errors.push(`${d.title}: ${e.message}`);
      await prisma.libraryDocument.update({ where: { id: d.id }, data: { status: "error", error: String(e.message).slice(0, 500) } });
    }
  }
  const { terminateOcrWorker } = await import("@/lib/ocr");
  await terminateOcrWorker();
  try {
    const { embedded } = await backfillEmbeddings(200);
    if (embedded > 0) console.log(`Búsqueda semántica: ${embedded} fragmento(s) existentes recibieron embedding.`);
  } catch (e: any) {
    console.warn("Relleno de embeddings falló:", e.message);
  }

  return { indexed, failed, errors };
}

// ---------------------------------------------------------------------------
// Búsqueda
// ---------------------------------------------------------------------------

/** Fusiona dos listas de resultados ya ordenadas mediante Reciprocal Rank Fusion (RRF). */
function fuseRankedResults(a: ChunkHit[], b: ChunkHit[], limit: number): ChunkHit[] {
  const K = 60;
  const scores = new Map<string, { hit: ChunkHit; score: number }>();
  const add = (list: ChunkHit[]) => {
    list.forEach((hit, i) => {
      const prev = scores.get(hit.chunkId);
      const inc = 1 / (K + i + 1);
      if (prev) prev.score += inc;
      else scores.set(hit.chunkId, { hit, score: inc });
    });
  };
  add(a);
  add(b);
  return [...scores.values()]
    .sort((x, y) => y.score - x.score)
    .slice(0, limit)
    .map(({ hit, score }) => ({ ...hit, rank: score }));
}

export interface ChunkHit {
  chunkId: string;
  documentId: string;
  title: string;
  type: string;
  courseId: string | null;
  courseName: string | null;
  moodleUrl: string | null;
  order: number;
  text: string;
  rank: number;
}

let indexEnsured = false;
async function ensureSearchIndex() {
  if (indexEnsured) return;
  try {
    await prisma.$executeRawUnsafe(
      `CREATE INDEX IF NOT EXISTS "LibraryChunk_fts_idx" ON "LibraryChunk" USING GIN (to_tsvector('spanish', "text"))`
    );
  } catch (e) {
    console.warn("No se pudo crear el índice de búsqueda:", e);
  }
  indexEnsured = true;
}

let vectorEnsured = false;
/** Activa la extensión pgvector y crea el índice HNSW (una sola vez por arranque del servidor). */
async function ensureVectorExtension() {
  if (vectorEnsured) return;
  try {
    await prisma.$executeRawUnsafe(`CREATE EXTENSION IF NOT EXISTS vector`);
    await prisma.$executeRawUnsafe(
      `CREATE INDEX IF NOT EXISTS "LibraryChunk_embedding_idx" ON "LibraryChunk" USING hnsw (embedding vector_cosine_ops)`
    );
  } catch (e) {
    console.warn("No se pudo activar pgvector / crear el índice vectorial (la búsqueda semántica quedará deshabilitada):", e);
  }
  vectorEnsured = true;
}

/**
 * Busca fragmentos relevantes. `courseIds` limita a los cursos del usuario
 * (los documentos institucionales sin curso siempre se incluyen).
 */
/**
 * Búsqueda híbrida: combina texto completo (PostgreSQL) y búsqueda semántica
 * (embeddings de Voyage AI, si está configurada) mediante fusión de rangos
 * recíprocos (RRF). Si Voyage no está configurado, se usa solo texto completo.
 */
export async function searchChunks(query: string, courseIds: string[] | null, limit = 8): Promise<ChunkHit[]> {
  const q = query.trim().slice(0, 300);
  if (!q) return [];
  await ensureSearchIndex();

  const candidateLimit = Math.max(15, limit * 2);
  const courseFilter = courseIds ? `AND (d."courseId" IS NULL OR d."courseId" = ANY($2::text[]))` : "";
  const params: any[] = courseIds ? [q, courseIds] : [q];

  const textSql = `
    SELECT c.id AS "chunkId", c."documentId", d.title, d.type, d."courseId", co.name AS "courseName", d."moodleUrl", c."order", c.text,
           ts_rank_cd(to_tsvector('spanish', c.text), websearch_to_tsquery('spanish', $1)) AS rank
    FROM "LibraryChunk" c
    JOIN "LibraryDocument" d ON d.id = c."documentId"
    LEFT JOIN "Course" co ON co.id = d."courseId"
    WHERE to_tsvector('spanish', c.text) @@ websearch_to_tsquery('spanish', $1)
    ${courseFilter}
    ORDER BY rank DESC
    LIMIT ${candidateLimit}`;

  let textHits: ChunkHit[] = [];
  try {
    textHits = (await prisma.$queryRawUnsafe(textSql, ...params)) as ChunkHit[];
  } catch (e) {
    console.warn("Búsqueda de texto completo falló:", e);
  }

  let semanticHits: ChunkHit[] = [];
  const { voyageConfigured, embedQuery, toVectorLiteral } = await import("@/lib/voyage");
  if (voyageConfigured()) {
    try {
      await ensureVectorExtension();
      const vector = toVectorLiteral(await embedQuery(q));
      const vecFilter = courseIds ? `AND (d."courseId" IS NULL OR d."courseId" = ANY($3::text[]))` : "";
      const vecParams: any[] = courseIds ? [vector, vector, courseIds] : [vector, vector];
      const semanticSql = `
        SELECT c.id AS "chunkId", c."documentId", d.title, d.type, d."courseId", co.name AS "courseName", d."moodleUrl", c."order", c.text,
               1 - (c.embedding <=> $1::vector) AS rank
        FROM "LibraryChunk" c
        JOIN "LibraryDocument" d ON d.id = c."documentId"
        LEFT JOIN "Course" co ON co.id = d."courseId"
        WHERE c.embedding IS NOT NULL
        ${vecFilter}
        ORDER BY c.embedding <=> $2::vector ASC
        LIMIT ${candidateLimit}`;
      semanticHits = (await prisma.$queryRawUnsafe(semanticSql, ...vecParams)) as ChunkHit[];
    } catch (e: any) {
      console.warn("Búsqueda semántica falló, se usa solo texto completo:", e.message);
    }
  }

  if (textHits.length > 0 || semanticHits.length > 0) {
    return fuseRankedResults(textHits, semanticHits, limit);
  }

  // Respaldo: coincidencia simple por términos (sin índice de texto completo disponible)
  const terms = q.split(/\s+/).filter((t) => t.length > 2).slice(0, 5);
  if (!terms.length) return [];
  const chunks = await prisma.libraryChunk.findMany({
    where: {
      AND: [
        { OR: terms.map((t) => ({ text: { contains: t, mode: "insensitive" as const } })) },
        courseIds ? { document: { OR: [{ courseId: null }, { courseId: { in: courseIds } }] } } : {}
      ]
    },
    include: { document: { include: { course: { select: { name: true } } } } },
    take: limit
  });
  return chunks.map((c) => ({
    chunkId: c.id, documentId: c.documentId, title: c.document.title, type: c.document.type,
    courseId: c.document.courseId, courseName: c.document.course?.name || null, moodleUrl: c.document.moodleUrl,
    order: c.order, text: c.text, rank: 0
  }));
}

/** Bloque de texto con los materiales relevantes, listo para el prompt del Tutor IA. */
export function materialsContextText(hits: ChunkHit[]): string {
  if (!hits.length) return "";
  return hits
    .map((h, i) => `[Material ${i + 1}] "${h.title}"${h.courseName ? ` (${h.courseName})` : ""}, fragmento ${h.order + 1}:\n${h.text.slice(0, 900)}`)
    .join("\n\n");
}
