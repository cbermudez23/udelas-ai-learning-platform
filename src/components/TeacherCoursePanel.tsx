import Link from "next/link";
import type { CourseTeacherSummary } from "@/lib/teacher";

export default function TeacherCoursePanel({ summary }: { summary: CourseTeacherSummary }) {
  const s = summary;
  const now = new Date();
  return (
    <div className="space-y-3">
      <div className="grid grid-cols-4 gap-3">
        <div className="card"><div className="text-[11px] text-[var(--text-tertiary)]">Estudiantes</div><div className="text-[20px] font-semibold">{s.studentCount}</div></div>
        <div className="card"><div className="text-[11px] text-[var(--text-tertiary)]">Promedio del curso</div><div className="text-[20px] font-semibold">{s.averageTotal !== null ? `${s.averageTotal}%` : "—"}</div></div>
        <div className="card"><div className="text-[11px] text-[var(--text-tertiary)]">En riesgo</div><div className={`text-[20px] font-semibold ${s.atRiskCount ? "text-[#B91C1C]" : "text-[#166534]"}`}>{s.atRiskCount}</div></div>
        <div className="card"><div className="text-[11px] text-[var(--text-tertiary)]">Tareas</div><div className="text-[20px] font-semibold">{s.assignmentsDue.length}</div>
          <div className="text-[10px] text-[var(--text-tertiary)]">{s.assignmentsDue.filter((a) => a.dueDate && a.dueDate < now).length} vencida(s)</div></div>
      </div>

      <div className="card p-0 overflow-x-auto">
        <div className="px-3 py-2 text-[12px] font-medium border-b border-[var(--border-tertiary)]">Seguimiento de estudiantes</div>
        {s.students.length === 0 && <div className="px-3 py-3 text-[11px] text-[var(--text-tertiary)]">Aún no hay estudiantes sincronizados en este curso.</div>}
        {s.students.length > 0 && (
          <table className="w-full text-[11px]">
            <thead className="text-left text-[10px] uppercase tracking-wide text-[var(--text-tertiary)]">
              <tr>
                <th className="px-3 py-2">Estudiante</th><th className="px-3 py-2">Progreso</th>
                <th className="px-3 py-2 text-right">Nota total</th><th className="px-3 py-2 text-right">Ítems calificados</th>
                <th className="px-3 py-2">Estado</th>
              </tr>
            </thead>
            <tbody>
              {s.students.map((st) => (
                <tr key={st.userId} className={`border-t border-[var(--border-tertiary)] ${st.atRisk ? "bg-[#FFF7F7]" : ""}`}>
                  <td className="px-3 py-2"><div className="font-medium">{st.name}</div><div className="text-[10px] text-[var(--text-tertiary)]">{st.email}</div></td>
                  <td className="px-3 py-2 w-[140px]">
                    <div className="flex items-center gap-2"><div className="prog-bar flex-1"><div className="prog-fill" style={{ width: `${st.progressPercent}%` }} /></div><span className="text-[10px] w-8 text-right">{st.progressPercent}%</span></div>
                  </td>
                  <td className={`px-3 py-2 text-right font-medium ${st.total !== null && st.total < 71 ? "text-[#B91C1C]" : ""}`}>{st.total !== null ? `${st.total}%` : "—"}</td>
                  <td className="px-3 py-2 text-right">{st.gradedCount}</td>
                  <td className="px-3 py-2">
                    {st.atRisk
                      ? <div><span className="text-[10px] px-1.5 py-0.5 rounded-full bg-[#FDEAEA] text-[#B91C1C] font-medium">En riesgo</span><div className="text-[10px] text-[var(--text-tertiary)] mt-0.5">{st.riskReasons.join(" · ")}</div></div>
                      : <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-[#E4F5EC] text-[#166534] font-medium">Al día</span>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="card">
          <div className="text-[12px] font-medium mb-2">Estado de las tareas</div>
          {s.assignmentsDue.length === 0 && <div className="text-[11px] text-[var(--text-tertiary)]">Sin tareas.</div>}
          {s.assignmentsDue.map((a) => {
            const late = a.dueDate && a.dueDate < now;
            return (
              <div key={a.name} className="flex justify-between text-[11px] py-1 border-t border-[var(--border-tertiary)] first:border-0">
                <div><div className="font-medium">{a.name}</div><div className={`text-[10px] ${late ? "text-[#B91C1C]" : "text-[var(--text-tertiary)]"}`}>{a.dueDate ? `${late ? "Venció" : "Vence"} ${a.dueDate.toLocaleDateString("es-PA")}` : "Sin fecha"}</div></div>
                <div className="text-right"><div className="font-medium">{a.gradedCount}/{s.studentCount}</div><div className="text-[10px] text-[var(--text-tertiary)]">calificados</div></div>
              </div>
            );
          })}
        </div>
        <div className="card">
          <div className="text-[12px] font-medium mb-2">Agentes docentes con este curso</div>
          <div className="text-[11px] text-[var(--text-secondary)] mb-2">Los agentes ya conocen los contenidos, tareas y el estado de tus estudiantes. Ejemplos:</div>
          <ul className="text-[11px] space-y-1">
            <li><Link href="/agentes/PROFESSOR_QUESTION_BANK" className="text-[var(--clr-brand2)] hover:underline">Banco de preguntas</Link> — "Genera 10 preguntas sobre los contenidos de la sección 2"</li>
            <li><Link href="/agentes/PROFESSOR_RUBRIC" className="text-[var(--clr-brand2)] hover:underline">Rúbricas</Link> — "Crea una rúbrica para Tarea prueba 1"</li>
            <li><Link href="/agentes/PROFESSOR_FEEDBACK" className="text-[var(--clr-brand2)] hover:underline">Retroalimentación</Link> — "¿Qué mensaje envío a los estudiantes en riesgo?"</li>
            <li><Link href="/agentes/PROFESSOR_STUDY_GUIDE" className="text-[var(--clr-brand2)] hover:underline">Guía de estudio</Link> — "Prepara una guía para la próxima tarea"</li>
          </ul>
        </div>
      </div>
    </div>
  );
}
