"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

interface Category {
  id: number;
  name: string;
  depth?: number;
}

export default function CreateCourseForm() {
  const router = useRouter();
  const [categories, setCategories] = useState<Category[]>([]);
  const [loadingCategories, setLoadingCategories] = useState(true);
  const [fullname, setFullname] = useState("");
  const [shortname, setShortname] = useState("");
  const [categoryid, setCategoryid] = useState("");
  const [summary, setSummary] = useState("");
  const [format, setFormat] = useState<"topics" | "weeks">("topics");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/courses/create-in-moodle")
      .then((r) => r.json())
      .then((d) => {
        if (d.categories) setCategories(d.categories);
        else setError(d.error || "No se pudieron cargar las categorías");
      })
      .catch((e) => setError(e.message || "Error de red al cargar categorías"))
      .finally(() => setLoadingCategories(false));
  }, []);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch("/api/courses/create-in-moodle", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ fullname, shortname, categoryid, summary, format })
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "No se pudo crear el curso");
        return;
      }
      router.push(`/cursos/${data.course.id}`);
      router.refresh();
    } catch (e: any) {
      setError(e.message || "Error de red");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="card space-y-3 max-w-lg">
      <div>
        <label className="text-[11px] font-medium text-[var(--text-secondary)]">Nombre completo del curso</label>
        <input
          required
          value={fullname}
          onChange={(e) => setFullname(e.target.value)}
          placeholder="Ej. Introducción a la Programación"
          className="mt-1 w-full text-[12px] border border-[var(--border)] rounded-md px-2.5 py-1.5"
        />
      </div>
      <div>
        <label className="text-[11px] font-medium text-[var(--text-secondary)]">Nombre corto (único, sin espacios)</label>
        <input
          required
          value={shortname}
          onChange={(e) => setShortname(e.target.value)}
          placeholder="Ej. PROG101-2026"
          className="mt-1 w-full text-[12px] border border-[var(--border)] rounded-md px-2.5 py-1.5"
        />
        <div className="text-[10px] text-[var(--text-tertiary)] mt-0.5">
          Moodle lo rechazará si ya existe otro curso con este mismo nombre corto.
        </div>
      </div>
      <div>
        <label className="text-[11px] font-medium text-[var(--text-secondary)]">Categoría</label>
        <select
          required
          value={categoryid}
          onChange={(e) => setCategoryid(e.target.value)}
          disabled={loadingCategories}
          className="mt-1 w-full text-[12px] border border-[var(--border)] rounded-md px-2.5 py-1.5"
        >
          <option value="">{loadingCategories ? "Cargando…" : "Selecciona una categoría"}</option>
          {categories.map((c) => (
            <option key={c.id} value={c.id}>
              {"—".repeat(Math.max(0, (c.depth ?? 1) - 1))} {c.name}
            </option>
          ))}
        </select>
      </div>
      <div>
        <label className="text-[11px] font-medium text-[var(--text-secondary)]">Formato</label>
        <select
          value={format}
          onChange={(e) => setFormat(e.target.value as "topics" | "weeks")}
          className="mt-1 w-full text-[12px] border border-[var(--border)] rounded-md px-2.5 py-1.5"
        >
          <option value="topics">Por temas</option>
          <option value="weeks">Semanal</option>
        </select>
      </div>
      <div>
        <label className="text-[11px] font-medium text-[var(--text-secondary)]">Resumen (opcional)</label>
        <textarea
          value={summary}
          onChange={(e) => setSummary(e.target.value)}
          rows={3}
          className="mt-1 w-full text-[12px] border border-[var(--border)] rounded-md px-2.5 py-1.5"
        />
      </div>

      {error && <div className="text-[11px] text-red-600">{error}</div>}

      <div className="text-[10px] text-[var(--text-tertiary)]">
        El curso se crea directamente en Moodle y quedas matriculado como docente. Las actividades (tareas, foros, etc.)
        se agregan después, directamente en Moodle.
      </div>

      <button
        type="submit"
        disabled={submitting || loadingCategories}
        className="text-[12px] font-medium px-3 py-1.5 rounded-md bg-[var(--clr-brand2)] text-white disabled:opacity-50"
      >
        {submitting ? "Creando curso…" : "Crear curso en Moodle"}
      </button>
    </form>
  );
}
