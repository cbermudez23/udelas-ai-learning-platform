/**
 * UDELAS Knowledge Base — ingesta desde el sitio web institucional.
 *
 * scrapeUdelasWebsite() descarga un conjunto fijo de páginas de
 * www.udelas.ac.pa, extrae el texto principal (sin menús ni HTML), lo
 * fragmenta y genera embeddings con Ollama (nomic-embed-text) para guardarlos
 * en la tabla knowledge_chunks (pgvector). Esta tabla es la base de
 * conocimiento institucional que el Tutor IA / Asesor puede consultar.
 */
import { prisma } from "@/lib/prisma";

const SITE_BASE_URL = "https://www.udelas.ac.pa";

// Instancia de Ollama dedicada a embeddings (separada del proveedor de chat en src/lib/ai.ts).
const OLLAMA_BASE_URL = process.env.KNOWLEDGE_OLLAMA_URL || "http://134.122.19.75:11435";
const EMBEDDING_MODEL = "nomic-embed-text";
export const EMBEDDING_DIMENSIONS = 768;

const CHUNK_WORD_SIZE = 500;
const CHUNK_WORD_OVERLAP = 50;

/** Páginas institucionales que forman la base de conocimiento. */
export const UDELAS_PATHS = [
  "/",
  "/sobre-udelas/",
  "/transparencia/",
  "/facultades/",
  "/admision-v2/",
  "/servicios/",
  "/secretaria-general/",
  "/calendario-academico/",
  "/transparencia/ley-y-estatuto-organico/",
  "/transparencia/acuerdos-academicos-y-administrativos/",
  "/vicerrectorias/",
  "/autoridades/"
];

export interface IngestionProgressEvent {
  url: string;
  status: "ok" | "empty" | "error";
  chunks: number;
  error?: string;
}

export interface IngestionResult {
  pagesProcessed: number;
  pagesFailed: number;
  chunksCreated: number;
  progress: IngestionProgressEvent[];
}

// ---------------------------------------------------------------------------
// Extracción de texto principal (sin menús/cabecera/pie ni etiquetas HTML)
// ---------------------------------------------------------------------------

const NOISE_CLASS_HINTS = [
  "menu", "navbar", "nav-", "sidebar", "widget", "cookie", "breadcrumb",
  "site-header", "site-footer", "elementor-location-header", "elementor-location-footer"
];

function extractMainText(html: string): string {
  let clean = html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<noscript[\s\S]*?<\/noscript>/gi, " ")
    .replace(/<!--[\s\S]*?-->/g, " ")
    .replace(/<header[\s\S]*?<\/header>/gi, " ")
    .replace(/<footer[\s\S]*?<\/footer>/gi, " ")
    .replace(/<nav[\s\S]*?<\/nav>/gi, " ")
    .replace(/<aside[\s\S]*?<\/aside>/gi, " ")
    .replace(/<form[\s\S]*?<\/form>/gi, " ");

  // WordPress (y Elementor, usado por udelas.ac.pa) suelen marcar menús/sidebars con
  // estas clases aunque no estén dentro de <nav>/<header>/<aside>.
  for (const cls of NOISE_CLASS_HINTS) {
    const re = new RegExp(`<[^>]+class="[^"]*${cls}[^"]*"[^>]*>[\\s\\S]*?<\\/(?:div|section|ul)>`, "gi");
    clean = clean.replace(re, " ");
  }

  // Si hay <main> o <article>, ese es casi siempre el contenido real de la página.
  const main = clean.match(/<main[\s\S]*?<\/main>/i) || clean.match(/<article[\s\S]*?<\/article>/i);
  const scope = main ? main[0] : clean;

  return scope
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/(p|div|li|h[1-6]|tr)>/gi, "\n")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#0?39;/g, "'")
    .replace(/[ \t]+/g, " ")
    .replace(/\n\s*\n+/g, "\n\n")
    .trim();
}

async function fetchPageText(path: string): Promise<string> {
  const url = new URL(path, SITE_BASE_URL).toString();
  const res = await fetch(url, {
    headers: { "User-Agent": "Mozilla/5.0 (compatible; UdelasKnowledgeBot/1.0)" }
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const html = await res.text();
  return extractMainText(html);
}

// ---------------------------------------------------------------------------
// Fragmentación por palabras (chunks de 500 palabras, solape de 50)
// ---------------------------------------------------------------------------

export function chunkByWords(text: string, size = CHUNK_WORD_SIZE, overlap = CHUNK_WORD_OVERLAP): string[] {
  const words = text.split(/\s+/).filter(Boolean);
  if (words.length === 0) return [];
  const chunks: string[] = [];
  let start = 0;
  while (start < words.length) {
    const end = Math.min(start + size, words.length);
    chunks.push(words.slice(start, end).join(" "));
    if (end === words.length) break;
    start = end - overlap;
  }
  return chunks;
}

// ---------------------------------------------------------------------------
// Embeddings (API nativa de Ollama, /api/embeddings)
// ---------------------------------------------------------------------------

async function embedText(text: string): Promise<number[]> {
  const res = await fetch(`${OLLAMA_BASE_URL}/api/embeddings`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ model: EMBEDDING_MODEL, prompt: text.slice(0, 8000) })
  });
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`Ollama embeddings respondió HTTP ${res.status}: ${body.slice(0, 300)}`);
  }
  const data = await res.json();
  const embedding = data.embedding as number[] | undefined;
  if (!Array.isArray(embedding) || embedding.length === 0) {
    throw new Error("Ollama no devolvió un embedding válido.");
  }
  return embedding;
}

