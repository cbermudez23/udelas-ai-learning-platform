/**
 * Seguimiento docente: construye, para un curso, el resumen de cada estudiante
 * (progreso, nota total, tareas vencidas sin nota) y marca a los que están en riesgo.
 *
 * Criterios de riesgo (configurables aquí):
 *  - Nota total del curso por debajo de RISK_GRADE (%).
 *  - Tiene 1 o más tareas vencidas sin calificación.
 *  - Progreso de finalización por debajo de RISK_PROGRESS (%) cuando ya hay tareas vencidas.
 */
import { prisma } from "@/lib/prisma";

export const RISK_GRADE = 71;      // UDELAS: 71 es la nota mínima de aprobación habitual
export const RISK_PROGRESS = 30;

export interface StudentSummary {
  userId: string;
  name: string;
  email: string;
  progressPercent: number;
  total: number | null;          // % total del curso, si Moodle lo calculó
  grades: { label: string; score: number; rawScore: number | null; maxScore: number | null }[];
  gradedCount: number;
  overdueUngraded: string[];     // nombres de tareas vencidas sin nota
  atRisk: boolean;
  riskReasons: string[];
}

export interface CourseTeacherSummary {
  courseId: string;
  courseName: string;
  students: StudentSummary[];
  studentCount: number;
  atRiskCount: number;
  averageTotal: number | null;
  assignmentsDue: { name: string; dueDate: Date | null; gradedCount: number }[];
}

export async function buildCourseTeacherSummary(courseId: string): Promise<CourseTeacherSummary | null> {
  const course = await prisma.course.findUnique({
    where: { id: courseId },
    include: {
      assignments: { orderBy: { dueDate: "asc" } },
      enrollments: {
        where: { roleInCourse: "student" },
        include: { user: { select: { id: true, name: true, email: true } }, grades: true },
        orderBy: { user: { name: "asc" } }
      }
    }
  });
  if (!course) return null;

  const now = new Date();
  const overdue = course.assignments.filter((a) => a.dueDate && a.dueDate < now);

  const students: StudentSummary[] = course.enrollments.map((e) => {
    const totalItem = e.grades.find((g) => g.label === "Total del curso");
    const items = e.grades.filter((g) => g.label !== "Total del curso");
    const total = totalItem ? totalItem.score : items.length ? items.reduce((s, g) => s + g.score, 0) / items.length : null;

    // Una tarea vencida cuenta como "sin nota" si no hay ningún ítem de nota con su mismo nombre
    const gradedLabels = new Set(items.map((g) => g.label.toLowerCase().trim()));
    const overdueUngraded = overdue.filter((a) => !gradedLabels.has(a.name.toLowerCase().trim())).map((a) => a.name);

    const reasons: string[] = [];
    if (total !== null && total < RISK_GRADE) reasons.push(`Nota total ${Math.round(total)}% (mínimo ${RISK_GRADE}%)`);
    if (overdueUngraded.length > 0) reasons.push(`${overdueUngraded.length} tarea(s) vencida(s) sin nota`);
    if (overdue.length > 0 && e.progressPercent < RISK_PROGRESS) reasons.push(`Progreso ${e.progressPercent}%`);

    return {
      userId: e.user.id,
      name: e.user.name,
      email: e.user.email,
      progressPercent: e.progressPercent,
      total: total !== null ? Math.round(total * 10) / 10 : null,
      grades: items.map((g) => ({ label: g.label, score: g.score, rawScore: g.rawScore, maxScore: g.maxScore })),
      gradedCount: items.length,
      overdueUngraded,
      atRisk: reasons.length > 0,
      riskReasons: reasons
    };
  });

  const totals = students.map((s) => s.total).filter((t): t is number => t !== null);
  const assignmentsDue = course.assignments.map((a) => ({
    name: a.name,
    dueDate: a.dueDate,
    gradedCount: students.filter((s) => s.grades.some((g) => g.label.toLowerCase().trim() === a.name.toLowerCase().trim())).length
  }));

  return {
    courseId: course.id,
    courseName: course.name,
    students,
    studentCount: students.length,
    atRiskCount: students.filter((s) => s.atRisk).length,
    averageTotal: totals.length ? Math.round((totals.reduce((a, b) => a + b, 0) / totals.length) * 10) / 10 : null,
    assignmentsDue
  };
}

/** Cursos donde el usuario es docente, con su resumen. */
export async function teacherOverview(userId: string): Promise<CourseTeacherSummary[]> {
  const teaching = await prisma.enrollment.findMany({ where: { userId, roleInCourse: "teacher" }, select: { courseId: true } });
  const out: CourseTeacherSummary[] = [];
  for (const t of teaching) {
    const s = await buildCourseTeacherSummary(t.courseId);
    if (s) out.push(s);
  }
  return out;
}

/** Texto compacto para el contexto de los Agentes docentes. */
export function teacherContextText(summaries: CourseTeacherSummary[]): string {
  return summaries
    .map((c) => {
      const risk = c.students.filter((s) => s.atRisk).map((s) => `${s.name} (${s.riskReasons.join("; ")})`).join(", ");
      const tasks = c.assignmentsDue.map((a) => `${a.name}${a.dueDate ? ` vence ${a.dueDate.toLocaleDateString("es-PA")}` : ""} · ${a.gradedCount}/${c.studentCount} calificados`).join("; ");
      return [
        `- ${c.courseName}: ${c.studentCount} estudiante(s), promedio ${c.averageTotal ?? "sin notas"}${c.averageTotal !== null ? "%" : ""}, ${c.atRiskCount} en riesgo.`,
        tasks ? `  Tareas: ${tasks}` : "",
        risk ? `  En riesgo: ${risk}` : ""
      ].filter(Boolean).join("\n");
    })
    .join("\n");
}
