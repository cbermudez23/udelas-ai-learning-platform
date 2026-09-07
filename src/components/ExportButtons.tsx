"use client";
import { useState } from "react";
import { FileDown, Loader2 } from "lucide-react";

interface Props {
  kind: "course_report" | "agent_output" | "exam" | "certificate";
  payload: Record<string, any>;
  formats?: ("pdf" | "docx")[];
  label?: string;
  size?: "sm" | "xs";
}

/** Botones "PDF" / "Word" que generan un archivo en Spaces y muestran el enlace de descarga. */
export default function ExportButtons({ kind, payload, formats = ["pdf", "docx"], label, size = "sm" }: Props) {
  const [busy, setBusy] = useState<string | null>(null);
  const [link, setLink] = useState<{ id: string; title: string } | null>(null);
  const [err, setErr] = useState<string | null>(null);

  async function run(format: "pdf" | "docx") {
    setBusy(format); setErr(null); setLink(null);
    try {
      const res = await fetch("/api/exports", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ kind, format, ...payload }) });
      const d = await res.json();
      if (!res.ok) setErr(d.error || "Error al exportar");
      else setLink({ id: d.file.id, title: d.file.title });
    } catch (e: any) { setErr(e.message); } finally { setBusy(null); }
  }

  const cls = size === "xs"
    ? "inline-flex items-center gap-1 text-[10px] px-2 py-0.5 rounded border border-[var(--border-tertiary)] hover:bg-[#EEF3FF] text-[var(--text-secondary)] disabled:opacity-50"
    : "inline-flex items-center gap-1.5 text-[11px] font-medium px-2.5 py-1.5 rounded-md border border-[var(--clr-brand2)] text-[var(--clr-brand2)] hover:bg-[#EEF3FF] disabled:opacity-50";

  return (
    <div className="flex items-center gap-2 flex-wrap">
      {label && <span className="text-[11px] text-[var(--text-tertiary)]">{label}</span>}
      {formats.map((f) => (
        <button key={f} onClick={() => run(f)} disabled={busy !== null} className={cls}>
          {busy === f ? <Loader2 className="w-3 h-3 animate-spin" /> : <FileDown className="w-3 h-3" />} {f === "pdf" ? "PDF" : "Word"}
        </button>
      ))}
      {link && (
        <a href={`/api/exports/${link.id}`} target="_blank" rel="noreferrer" className="text-[11px] text-[#166534] font-medium hover:underline">
          Descargar “{link.title}” ↗
        </a>
      )}
      {err && <span className="text-[11px] text-[#B91C1C]">{err}</span>}
    </div>
  );
}