/** Formatea un vector para usarlo en SQL crudo de pgvector: "[0.1,0.2,...]" */
function toVectorLiteral(v: number[]): string {
  return `[${v.join(",")}]`;
}

export interface KnowledgeChunkHit {
  content: string;
  source: string;
  url: string | null;
}

/**
 * Busca los fragmentos más similares (distancia coseno, pgvector) a `query` en
 * knowledge_chunks. Usada por el Tutor IA para enriquecer su prompt con
 * conocimiento institucional de UDELAS. Lanza si Ollama o la tabla no están
 * disponibles; el llamador decide si continuar sin este contexto.
 */
export async function searchKnowledgeChunks(query: string, limit = 3): Promise<KnowledgeChunkHit[]> {
  const embedding = await embedText(query);
  const vector = toVectorLiteral(embedding);
  return prisma.$queryRawUnsafe<KnowledgeChunkHit[]>(
    `SELECT content, source, url FROM knowledge_chunks ORDER BY embedding <=> $1::vector LIMIT $2`,
    vector,
    limit
  );
}

// ---------------------------------------------------------------------------
// Tabla knowledge_chunks (pgvector) — creada por SQL crudo, no depende de
// `prisma db push`, igual que la columna embedding de LibraryChunk (ver src/lib/library.ts).
// ---------------------------------------------------------------------------

let tableEnsured = false;

