"use client";
import { useEffect, useState } from "react";
import { FileText, Trash2, Download } from "lucide-react";

type F = { id: string; kind: string; title: string; contentType: string; size: number; createdAt: string };
const KIND: Record<string, string> = { course_report: "Reporte de curso", agent_output: "Material docente", exam: "Examen", certificate: "Certificado" };

export default function MyFiles() {
  const [files, setFiles] = useState<F[] | null>(null);
  const [configured, setConfigured] = useState(true);
  const load = async () => {
    const r = await fetch("/api/exports"); const d = await r.json();
    setFiles(d.files || []); setConfigured(d.configured !== false);
  };
  useEffect(() => { load(); }, []);
  async function remove(f: F) {
    if (!confirm(`¿Eliminar "${f.title}"?`)) return;
    await fetch("/api/exports", { method: "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id: f.id }) });
    load();
  }
  const fmt = (n: number) => n > 1_000_000 ? `${(n / 1_000_000).toFixed(1)} MB` : `${Math.round(n / 1000)} KB`;
  return (
    <div className="card p-0 overflow-x-auto">
      {!configured && <div className="px-3 py-2 text-[11px] text-[#B45309] border-b border-[var(--border-tertiary)]">El almacenamiento de archivos aún no está configurado (variables SPACES_* en Render).</div>}
      <table className="w-full text-[11px]">
        <thead className="text-left text-[10px] uppercase tracking-wide text-[var(--text-tertiary)]">
          <tr><th className="px-3 py-2">Archivo</th><th className="px-3 py-2 hidden sm:table-cell">Tipo</th><th className="px-3 py-2 hidden sm:table-cell">Formato</th><th className="px-3 py-2 text-right hidden sm:table-cell">Tamaño</th><th className="px-3 py-2 hidden md:table-cell">Creado</th><th className="px-3 py-2 text-right">Descargar</th></tr>
        </thead>
        <tbody>
          {files === null && <tr><td colSpan={6} className="px-3 py-3 text-[var(--text-tertiary)]">Cargando…</td></tr>}
          {files && files.length === 0 && <tr><td colSpan={6} className="px-3 py-3 text-[var(--text-tertiary)]">Aún no has generado archivos. Los reportes, materiales, exámenes y certificados que exportes aparecerán aquí.</td></tr>}
          {files?.map((f) => (
            <tr key={f.id} className="border-t border-[var(--border-tertiary)]">
              <td className="px-3 py-2 font-medium max-w-[180px]">
                <span className="inline-flex items-start gap-1.5">
                  <FileText className="w-3.5 h-3.5 text-[var(--clr-brand2)] shrink-0 mt-0.5" />
                  <span className="min-w-0">
                    <span className="block truncate">{f.title}</span>
                    <span className="block text-[10px] text-[var(--text-tertiary)] sm:hidden mt-0.5">
                      {KIND[f.kind] || f.kind} · {f.contentType.includes("pdf") ? "PDF" : "Word"} · {fmt(f.size)}
                      <span className="block">{new Date(f.createdAt).toLocaleDateString("es-PA")}</span>
                    </span>
                  </span>
                </span>
              </td>
              <td className="px-3 py-2 hidden sm:table-cell">{KIND[f.kind] || f.kind}</td>
              <td className="px-3 py-2 hidden sm:table-cell">{f.contentType.includes("pdf") ? "PDF" : "Word"}</td>
              <td className="px-3 py-2 text-right hidden sm:table-cell">{fmt(f.size)}</td>
              <td className="px-3 py-2 text-[var(--text-tertiary)] hidden md:table-cell">{new Date(f.createdAt).toLocaleString("es-PA")}</td>
              <td className="px-3 py-2 text-right whitespace-nowrap">
                <a href={`/api/exports/${f.id}`} target="_blank" rel="noreferrer" className="text-[var(--clr-brand2)] hover:underline inline-flex items-center gap-1 mr-2 whitespace-nowrap"><Download className="w-3 h-3" /><span className="hidden sm:inline"> Descargar</span></a>
                <button onClick={() => remove(f)} className="text-[#B91C1C] hover:underline inline-flex items-center gap-1 whitespace-nowrap"><Trash2 className="w-3 h-3" /><span className="hidden sm:inline"> Eliminar</span></button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
