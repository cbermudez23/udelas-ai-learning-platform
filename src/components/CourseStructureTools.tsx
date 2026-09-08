"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

interface MoodleSectionLite {
  id: number;
  name: string;
  section: number;
}

export default function CourseStructureTools({ courseId }: { courseId: string }) {
  const router = useRouter();
  const [sections, setSections] = useState<MoodleSectionLite[]>([]);
  const [loading, setLoading] = useState(true);
  const [msg, setMsg] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const [newBlockName, setNewBlockName] = useState("");
  const [subsectionTarget, setSubsectionTarget] = useState("");

  async function loadSections() {
    setLoading(true);
    try {
      const res = await fetch(`/api/courses/${courseId}/sections`);
      const data = await res.json();
      if (data.sections) setSections(data.sections);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadSections();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [courseId]);

  async function run(body: Record<string, unknown>, successMsg: string) {
    setBusy(true);
    setMsg(null);
    try {
      const res = await fetch(`/api/courses/${courseId}/sections`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body)
      });
      const data = await res.json();
      if (!res.ok) { setMsg(data.error || "Error"); return; }
      setMsg(data.note || successMsg);
      await loadSections();
      router.refresh();
    } catch (e: any) {
      setMsg(e.message || "Error de red");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="card space-y-3">
      <div className="text-[12px] font-medium">Estructura del curso (en Moodle)</div>

      <div className="flex flex-wrap items-end gap-2">
        <div>
          <label className="text-[10px] text-[var(--text-tertiary)]">Nombre del bloque nuevo</label>
          <input
            value={newBlockName}
            onChange={(e) => setNewBlockName(e.target.value)}
            placeholder="Ej. Bloque 5"
            className="block mt-0.5 text-[12px] border border-[var(--border)] rounded-md px-2 py-1"
          />
        </div>
        <button
          disabled={busy}
          onClick={() => run({ action: "create_section", name: newBlockName || undefined }, "Bloque creado")}
          className="text-[11px] font-medium px-2.5 py-1.5 rounded-md bg-[var(--clr-brand2)] text-white disabled:opacity-50"
        >
          + Crear bloque
        </button>
      </div>

      <div className="flex flex-wrap items-end gap-2">
        <div>
          <label className="text-[10px] text-[var(--text-tertiary)]">Bloque donde va la subsección</label>
          <select
            value={subsectionTarget}
            onChange={(e) => setSubsectionTarget(e.target.value)}
            disabled={loading}
            className="block mt-0.5 text-[12px] border border-[var(--border)] rounded-md px-2 py-1 min-w-[180px]"
          >
            <option value="">{loading ? "Cargando…" : "Selecciona un bloque"}</option>
            {sections.map((s) => (
              <option key={s.id} value={s.id}>{s.name}</option>
            ))}
          </select>
        </div>
        <button
          disabled={busy || !subsectionTarget}
          onClick={() => run({ action: "create_subsection", targetSectionId: subsectionTarget }, "Subsección creada")}
          className="text-[11px] font-medium px-2.5 py-1.5 rounded-md border border-[var(--clr-brand2)] text-[var(--clr-brand2)] disabled:opacity-50"
        >
          + Crear subsección
        </button>
      </div>

      {msg && <div className="text-[11px] text-[var(--text-secondary)]">{msg}</div>}

      <div className="text-[10px] text-[var(--text-tertiary)]">
        Otras actividades (tareas, foros, páginas, etc.) todavía se agregan directamente en Moodle — Moodle no ofrece
        una función para crearlas desde afuera sin un complemento adicional en el servidor.
      </div>
    </div>
  );
}
