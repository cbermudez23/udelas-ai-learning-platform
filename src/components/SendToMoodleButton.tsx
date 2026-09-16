"use client";

import { useEffect, useState } from "react";
import { Send } from "lucide-react";

interface TeachingCourse { id: string; name: string; moodleCourseId: number | null }
interface SectionLite { id: number; name: string }

export default function SendToMoodleButton({ suggestedName, content }: { suggestedName: string; content: string }) {
  const [open, setOpen] = useState(false);
  const [courses, setCourses] = useState<TeachingCourse[]>([]);
  const [courseId, setCourseId] = useState("");
  const [sections, setSections] = useState<SectionLite[]>([]);
  const [sectionId, setSectionId] = useState("");
  const [name, setName] = useState(suggestedName);
  const [loadingCourses, setLoadingCourses] = useState(false);
  const [loadingSections, setLoadingSections] = useState(false);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [isError, setIsError] = useState(false);
  const [moodleUrl, setMoodleUrl] = useState<string | null>(null);

  useEffect(() => {
    if (!open || courses.length) return;
    setLoadingCourses(true);
    fetch("/api/teaching-courses")
      .then((r) => r.json())
      .then((d) => setCourses(d.courses ?? []))
      .finally(() => setLoadingCourses(false));
  }, [open, courses.length]);

  useEffect(() => {
    if (!courseId) { setSections([]); return; }
    setLoadingSections(true);
    setSectionId("");
    fetch(`/api/courses/${courseId}/sections`)
      .then((r) => r.json())
      .then((d) => setSections(d.sections ?? []))
      .finally(() => setLoadingSections(false));
  }, [courseId]);

  async function create() {
    setBusy(true);
    setMsg(null);
    try {
      const res = await fetch(`/api/courses/${courseId}/activities`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sectionId, modname: "page", name, content })
      });
      const data = await res.json();
      setIsError(!res.ok);
      if (!res.ok) { setMsg(data.error || "No se pudo crear la página"); return; }
      setMsg(`"${name}" se creó en Moodle.`);
      setMoodleUrl(data.moodleUrl);
    } catch (e: any) {
      setIsError(true);
      setMsg(e.message || "Error de red");
    } finally {
      setBusy(false);
    }
  }

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="inline-flex items-center gap-1 text-[11px] font-medium px-2 py-1 rounded-md border border-[var(--role-teacher)] text-[var(--role-teacher)] hover:bg-[var(--role-teacher-bg)]"
      >
        <Send className="w-3 h-3" /> Enviar a Moodle
      </button>
    );
  }

  return (
    <div className="mt-1.5 p-2 rounded-md border border-[var(--role-teacher)] bg-[var(--role-teacher-bg)] space-y-1.5">
      <select
        value={courseId}
        onChange={(e) => setCourseId(e.target.value)}
        disabled={loadingCourses}
        className="w-full text-[11px] border border-[var(--border-tertiary)] rounded px-1.5 py-1"
      >
        <option value="">{loadingCourses ? "Cargando cursos…" : "Selecciona un curso"}</option>
        {courses.filter((c) => c.moodleCourseId).map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
      </select>
      <select
        value={sectionId}
        onChange={(e) => setSectionId(e.target.value)}
        disabled={!courseId || loadingSections}
        className="w-full text-[11px] border border-[var(--border-tertiary)] rounded px-1.5 py-1"
      >
        <option value="">{loadingSections ? "Cargando bloques…" : "Selecciona un bloque"}</option>
        {sections.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
      </select>
      <input
        value={name}
        onChange={(e) => setName(e.target.value)}
        className="w-full text-[11px] border border-[var(--border-tertiary)] rounded px-1.5 py-1"
      />
      <div className="flex gap-1.5">
        <button
          onClick={create}
          disabled={busy || !courseId || !sectionId || !name}
          className="text-[11px] font-medium px-2 py-1 rounded-md bg-[var(--role-teacher)] text-white disabled:opacity-50"
        >
          {busy ? "Creando…" : "Crear página en Moodle"}
        </button>
        <button onClick={() => setOpen(false)} className="text-[11px] text-[var(--text-tertiary)]">Cancelar</button>
      </div>
      {msg && (
        <div className={`text-[11px] ${isError ? "text-red-600" : "text-green-700"}`}>
          {msg}{" "}
          {moodleUrl && <a href={moodleUrl} target="_blank" rel="noreferrer" className="underline">Abrir en Moodle</a>}
        </div>
      )}
    </div>
  );
}
