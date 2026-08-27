"use client";

import { useState } from "react";
import { Search, Loader2, Sparkles, BookText } from "lucide-react";

interface Doc {
  id: string;
  title: string;
  type: string;
  content: string;
  tags: string[];
}

const SUGGESTIONS = [
  "Reglamento de evaluación",
  "Rehabilitación cognitiva",
  "Inteligencia artificial en educación"
];

export default function LibrarySearch() {
  const [q, setQ] = useState("");
  const [loading, setLoading] = useState(false);
  const [docs, setDocs] = useState<Doc[] | null>(null);
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
      setDocs(data.documents ?? []);
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
            placeholder="Buscar en el repositorio institucional, reglamentos, libros y artículos..."
            className="flex-1 text-[13px] px-3 py-2 rounded-lg border border-[var(--border-secondary)] outline-none focus:border-[var(--clr-brand2)]"
          />
          <button
            onClick={() => search()}
            disabled={loading}
            className="bg-[var(--clr-brand2)] hover:bg-brand text-white rounded-lg px-3.5 py-2 disabled:opacity-60"
          >
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
          </button>
        </div>
        <div className="flex gap-1.5 flex-wrap mt-2">
          {SUGGESTIONS.map((s) => (
            <button
              key={s}
              onClick={() => search(s)}
              className="text-[11px] px-2.5 py-1 rounded-lg border border-[var(--border-secondary)] hover:bg-[var(--bg-secondary)]"
            >
              {s}
            </button>
          ))}
        </div>
      </div>

      {synthesis && (
        <div className="card bg-[#F7F9FF]">
          <div className="flex items-center gap-2 text-[12px] font-medium text-[var(--clr-brand2)] mb-1.5">
            <Sparkles className="w-3.5 h-3.5" /> Respuesta sintetizada por IA (RAG institucional)
          </div>
          <div className="text-[12px] leading-relaxed whitespace-pre-wrap">{synthesis}</div>
        </div>
      )}

      {docs && (
        <div className="card">
          <div className="text-[12px] font-medium mb-2">
            Resultados {docs.length > 0 && `(${docs.length})`}
          </div>
          {docs.length === 0 && (
            <div className="text-[12px] text-[var(--text-tertiary)]">
              No se encontraron documentos institucionales para esta búsqueda.
            </div>
          )}
          <div className="space-y-2">
            {docs.map((d) => (
              <div key={d.id} className="pb-2 border-b border-[var(--border-tertiary)] last:border-0">
                <div className="flex items-center gap-1.5 text-[12px] font-medium text-[var(--clr-brand2)]">
                  <BookText className="w-3.5 h-3.5" /> {d.title}
                </div>
                <div className="text-[11px] text-[var(--text-tertiary)] mt-0.5">
                  {d.type} · {d.tags.join(", ")}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
