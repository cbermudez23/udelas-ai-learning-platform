"use client";
import { useState } from "react";
import { Globe, RefreshCw, CheckCircle2, XCircle } from "lucide-react";

type ProgressEvent = { url: string; status: "ok" | "empty" | "error"; chunks: number; error?: string };
type Result = { pagesProcessed: number; pagesFailed: number; chunksCreated: number; progress: ProgressEvent[] };

export default function KnowledgeBaseIngestion() {
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<Result | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function run() {
    setBusy(true);
    setError(null);
    setResult(null);
    try {
      const res = await fetch("/api/admin/knowledge/ingest", { method: "POST" });
      const d = await res.json();
      if (!res.ok) setError(d.error || "Error al ingerir el sitio web de UDELAS.");
      else setResult(d);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="card">
      <div className="text-[12px] font-medium mb-1">Base de conocimiento — sitio web de UDELAS</div>
      <div className="text-[11px] text-[var(--text-secondary)] mb-3">
        Descarga las páginas institucionales de www.udelas.ac.pa (admisión, facultades, transparencia, calendario académico, autoridades, etc.), extrae su contenido y genera embeddings para que el Tutor IA y el Asesor puedan responder preguntas institucionales.
      </div>
      <button
        onClick={run}
        disabled={busy}
        className="inline-flex items-center justify-center gap-1.5 text-[11px] font-medium px-3 py-1.5 rounded-md bg-[var(--role-admin)] text-white hover:opacity-90 disabled:opacity-50"
      >
        {busy ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Globe className="w-3.5 h-3.5" />}
        {busy ? "Actualizando base de conocimiento…" : "Actualizar base de conocimiento"}
      </button>

      {error && <div className="text-[11px] text-[#B91C1C] mt-2">{error}</div>}

      {result && (
        <div className="mt-3 text-[11px]">
          <div className="text-[var(--text-secondary)] mb-2">
            {result.pagesProcessed} página(s) procesada(s), {result.chunksCreated} fragmento(s) guardado(s)
            {result.pagesFailed > 0 && `, ${result.pagesFailed} con error`}.
          </div>
          <ul className="space-y-1">
            {result.progress.map((p) => (
              <li key={p.url} className="flex items-start gap-1.5">
                {p.status === "error" ? (
                  <XCircle className="w-3.5 h-3.5 text-[#B91C1C] shrink-0 mt-0.5" />
                ) : (
                  <CheckCircle2 className="w-3.5 h-3.5 text-[var(--clr-brand2)] shrink-0 mt-0.5" />
                )}
                <span className="min-w-0">
                  <span className="block truncate text-[var(--text-tertiary)]">{p.url}</span>
                  {p.status === "error" ? (
                    <span className="block text-[#B91C1C]">{p.error}</span>
                  ) : (
                    <span className="block text-[var(--text-tertiary)]">{p.chunks} fragmento(s)</span>
                  )}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
