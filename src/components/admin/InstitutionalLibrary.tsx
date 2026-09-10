"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Upload, Trash2, FileText } from "lucide-react";

type Row = { id: string; title: string; type: string; tags: string[]; fileName: string | null; chunks: number; createdAt: string };
const TYPE_LABEL: Record<string, string> = { reglamento: "Reglamento", guia: "Guía", politica: "Política", manual: "Manual", articulo: "Artículo", libro: "Libro", otro: "Otro" };

export default function InstitutionalLibrary({ docs, moodleCount }: { docs: Row[]; moodleCount: number }) {
  const router = useRouter();
  const [file, setFile] = useState<File | null>(null);
  const [title, setTitle] = useState("");
  const [type, setType] = useState("reglamento");
  const [tags, setTags] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  async function upload() {
    if (!file || !title.trim()) { setMsg("Elige un archivo y escribe un título."); return; }
    setBusy(true); setMsg(null);
    try {
      const fd = new FormData();
      fd.append("file", file); fd.append("title", title.trim()); fd.append("type", type); fd.append("tags", tags);
      const res = await fetch("/api/admin/library", { method: "POST", body: fd });
      const d = await res.json();
      if (!res.ok) setMsg(d.error || "Error");
      else { setMsg(`"${title}" indexado (${d.chunks} fragmentos).`); setFile(null); setTitle(""); setTags(""); router.refresh(); }
    } catch (e: any) { setMsg(e.message); } finally { setBusy(false); }
  }
  async function remove(r: Row) {
    if (!confirm(`¿Eliminar "${r.title}" de la Biblioteca IA?`)) return;
    setBusy(true);
    try {
      const res = await fetch("/api/admin/library", { method: "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id: r.id }) });
      if (res.ok) { setMsg(`"${r.title}" eliminado.`); router.refresh(); }
    } finally { setBusy(false); }
  }

  const input = "text-[11px] border border-[var(--border-tertiary)] rounded-md px-2.5 py-1.5 bg-white w-full";
  return (
    <div className="space-y-3">
      <div className="card">
        <div className="text-[12px] font-medium mb-1">Materiales institucionales</div>
        <div className="text-[11px] text-[var(--text-secondary)] mb-3">
          Reglamentos, guías, políticas y manuales de UDELAS. Están disponibles para todos los usuarios en la Biblioteca IA y el Tutor IA los cita cuando son relevantes. Los materiales de los cursos ({moodleCount}) llegan solos desde Moodle y no se gestionan aquí.
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2 items-end">
          <div className="lg:col-span-2">
            <label className="block text-[11px] font-medium mb-1">Título</label>
            <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Ej. Reglamento de evaluación estudiantil 2026" className={input} />
          </div>
          <div>
            <label className="block text-[11px] font-medium mb-1">Tipo</label>
            <select value={type} onChange={(e) => setType(e.target.value)} className={input}>
              {Object.entries(TYPE_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-[11px] font-medium mb-1">Etiquetas (coma)</label>
            <input value={tags} onChange={(e) => setTags(e.target.value)} placeholder="evaluación, grado" className={input} />
          </div>
          <div className="sm:col-span-2 lg:col-span-3">
            <label className="block text-[11px] font-medium mb-1">Archivo (PDF, Word, texto · máx. 20 MB)</label>
            <input type="file" accept=".pdf,.docx,.txt,.md,.html,.htm" onChange={(e) => setFile(e.target.files?.[0] || null)} className="text-[11px]" />
          </div>
          <button onClick={upload} disabled={busy} className="inline-flex items-center justify-center gap-1.5 text-[11px] font-medium px-3 py-1.5 rounded-md bg-[var(--role-admin)] text-white hover:opacity-90 disabled:opacity-50">
            <Upload className="w-3.5 h-3.5" /> {busy ? "Procesando…" : "Subir e indexar"}
          </button>
        </div>
        {msg && <div className="text-[11px] text-[var(--text-tertiary)] mt-2">{msg}</div>}
      </div>

      <div className="card p-0 overflow-x-auto">
        <table className="w-full text-[11px]">
          <thead className="text-left text-[10px] uppercase tracking-wide text-[var(--text-tertiary)]">
            <tr><th className="px-3 py-2">Documento</th><th className="px-3 py-2 hidden sm:table-cell">Tipo</th><th className="px-3 py-2 hidden md:table-cell">Etiquetas</th><th className="px-3 py-2 text-right hidden sm:table-cell">Frag.</th><th className="px-3 py-2 hidden md:table-cell">Cargado</th><th className="px-3 py-2 text-right">Acciones</th></tr>
          </thead>
          <tbody>
            {docs.length === 0 && <tr><td colSpan={6} className="px-3 py-3 text-[var(--text-tertiary)]">Aún no hay materiales institucionales.</td></tr>}
            {docs.map((r) => (
              <tr key={r.id} className="border-t border-[var(--border-tertiary)]">
                <td className="px-3 py-2 font-medium max-w-[180px]">
                <span className="inline-flex items-start gap-1.5">
                  <FileText className="w-3.5 h-3.5 text-[var(--clr-brand2)] shrink-0 mt-0.5" />
                  <span className="min-w-0">
                    <span className="block truncate">{r.title}</span>
                    {r.fileName && <span className="block text-[10px] text-[var(--text-tertiary)] truncate">{r.fileName}</span>}
                    <span className="sm:hidden block text-[10px] text-[var(--text-tertiary)] mt-0.5">
                      {TYPE_LABEL[r.type] || r.type} · {r.chunks} fragmento(s) · {new Date(r.createdAt).toLocaleDateString("es-PA")}
                      {r.tags.length > 0 && <span> · {r.tags.join(", ")}</span>}
                    </span>
                  </span>
                </span>
              </td>
                <td className="px-3 py-2 hidden sm:table-cell">{TYPE_LABEL[r.type] || r.type}</td>
                <td className="px-3 py-2 text-[var(--text-tertiary)] hidden md:table-cell">{r.tags.join(", ")}</td>
                <td className="px-3 py-2 text-right hidden sm:table-cell">{r.chunks}</td>
                <td className="px-3 py-2 text-[var(--text-tertiary)] hidden md:table-cell">{new Date(r.createdAt).toLocaleDateString("es-PA")}</td>
                <td className="px-3 py-2 text-right"><button onClick={() => remove(r)} disabled={busy} className="text-[#B91C1C] hover:underline inline-flex items-center gap-1"><Trash2 className="w-3 h-3" /> Eliminar</button></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
