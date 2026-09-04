/**
 * Biblioteca IA — ingesta de materiales desde Moodle y búsqueda.
 *
 *  registerModuleDocuments()  → durante la sincronización, registra cada archivo/página de un módulo
 *  indexPendingDocuments()    → descarga, extrae texto, fragmenta y guarda (se llama al final de cada sync)
 *  searchChunks()             → búsqueda de texto completo (PostgreSQL, diccionario español)
 */
import { prisma } from "@/lib/prisma";
import { moodleDownload, type MoodleModule } from "@/lib/moodle";

const MAX_FILE_BYTES = 20 * 1024 * 1024;   // 20 MB
const MAX_TEXT_CHARS = 200_000;
const CHUNK_SIZE = 1200;
const CHUNK_OVERLAP = 150;

const SUPPORTED_EXT = new Set(["pdf", "docx", "txt", "md", "html", "htm", "csv"]);

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

async function extractText(buffer: Buffer, filename: string, mime?: string | null): Promise<string> {
  const ext = extOf(filename);
  if (ext === "pdf" || mime === "application/pdf") {
    const { extractText: pdfExtract, getDocumentProxy } = await import("unpdf");
    const pdf = await getDocumentProxy(new Uint8Array(buffer));
    const r = await pdfExtract(pdf, { mergePages: true });
    return String(r.text || "");
  }
  if (ext === "docx") {
    const mammoth = await import("mammoth");
    const r = await mammoth.extractRawText({ buffer });
    return r.value || "";
  }
  if (ext === "html" || ext === "htm") return stripHtml(buffer.toString("utf8"));
  return buffer.toString("utf8");
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

async function replaceChunks(documentId: string, text: string) {
  const chunks = chunkText(text);
  await prisma.libraryChunk.deleteMany({ where: { documentId } });
  if (chunks.length) {
    await prisma.libraryChunk.createMany({ data: chunks.map((t, i) => ({ documentId, order: i, text: t })) });
  }
  return chunks.length;
}

/** Procesa hasta `limit` documentos pendientes. Devuelve { indexed, failed }. */
export async function indexPendingDocuments(limit = 10): Promise<{ indexed: number; failed: number; errors: string[] }> {
  const pending = await prisma.libraryDocument.findMany({ where: { status: "pending", moodleFileUrl: { not: null } }, take: limit, orderBy: { createdAt: "asc" } });
  let indexed = 0, failed = 0;
  const errors: string[] = [];
  for (const d of pending) {
    try {
      const { buffer } = await moodleDownload(d.moodleFileUrl!);
      const text = (await extractText(buffer, d.moodleFileName || d.title, d.mimeType)).trim();
      if (!text) throw new Error("El archivo no contiene texto extraíble (¿es un PDF escaneado?)");
      const n = await replaceChunks(d.id, text);
      await prisma.libraryDocument.update({ where: { id: d.id }, data: { content: text.slice(0, MAX_TEXT_CHARS), status: "indexed", indexedAt: new Date(), error: null } });
      indexed++;
      if (n === 0) errors.push(`${d.title}: sin fragmentos útiles`);
    } catch (e: any) {
      failed++;
      errors.push(`${d.title}: ${e.message}`);
      await prisma.libraryDocument.update({ where: { id: d.id }, data: { status: "error", error: String(e.message).slice(0, 500) } });
    }
  }
  return { indexed, failed, errors };
}

// ---------------------------------------------------------------------------
// Búsqueda
// ---------------------------------------------------------------------------

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

/**
 * Busca fragmentos relevantes. `courseIds` limita a los cursos del usuario
 * (los documentos institucionales sin curso siempre se incluyen).
 */
export async function searchChunks(query: string, courseIds: string[] | null, limit = 8): Promise<ChunkHit[]> {
  const q = query.trim().slice(0, 300);
  if (!q) return [];
  await ensureSearchIndex();

  const courseFilter = courseIds
    ? `AND (d."courseId" IS NULL OR d."courseId" = ANY($2::text[]))`
    : "";
  const params: any[] = courseIds ? [q, courseIds] : [q];

  const sql = `
    SELECT c.id AS "chunkId", c."documentId", d.title, d.type, d."courseId", co.name AS "courseName", d."moodleUrl", c."order", c.text,
           ts_rank_cd(to_tsvector('spanish', c.text), websearch_to_tsquery('spanish', $1)) AS rank
    FROM "LibraryChunk" c
    JOIN "LibraryDocument" d ON d.id = c."documentId"
    LEFT JOIN "Course" co ON co.id = d."courseId"
    WHERE to_tsvector('spanish', c.text) @@ websearch_to_tsquery('spanish', $1)
    ${courseFilter}
    ORDER BY rank DESC
    LIMIT ${Math.max(1, Math.min(limit, 20))}`;

  let rows: ChunkHit[] = [];
  try {
    rows = (await prisma.$queryRawUnsafe(sql, ...params)) as ChunkHit[];
  } catch (e) {
    console.warn("Búsqueda de texto completo falló, usando búsqueda simple:", e);
  }
  if (rows.length > 0) return rows.map((r) => ({ ...r, rank: Number(r.rank) }));

  // Respaldo: coincidencia simple por términos
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
