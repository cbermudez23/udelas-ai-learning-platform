"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

interface MoodleSectionLite {
  id: number;
  name: string;
  section: number;
}

const MODNAME_LABELS: Record<string, string> = {
  forum: "Foro",
  page: "Página",
  url: "Enlace (URL)",
  label: "Etiqueta / nota",
  folder: "Carpeta",
  assign: "Tarea"
};

export default function CourseStructureTools({ courseId }: { courseId: string }) {
  const router = useRouter();
  const [sections, setSections] = useState<MoodleSectionLite[]>([]);
  const [loading, setLoading] = useState(true);
  const [msg, setMsg] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const [newBlockName, setNewBlockName] = useState("");
  const [subsectionTarget, setSubsectionTarget] = useState("");

  // -- Crear actividad --
  const [actSection, setActSection] = useState("");
  const [actModname, setActModname] = useState("forum");
  const [actName, setActName] = useState("");
  const [actIntro, setActIntro] = useState("");
  const [actContent, setActContent] = useState("");
  const [actUrl, setActUrl] = useState("");
  const [actDuedate, setActDuedate] = useState("");
  const [actGrade, setActGrade] = useState("100");
  const [actMsg, setActMsg] = useState<string | null>(null);
  const [actMsgIsError, setActMsgIsError] = useState(false);
  const [actBusy, setActBusy] = useState(false);
  const [lastCreatedUrl, setLastCreatedUrl] = useState<string | null>(null);

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

  async function createActivity(e: React.FormEvent) {
    e.preventDefault();
    setActBusy(true);
    setActMsg(null);
    setLastCreatedUrl(null);
    try {
      const res = await fetch(`/api/courses/${courseId}/activities`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sectionId: actSection,
          modname: actModname,
          name: actName,
          intro: actIntro,
          content: actContent,
          externalurl: actUrl,
          duedate: actDuedate,
          grade: actGrade
        })
      });
      const data = await res.json();
      setActMsgIsError(!res.ok);
      if (!res.ok) { setActMsg(data.error || "No se pudo crear la actividad"); return; }
      setActMsg(`"${actName}" se creó correctamente.`);
      setLastCreatedUrl(data.moodleUrl);
      setActName(""); setActIntro(""); setActContent(""); setActUrl(""); setActDuedate("");
      router.refresh();
    } catch (e: any) {
      setActMsgIsError(true);
      setActMsg(e.message || "Error de red");
    } finally {
      setActBusy(false);
    }
  }

  return (
    <div className="card space-y-3 border-l-4" style={{ borderLeftColor: "var(--role-teacher)" }}>
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
          className="text-[11px] font-medium px-2.5 py-1.5 rounded-md bg-[var(--role-teacher)] text-white disabled:opacity-50"
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
          className="text-[11px] font-medium px-2.5 py-1.5 rounded-md border border-[var(--role-teacher)] text-[var(--role-teacher)] disabled:opacity-50"
        >
          + Crear subsección
        </button>
      </div>

      {msg && <div className="text-[11px] text-[var(--text-secondary)]">{msg}</div>}

      <hr className="border-[var(--border)]" />

      <div className="text-[12px] font-medium">Crear actividad</div>
      <form onSubmit={createActivity} className="space-y-2">
        <div className="flex flex-wrap gap-2">
          <div>
            <label className="text-[10px] text-[var(--text-tertiary)]">Bloque</label>
            <select
              required
              value={actSection}
              onChange={(e) => setActSection(e.target.value)}
              className="block mt-0.5 text-[12px] border border-[var(--border)] rounded-md px-2 py-1 min-w-[150px]"
            >
              <option value="">Selecciona un bloque</option>
              {sections.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
          </div>
          <div>
            <label className="text-[10px] text-[var(--text-tertiary)]">Tipo</label>
            <select
              value={actModname}
              onChange={(e) => setActModname(e.target.value)}
              className="block mt-0.5 text-[12px] border border-[var(--border)] rounded-md px-2 py-1"
            >
              {Object.entries(MODNAME_LABELS).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
            </select>
          </div>
        </div>

        <div>
          <label className="text-[10px] text-[var(--text-tertiary)]">Nombre</label>
          <input required value={actName} onChange={(e) => setActName(e.target.value)}
            className="block mt-0.5 w-full text-[12px] border border-[var(--border)] rounded-md px-2 py-1" />
        </div>

        <div>
          <label className="text-[10px] text-[var(--text-tertiary)]">
            {actModname === "label" ? "Contenido de la etiqueta" : "Descripción (opcional)"}
          </label>
          <textarea value={actIntro} onChange={(e) => setActIntro(e.target.value)} rows={2}
            className="block mt-0.5 w-full text-[12px] border border-[var(--border)] rounded-md px-2 py-1" />
        </div>

        {actModname === "page" && (
          <div>
            <label className="text-[10px] text-[var(--text-tertiary)]">Contenido de la página</label>
            <textarea value={actContent} onChange={(e) => setActContent(e.target.value)} rows={4}
              className="block mt-0.5 w-full text-[12px] border border-[var(--border)] rounded-md px-2 py-1" />
          </div>
        )}

        {actModname === "url" && (
          <div>
            <label className="text-[10px] text-[var(--text-tertiary)]">URL de destino</label>
            <input required type="url" value={actUrl} onChange={(e) => setActUrl(e.target.value)} placeholder="https://…"
              className="block mt-0.5 w-full text-[12px] border border-[var(--border)] rounded-md px-2 py-1" />
          </div>
        )}

        {actModname === "assign" && (
          <div className="flex gap-2">
            <div>
              <label className="text-[10px] text-[var(--text-tertiary)]">Fecha de entrega (opcional)</label>
              <input type="date" value={actDuedate} onChange={(e) => setActDuedate(e.target.value)}
                className="block mt-0.5 text-[12px] border border-[var(--border)] rounded-md px-2 py-1" />
            </div>
            <div>
              <label className="text-[10px] text-[var(--text-tertiary)]">Nota máxima</label>
              <input type="number" value={actGrade} onChange={(e) => setActGrade(e.target.value)}
                className="block mt-0.5 w-20 text-[12px] border border-[var(--border)] rounded-md px-2 py-1" />
            </div>
          </div>
        )}

        <button type="submit" disabled={actBusy}
          className="text-[11px] font-medium px-2.5 py-1.5 rounded-md bg-[var(--role-teacher)] text-white disabled:opacity-50">
          {actBusy ? "Creando…" : "+ Crear actividad"}
        </button>

        {actMsg && (
          <div className={`text-[11px] ${actMsgIsError ? "text-red-600" : "text-green-700"}`}>
            {actMsg}{" "}
            {lastCreatedUrl && (
              <a href={lastCreatedUrl} target="_blank" rel="noreferrer" className="underline">Abrir en Moodle</a>
            )}
          </div>
        )}
      </form>

      <div className="text-[10px] text-[var(--text-tertiary)]">
        Tipos disponibles por ahora: foro, página, enlace, etiqueta, carpeta y tarea. Para cuestionarios, lecciones u
        otros tipos más complejos, sigue usando Moodle directamente.
      </div>
    </div>
  );
}
