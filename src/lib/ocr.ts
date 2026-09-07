/**
 * OCR para PDF escaneados (sin capa de texto).
 *
 * tesseract.js-core v7 trae un núcleo "relaxed-SIMD" con un símbolo interno
 * roto (DotProductSSE) que aborta en tiempo de ejecución en Node. El detector
 * de características de Node reporta soporte para relaxed-SIMD igualmente, así
 * que el worker se arranca con un script (scripts/tesseract-worker-patched.cjs)
 * que fuerza esa detección a "no soportado" para caer al núcleo "simd" normal,
 * que sí funciona. Verificado con un PDF de prueba sin texto embebido.
 */
import path from "path";
import type { Worker } from "tesseract.js";

export const MAX_OCR_PAGES = 8;
const OCR_SCALE = 2; // resolución de render; más alto = mejor precisión y más lento

let workerPromise: Promise<Worker> | null = null;

function workerScriptPath(): string {
  // process.cwd() es la raíz del proyecto tanto en desarrollo como en Render.
  return path.join(process.cwd(), "scripts", "tesseract-worker-patched.cjs");
}

async function getWorker(): Promise<Worker> {
  if (!workerPromise) {
    workerPromise = (async () => {
      const Tesseract = await import("tesseract.js");
      return Tesseract.createWorker("spa", 1, {
        workerPath: workerScriptPath(),
        cachePath: "/tmp/tesseract-cache",
        langPath: "https://raw.githubusercontent.com/naptha/tessdata/gh-pages/4.0.0_best"
      });
    })();
  }
  return workerPromise;
}

/** Libera el worker de OCR. Llamar al final de cada corrida de indexado. */
export async function terminateOcrWorker(): Promise<void> {
  if (!workerPromise) return;
  const w = await workerPromise.catch(() => null);
  workerPromise = null;
  await w?.terminate().catch(() => {});
}

async function renderPageToPng(pdfBuffer: Buffer, pageNumber: number): Promise<Buffer> {
  const { renderPageAsImage } = await import("unpdf");
  const result = await renderPageAsImage(new Uint8Array(pdfBuffer), pageNumber, {
    canvasImport: () => import("@napi-rs/canvas"),
    scale: OCR_SCALE
  });
  return Buffer.from(result as ArrayBuffer);
}

/**
 * Aplica OCR en español a un PDF sin texto, página por página, hasta
 * `MAX_OCR_PAGES`. Devuelve el texto reconocido y si se truncó por el límite.
 */
export async function ocrPdfBuffer(pdfBuffer: Buffer): Promise<{ text: string; truncated: boolean; pagesProcessed: number }> {
  const { getDocumentProxy } = await import("unpdf");
  const pdf = await getDocumentProxy(new Uint8Array(pdfBuffer));
  const totalPages = (pdf as any).numPages as number;
  const pagesToProcess = Math.min(totalPages, MAX_OCR_PAGES);

  const worker = await getWorker();
  const parts: string[] = [];
  for (let i = 1; i <= pagesToProcess; i++) {
    const png = await renderPageToPng(pdfBuffer, i);
    const { data } = await worker.recognize(png);
    const text = (data.text || "").trim();
    if (text) parts.push(text);
  }
  return { text: parts.join("\n\n"), truncated: totalPages > pagesToProcess, pagesProcessed: pagesToProcess };
}
