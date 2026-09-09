"use client";

import { useState } from "react";

interface SectionOption { id: number; name: string; section: number; }

export default function TestCreateActivityForm() {
  const [courseid, setCourseid] = useState("");
  const [sectionid, setSectionid] = useState("");
  const [sections, setSections] = useState<SectionOption[]>([]);
  const [loadingSections, setLoadingSections] = useState(false);
  const [modname, setModname] = useState("label");
  const [name, setName] = useState("Prueba desde plugin");
  const [intro, setIntro] = useState("Texto de prueba");
  const [settings, setSettings] = useState("{}");
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<string | null>(null);
  const [isError, setIsError] = useState(false);

  async function loadSections() {
    if (!courseid) return;
    setLoadingSections(true);
    setSections([]);
    try {
      const res = await fetch(`/api/admin/test-create-activity?courseid=${courseid}`);
      const data = await res.json();
      if (data.sections) setSections(data.sections);
      else setResult(JSON.stringify(data, null, 2));
    } finally {
      setLoadingSections(false);
    }
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setResult(null);
    try {
      const res = await fetch("/api/admin/test-create-activity", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ courseid, sectionid, modname, name, intro, settings })
      });
      const data = await res.json();
      setIsError(!res.ok);
      setResult(JSON.stringify(data, null, 2));
    } catch (e: any) {
      setIsError(true);
      setResult(e.message || "Error de red");
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="card space-y-3 max-w-lg">
      <div>
        <label className="text-[11px] font-medium text-[var(--text-secondary)]">courseid</label>
        <div className="flex gap-2 mt-1">
          <input value={courseid} onChange={(e) => setCourseid(e.target.value)} placeholder="Ej. 5"
            className="w-full text-[12px] border border-[var(--border)] rounded-md px-2.5 py-1.5" />
          <button type="button" onClick={loadSections} disabled={!courseid || loadingSections}
            className="text-[11px] font-medium px-2.5 py-1.5 rounded-md border border-[var(--clr-brand2)] text-[var(--clr-brand2)] disabled:opacity-50 whitespace-nowrap">
            {loadingSections ? "Cargando…" : "Cargar secciones"}
          </button>
        </div>
      </div>
      <div>
        <label className="text-[11px] font-medium text-[var(--text-secondary)]">sectionid</label>
        {sections.length > 0 ? (
          <select value={sectionid} onChange={(e) => setSectionid(e.target.value)}
            className="mt-1 w-full text-[12px] border border-[var(--border)] rounded-md px-2.5 py-1.5">
            <option value="">Selecciona una sección</option>
            {sections.map((s) => <option key={s.id} value={s.id}>{s.name} (id {s.id})</option>)}
          </select>
        ) : (
          <input value={sectionid} onChange={(e) => setSectionid(e.target.value)} placeholder="Carga las secciones arriba, o escribe el id a mano"
            className="mt-1 w-full text-[12px] border border-[var(--border)] rounded-md px-2.5 py-1.5" />
        )}
      </div>
      <div>
        <label className="text-[11px] font-medium text-[var(--text-secondary)]">modname</label>
        <select value={modname} onChange={(e) => setModname(e.target.value)}
          className="mt-1 w-full text-[12px] border border-[var(--border)] rounded-md px-2.5 py-1.5">
          <option value="label">label (etiqueta)</option>
          <option value="page">page (página)</option>
          <option value="url">url (enlace)</option>
          <option value="forum">forum (foro)</option>
          <option value="folder">folder (carpeta)</option>
          <option value="assign">assign (tarea)</option>
        </select>
      </div>
      <div>
        <label className="text-[11px] font-medium text-[var(--text-secondary)]">name</label>
        <input value={name} onChange={(e) => setName(e.target.value)}
          className="mt-1 w-full text-[12px] border border-[var(--border)] rounded-md px-2.5 py-1.5" />
      </div>
      <div>
        <label className="text-[11px] font-medium text-[var(--text-secondary)]">intro</label>
        <input value={intro} onChange={(e) => setIntro(e.target.value)}
          className="mt-1 w-full text-[12px] border border-[var(--border)] rounded-md px-2.5 py-1.5" />
      </div>
      <div>
        <label className="text-[11px] font-medium text-[var(--text-secondary)]">settings (JSON, según el tipo — deja {"{}"} para label)</label>
        <textarea value={settings} onChange={(e) => setSettings(e.target.value)} rows={2}
          className="mt-1 w-full text-[12px] font-mono border border-[var(--border)] rounded-md px-2.5 py-1.5" />
      </div>
      <button type="submit" disabled={busy}
        className="text-[12px] font-medium px-3 py-1.5 rounded-md bg-[var(--clr-brand2)] text-white disabled:opacity-50">
        {busy ? "Probando…" : "Probar"}
      </button>
      {result && (
        <pre className={`text-[10px] p-2 rounded-md overflow-auto max-h-64 ${isError ? "bg-red-50 text-red-700" : "bg-green-50 text-green-800"}`}>
          {result}
        </pre>
      )}
    </form>
  );
}