export async function ensureKnowledgeTable() {
  if (tableEnsured) return;
  await prisma.$executeRawUnsafe(`CREATE EXTENSION IF NOT EXISTS vector`);
  await prisma.$executeRawUnsafe(`CREATE EXTENSION IF NOT EXISTS pgcrypto`);
  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS knowledge_chunks (
      id UUID PRIMARY KEY,
      content TEXT NOT NULL,
      embedding vector(${EMBEDDING_DIMENSIONS}),
      source TEXT NOT NULL,
      type TEXT NOT NULL DEFAULT 'web',
      url TEXT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now()
    )
  `);
  await prisma.$executeRawUnsafe(
    `CREATE INDEX IF NOT EXISTS knowledge_chunks_embedding_idx ON knowledge_chunks USING hnsw (embedding vector_cosine_ops)`
  );
  tableEnsured = true;
}

/** Borra los fragmentos ya ingeridos de una fuente, para que una corrida repetida no duplique contenido. */
async function deleteBySource(source: string) {
  await prisma.$executeRawUnsafe(`DELETE FROM knowledge_chunks WHERE source = $1`, source);
}

async function insertChunk(content: string, embedding: number[], source: string, type: string, url: string) {
  await prisma.$executeRawUnsafe(
    `INSERT INTO knowledge_chunks (id, content, embedding, source, type, url, created_at)
     VALUES (gen_random_uuid(), $1, $2::vector, $3, $4, $5, now())`,
    content,
    toVectorLiteral(embedding),
    source,
    type,
    url
  );
}

// ---------------------------------------------------------------------------
// Orquestación
// ---------------------------------------------------------------------------

/**
 * Descarga las páginas institucionales de UDELAS listadas en UDELAS_PATHS,
 * extrae su texto principal, lo fragmenta y guarda los embeddings en
 * knowledge_chunks. `onProgress` se invoca después de procesar cada página
 * (éxito o error), útil para reportar avance desde una ruta de API.
 */
export async function scrapeUdelasWebsite(onProgress?: (e: IngestionProgressEvent) => void): Promise<IngestionResult> {
  await ensureKnowledgeTable();

  const progress: IngestionProgressEvent[] = [];
  let chunksCreated = 0;
  let pagesFailed = 0;

  for (const path of UDELAS_PATHS) {
    const url = new URL(path, SITE_BASE_URL).toString();
    const source = `udelas.ac.pa${path}`;
    try {
      const text = await fetchPageText(path);
      const chunks = chunkByWords(text);
      await deleteBySource(source);

      for (const chunk of chunks) {
        const embedding = await embedText(chunk);
        await insertChunk(chunk, embedding, source, "web", url);
        chunksCreated++;
      }

      const event: IngestionProgressEvent = { url, status: chunks.length ? "ok" : "empty", chunks: chunks.length };
      progress.push(event);
      onProgress?.(event);
    } catch (e: any) {
      pagesFailed++;
      const event: IngestionProgressEvent = { url, status: "error", chunks: 0, error: String(e?.message || e) };
      progress.push(event);
      onProgress?.(event);
    }
  }

  return { pagesProcessed: UDELAS_PATHS.length - pagesFailed, pagesFailed, chunksCreated, progress };
}

// ---------------------------------------------------------------------------
// RIUDELAS — repositorio institucional (DSpace 7) via API REST
// ---------------------------------------------------------------------------

const RIUDELAS_BASE_URL = "https://repositorio2.udelas.ac.pa";
const RIUDELAS_API_URL = `${RIUDELAS_BASE_URL}/server/api`;
const RIUDELAS_PAGE_SIZE = 20;
const RIUDELAS_MAX_PAGES = 10;
const RIUDELAS_MAX_ITEMS = 200;
const RIUDELAS_SOURCE = "RIUDELAS";

interface DSpaceMetadataValue {
  value: string;
}

type DSpaceMetadata = Record<string, DSpaceMetadataValue[]>;

interface DSpaceItem {
  id: string;
  uuid?: string;
  name?: string;
  metadata?: DSpaceMetadata;
}

function firstMetadataValue(metadata: DSpaceMetadata | undefined, field: string): string {
  return metadata?.[field]?.[0]?.value?.trim() || "";
}

function allMetadataValues(metadata: DSpaceMetadata | undefined, field: string): string[] {
  return (metadata?.[field] || []).map((v) => v.value.trim()).filter(Boolean);
}

/** Llama a la API de búsqueda (Discover) de DSpace 7 y devuelve los items de una página. */
async function fetchRIUDELASPage(page: number): Promise<DSpaceItem[]> {
  const url = `${RIUDELAS_API_URL}/discover/search/objects?query=*&dsoType=item&size=${RIUDELAS_PAGE_SIZE}&page=${page}`;
  const res = await fetch(url, {
    headers: { Accept: "application/json", "User-Agent": "Mozilla/5.0 (compatible; UdelasKnowledgeBot/1.0)" }
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const data = await res.json();
  const objects = data?._embedded?.searchResult?._embedded?.objects || [];
  return objects
    .map((o: any) => o?._embedded?.indexableObject)
    .filter((item: any): item is DSpaceItem => !!item);
}

export interface RIUDELASProgressEvent {
  title: string;
  status: "ok" | "error";
  error?: string;
}

export interface RIUDELASIngestionResult {
  pagesFetched: number;
  itemsProcessed: number;
  itemsFailed: number;
  chunksCreated: number;
  progress: RIUDELASProgressEvent[];
}

/**
 * Recorre el repositorio institucional RIUDELAS (DSpace 7) vía su API REST,
 * extrae título/autor/fecha/resumen de cada item publicado y guarda los
 * embeddings en knowledge_chunks (type='repositorio', source='RIUDELAS').
 * Pagina hasta RIUDELAS_MAX_PAGES páginas o RIUDELAS_MAX_ITEMS items (piloto).
 * Si la API del repositorio falla, se detiene sin lanzar: el resto de la
 * base de conocimiento (sitio web) no debe verse afectado.
 */
export async function scrapeRIUDELAS(): Promise<RIUDELASIngestionResult> {
  await ensureKnowledgeTable();
  await deleteBySource(RIUDELAS_SOURCE);

  const progress: RIUDELASProgressEvent[] = [];
  let itemsProcessed = 0;
  let itemsFailed = 0;
  let chunksCreated = 0;
  let pagesFetched = 0;

  for (let page = 0; page < RIUDELAS_MAX_PAGES; page++) {
    let items: DSpaceItem[];
    try {
      items = await fetchRIUDELASPage(page);
    } catch {
      break;
    }
    pagesFetched++;
    if (items.length === 0) break;

    for (const item of items) {
      const title = firstMetadataValue(item.metadata, "dc.title") || item.name || "Sin título";
      try {
        const author = allMetadataValues(item.metadata, "dc.contributor.author").join(", ") || "No especificado";
        const date = firstMetadataValue(item.metadata, "dc.date.issued") || "No especificada";
        const abstractText = firstMetadataValue(item.metadata, "dc.description.abstract") || "Sin resumen disponible.";

        const text = `Título: ${title}\nAutor: ${author}\nFecha: ${date}\nResumen: ${abstractText}`;
        const embedding = await embedText(text);
        const uuid = item.uuid || item.id;
        const url = `${RIUDELAS_BASE_URL}/items/${uuid}`;

        await insertChunk(text, embedding, RIUDELAS_SOURCE, "repositorio", url);
        chunksCreated++;
        itemsProcessed++;
        progress.push({ title, status: "ok" });
      } catch (e: any) {
        itemsFailed++;
        progress.push({ title, status: "error", error: String(e?.message || e) });
      }

      if (itemsProcessed + itemsFailed >= RIUDELAS_MAX_ITEMS) break;
    }
    if (itemsProcessed + itemsFailed >= RIUDELAS_MAX_ITEMS) break;
  }

  return { pagesFetched, itemsProcessed, itemsFailed, chunksCreated, progress };
}
