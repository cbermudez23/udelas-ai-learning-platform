/**
 * Cliente de Voyage AI (embeddings) para la búsqueda semántica de la Biblioteca IA.
 * Plan gratuito: 200M tokens — más que suficiente para años de materiales de UDELAS.
 * Modelo voyage-3: 1024 dimensiones, buen balance de calidad y costo.
 */
const MODEL = "voyage-3";
export const EMBEDDING_DIMENSIONS = 1024;
const BATCH_SIZE = 96; // límite prudente de textos por solicitud

function env(name: string): string {
  return (process.env[name] || "").trim();
}

export function voyageConfigured(): boolean {
  return Boolean(env("VOYAGE_API_KEY"));
}

export class VoyageError extends Error {}

type InputType = "document" | "query";

async function embedBatch(texts: string[], inputType: InputType): Promise<number[][]> {
  const apiKey = env("VOYAGE_API_KEY");
  if (!apiKey) throw new VoyageError("Falta VOYAGE_API_KEY en las variables de entorno.");

  const res = await fetch("https://api.voyageai.com/v1/embeddings", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
    body: JSON.stringify({ input: texts, model: MODEL, input_type: inputType, truncation: true })
  });
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new VoyageError(`Voyage AI respondió HTTP ${res.status}: ${body.slice(0, 300)}`);
  }
  const data = await res.json();
  const sorted = (data.data as { embedding: number[]; index: number }[]).sort((a, b) => a.index - b.index);
  return sorted.map((d) => d.embedding);
}

/** Genera embeddings para varios textos, respetando el límite de tamaño de lote de Voyage. */
export async function embedDocuments(texts: string[]): Promise<number[][]> {
  const out: number[][] = [];
  for (let i = 0; i < texts.length; i += BATCH_SIZE) {
    const batch = texts.slice(i, i + BATCH_SIZE).map((t) => t.slice(0, 8000)); // recorte defensivo por texto
    out.push(...(await embedBatch(batch, "document")));
  }
  return out;
}

/** Embedding de una consulta de búsqueda (usa el modo asimétrico "query" de Voyage). */
export async function embedQuery(text: string): Promise<number[]> {
  const [v] = await embedBatch([text.slice(0, 8000)], "query");
  return v;
}

/** Formatea un vector para usarlo en SQL crudo de pgvector: "[0.1,0.2,...]" */
export function toVectorLiteral(v: number[]): string {
  return `[${v.join(",")}]`;
}
