"use client";

import { useState } from "react";
import { Search, Loader2, Sparkles, BookText, ExternalLink } from "lucide-react";

interface Hit {
  chunkId: string;
  documentId: string;
  title: string;
  type: string;
  courseName: string | null;
  moodleUrl: string | null;
  order: number;
  text: string;
}

const SUGGESTIONS = ["¿Qué temas cubre mi curso?", "Resumen de la primera unidad", "Conceptos clave para la próxima tarea"];

export default function LibrarySearch() {
  const [q, setQ] = useState("");
  const [loading, setLoading] = useState(false);
  const [hits, setHits] = useState<Hit[] | null>(null);
  const [synthesis, setSynthesis] = useState<string | null>(null);

  async function search(text?: string) {
    const query = (text ?? q).trim();
    if (!query) return;
    setQ(query);
    setLoading(true);
    try {
      const res = await fetch("/api/library/search", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query })
      });
      const data = await res.json();
      setHits(data.hits ?? []);
      setSynthesis(data.synthesis ?? null);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-3">
      <div className="card">
        <div className="flex gap-2">
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && search()}
            placeholder="Pregunta o busca en los materiales de tus cursos (PDF, Word, páginas de Moodle)…"
            className="flex-1 text-[13px] px-3 py-2 rounded-lg border border-[var(--border-secondary)] outline-none focus:border-[var(--clr-brand2)]"
          />
          <button onClick={() => search()} disabled={loading} className="bg-[var(--clr-brand2)] hover:bg-brand text-white rounded-lg px-3.5 py-2 disabled:opacity-60">
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
          </button>
        </div>
        <div className="flex gap-1.5 flex-wrap mt-2">
          {SUGGESTIONS.map((s) => (
            <button key={s} onClick={() => search(s)} className="text-[11px] px-2.5 py-1 rounded-lg border border-[var(--border-secondary)] hover:bg-[var(--bg-secondary)]">
              {s}
            </button>
          ))}
        </div>
      </div>

      {synthesis && (
        <div className="card bg-[#F7F9FF]">
          <div className="flex items-center gap-2 text-[12px] font-medium text-[var(--clr-brand2)] mb-1.5">
            <Sparkles className="w-3.5 h-3.5" /> Respuesta basada en tus materiales
          </div>
          <div className="text-[12px] leading-relaxed whitespace-pre-wrap">{synthesis}</div>
        </div>
      )}

      {hits && (
        <div className="card">
          <div className="text-[12px] font-medium mb-2">Fragmentos encontrados {hits.length > 0 && `(${hits.length})`}</div>
          {hits.length === 0 && (
            <div className="text-[12px] text-[var(--text-tertiary)]">No se encontraron materiales para esta búsqueda. Prueba con otras palabras o revisa que el docente haya subido archivos en Moodle.</div>
          )}
          <div className="space-y-2">
            {hits.map((h, i) => (
              <div key={h.chunkId} className="pb-2 border-b border-[var(--border-tertiary)] last:border-0">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-1.5 text-[12px] font-medium text-[var(--clr-brand2)]">
                    <BookText className="w-3.5 h-3.5" /> [Material {i + 1}] {h.title}
                    <span className="text-[10px] font-normal text-[var(--text-tertiary)]">{h.courseName ? `· ${h.courseName}` : ""} · fragmento {h.order + 1}</span>
                  </div>
                  {h.moodleUrl && (
                    <a href={h.moodleUrl} target="_blank" rel="noreferrer" className="text-[10px] text-[var(--clr-brand2)] inline-flex items-center gap-1 hover:underline">
                      Abrir en Moodle <ExternalLink className="w-3 h-3" />
                    </a>
                  )}
                </div>
                <div className="text-[11px] text-[var(--text-secondary)] mt-1 whitespace-pre-wrap line-clamp-4">{h.text}</div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
