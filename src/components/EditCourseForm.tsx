"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

interface Category {
  id: number;
  name: string;
  depth?: number;
}

export default function EditCourseForm({ courseId }: { courseId: string }) {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [categories, setCategories] = useState<Category[]>([]);
  const [fullname, setFullname] = useState("");
  const [categoryid, setCategoryid] = useState("");
  const [summary, setSummary] = useState("");
  const [format, setFormat] = useState<"topics" | "weeks" | "singleactivity">("topics");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch(`/api/courses/${courseId}/edit`)
      .then((r) => r.json())
      .then((d) => {
        if (d.error) { setError(d.error); return; }
        setFullname(d.course.fullname ?? "");
        setSummary(d.course.summary ?? "");
        setFormat((d.course.format as any) ?? "topics");
        setCategoryid(String(d.course.categoryid ?? ""));
        setCategories(d.categories ?? []);
      })
      .catch((e) => setError(e.message || "Error de red al cargar el curso"))
      .finally(() => setLoading(false));
  }, [courseId]);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch(`/api/courses/${courseId}/edit`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ fullname, categoryid, summary, format })
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error || "No se pudo guardar"); return; }
      router.push(`/cursos/${courseId}`);
      router.refresh();
    } catch (e: any) {
      setError(e.message || "Error de red");
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) return <div className="card text-[12px] text-[var(--text-tertiary)]">Cargando datos del curso…</div>;

  return (
    <form onSubmit={onSubmit} className="card space-y-3 max-w-lg">
      <div>
        <label className="text-[11px] font-medium text-[var(--text-secondary)]">Nombre completo del curso</label>
        <input
          required
          value={fullname}
          onChange={(e) => setFullname(e.target.value)}
          className="mt-1 w-full text-[12px] border border-[var(--border)] rounded-md px-2.5 py-1.5"
        />
      </div>
      <div>
        <label className="text-[11px] font-medium text-[var(--text-secondary)]">Categoría</label>
        <select
          required
          value={categoryid}
          onChange={(e) => setCategoryid(e.target.value)}
          className="mt-1 w-full text-[12px] border border-[var(--border)] rounded-md px-2.5 py-1.5"
        >
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
          onChange={(e) => setFormat(e.target.value as "topics" | "weeks" | "singleactivity")}
          className="mt-1 w-full text-[12px] border border-[var(--border)] rounded-md px-2.5 py-1.5"
        >
          <option value="topics">Secciones personalizadas</option>
          <option value="weeks">Secciones semanales</option>
          <option value="singleactivity">Actividad única</option>
        </select>
      </div>
      <div>
        <label className="text-[11px] font-medium text-[var(--text-secondary)]">Resumen</label>
        <textarea
          value={summary}
          onChange={(e) => setSummary(e.target.value)}
          rows={3}
          className="mt-1 w-full text-[12px] border border-[var(--border)] rounded-md px-2.5 py-1.5"
        />
      </div>

      {error && <div className="text-[11px] text-red-600">{error}</div>}

      <div className="text-[10px] text-[var(--text-tertiary)]">
        El nombre corto no se puede cambiar desde aquí — es el identificador único del curso en Moodle.
      </div>

      <div className="flex gap-2">
        <button
          type="submit"
          disabled={submitting}
          className="text-[12px] font-medium px-3 py-1.5 rounded-md bg-[var(--clr-brand2)] text-white disabled:opacity-50"
        >
          {submitting ? "Guardando…" : "Guardar cambios"}
        </button>
      </div>
    </form>
  );
}
