"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import MoodleSyncButton from "@/components/MoodleSyncButton";

type Row = {
  id: string; name: string; shortName: string | null; category: string; professorName: string; source: string;
  moodleUrl: string | null; lastSyncedAt: string | null; enrollments: number; contents: number; assignments: number;
};

export default function CoursesTable({ courses }: { courses: Row[] }) {
  const router = useRouter();
  const [busy, setBusy] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const localCount = courses.filter((c) => c.source !== "MOODLE").length;

  async function del(body: any, okMsg: string, key: string) {
    setBusy(key); setMsg(null);
    try {
      const res = await fetch("/api/admin/courses", { method: "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      const data = await res.json();
      if (!res.ok) setMsg(data.error || "Error"); else { setMsg(okMsg); router.refresh(); }
    } catch (e: any) { setMsg(e.message); } finally { setBusy(null); }
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between gap-3">
        <div className="text-[11px] text-[var(--text-tertiary)]">{courses.length} curso(s) {msg && `· ${msg}`}</div>
        <div className="flex items-center gap-2">
          {localCount > 0 && (
            <button
              onClick={() => confirm(`¿Eliminar los ${localCount} curso(s) locales/demo con sus matrículas y notas? Los cursos de Moodle no se tocan.`) && del({ source: "LOCAL" }, "Cursos demo eliminados.", "all-local")}
              disabled={busy !== null}
              className="text-[11px] px-2.5 py-1.5 rounded-md border border-[#B91C1C] text-[#B91C1C] hover:bg-[#FDEAEA] disabled:opacity-50"
            >
              Eliminar cursos demo ({localCount})
            </button>
          )}
          <MoodleSyncButton scope="all" label="Sincronizar todo Moodle" />
        </div>
      </div>
      <div className="card overflow-x-auto p-0">
        <table className="w-full text-[11px]">
          <thead className="text-left text-[10px] uppercase tracking-wide text-[var(--text-tertiary)]">
            <tr>
              <th className="px-3 py-2">Curso</th><th className="px-3 py-2">Categoría</th><th className="px-3 py-2">Docente</th>
              <th className="px-3 py-2">Origen</th><th className="px-3 py-2 text-right">Matrículas</th><th className="px-3 py-2 text-right">Contenidos</th>
              <th className="px-3 py-2 text-right">Tareas</th><th className="px-3 py-2">Última sincronización</th><th className="px-3 py-2 text-right">Acciones</th>
            </tr>
          </thead>
          <tbody>
            {courses.map((c) => (
              <tr key={c.id} className="border-t border-[var(--border-tertiary)]">
                <td className="px-3 py-2 font-medium">
                  {c.moodleUrl ? <a href={c.moodleUrl} target="_blank" rel="noreferrer" className="hover:text-[var(--clr-brand2)]">{c.name}</a> : c.name}
                  {c.shortName && <span className="text-[var(--text-tertiary)] font-normal"> · {c.shortName}</span>}
                </td>
                <td className="px-3 py-2">{c.category}</td>
                <td className="px-3 py-2 text-[var(--text-secondary)]">{c.professorName}</td>
                <td className="px-3 py-2">
                  {c.source === "MOODLE"
                    ? <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-[#FDF3E3] text-[#B45309]">Moodle</span>
                    : <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-[#EEF3FF] text-[var(--clr-brand2)]">Local / demo</span>}
                </td>
                <td className="px-3 py-2 text-right">{c.enrollments}</td>
                <td className="px-3 py-2 text-right">{c.contents}</td>
                <td className="px-3 py-2 text-right">{c.assignments}</td>
                <td className="px-3 py-2 text-[var(--text-tertiary)]">{c.lastSyncedAt ? new Date(c.lastSyncedAt).toLocaleString("es-PA") : "—"}</td>
                <td className="px-3 py-2 text-right">
                  <button
                    onClick={() => confirm(`¿Eliminar "${c.name}" de esta plataforma (con sus matrículas y notas)?${c.source === "MOODLE" ? " Volverá a aparecer en la próxima sincronización si sigue existiendo en Moodle." : ""}`) && del({ id: c.id }, `"${c.name}" eliminado.`, c.id)}
                    disabled={busy !== null}
                    className="text-[#B91C1C] hover:underline disabled:opacity-40"
                  >
                    Eliminar
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
