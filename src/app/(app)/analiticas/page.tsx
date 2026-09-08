import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { LineChart, Link as LinkIcon } from "lucide-react";
import Link from "next/link";
import AnalyticsCharts from "@/components/AnalyticsCharts";
import ExamProgressChart from "@/components/ExamProgressChart";

export const dynamic = "force-dynamic";

const AGENT_LABELS: Record<string, string> = {
  TUTOR: "Tutor IA",
  PROFESSOR_QUESTION_BANK: "Banco de preguntas",
  PROFESSOR_RUBRIC: "Rúbricas",
  PROFESSOR_STUDY_GUIDE: "Guías de estudio",
  PROFESSOR_FEEDBACK: "Retroalimentación",
  ADVISOR: "Asesor académico"
};

function Stat({ label, value, sub }: { label: string; value: string | number; sub?: string }) {
  return (
    <div className="card">
      <div className="text-[11px] text-[var(--text-tertiary)]">{label}</div>
      <div className="text-[20px] font-semibold mt-0.5">{value}</div>
      {sub && <div className="text-[10px] text-[var(--text-tertiary)]">{sub}</div>}
    </div>
  );
}

export default async function AnaliticasPage() {
  const session = await getServerSession(authOptions);
  const userId = session!.user.id;

  // Solo los cursos donde el usuario es ESTUDIANTE: esta vista es su propio
  // progreso de aprendizaje, no la de los cursos que imparte como docente.
  const enrollments = await prisma.enrollment.findMany({
    where: { userId, roleInCourse: "student" },
    include: { course: true, grades: true }
  });

  if (enrollments.length === 0) {
    const teaches = await prisma.enrollment.count({ where: { userId, roleInCourse: "teacher" } });
    return (
      <div className="space-y-3">
        <div className="flex items-center gap-2 text-[13px] font-medium">
          <LineChart className="w-4 h-4 text-[var(--clr-brand2)]" /> Analíticas de aprendizaje
        </div>
        <div className="card text-[12px] text-[var(--text-secondary)]">
          Esta vista muestra tu propio progreso como estudiante, y aún no tienes cursos matriculados como tal.
          {teaches > 0 && (
            <>
              {" "}Como docente, revisa el seguimiento de tus estudiantes desde{" "}
              <Link href="/cursos" className="text-[var(--clr-brand2)] hover:underline inline-flex items-center gap-1">
                Mis cursos <LinkIcon className="w-3 h-3" />
              </Link>{" "}
              o la analítica institucional en el{" "}
              <Link href="/admin/analitica" className="text-[var(--clr-brand2)] hover:underline inline-flex items-center gap-1">
                Panel de administración <LinkIcon className="w-3 h-3" />
              </Link>
              .
            </>
          )}
        </div>
      </div>
    );
  }

  const courseProgress = enrollments.map((e) => ({
    name: e.course.name.length > 16 ? e.course.name.slice(0, 16) + "…" : e.course.name,
    progress: e.progressPercent
  }));

  const gradeAverages = enrollments.map((e) => {
    const items = e.grades.filter((g) => g.label !== "Total del curso");
    const total = e.grades.find((g) => g.label === "Total del curso");
    const avg = total ? total.score : items.length ? items.reduce((a, g) => a + g.score, 0) / items.length : 0;
    return {
      name: e.course.name.length > 16 ? e.course.name.slice(0, 16) + "…" : e.course.name,
      promedio: Math.round(avg * 10) / 10
    };
  });

  const [chatCounts, attempts] = await Promise.all([
    prisma.chatMessage.groupBy({ by: ["agentType"], where: { userId, role: "user" }, _count: { _all: true } }),
    prisma.examAttempt.findMany({ where: { userId }, include: { exam: { select: { title: true } } }, orderBy: { completedAt: "desc" }, take: 8 })
  ]);

  const agentUsage = chatCounts.map((c) => ({ name: AGENT_LABELS[c.agentType] ?? c.agentType, value: c._count._all }));

  const avgProgress = Math.round(enrollments.reduce((s, e) => s + e.progressPercent, 0) / enrollments.length);
  const totals = gradeAverages.filter((g) => g.promedio > 0);
  const avgGrade = totals.length ? Math.round((totals.reduce((s, g) => s + g.promedio, 0) / totals.length) * 10) / 10 : null;
  const totalMessages = chatCounts.reduce((s, c) => s + c._count._all, 0);
  const avgExamScore = attempts.length ? Math.round((attempts.reduce((s, a) => s + a.score, 0) / attempts.length) * 10) / 10 : null;

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2 text-[13px] font-medium">
        <LineChart className="w-4 h-4 text-[var(--clr-brand2)]" /> Analíticas de aprendizaje
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <Stat label="Progreso general" value={`${avgProgress}%`} sub={`${enrollments.length} curso(s)`} />
        <Stat label="Promedio de notas" value={avgGrade !== null ? `${avgGrade}%` : "—"} />
        <Stat label="Mensajes al Tutor IA" value={totalMessages} />
        <Stat label="Promedio en Exámenes IA" value={avgExamScore !== null ? `${avgExamScore}%` : "—"} sub={`${attempts.length} intento(s)`} />
      </div>

      <AnalyticsCharts
        courseProgress={courseProgress}
        gradeAverages={gradeAverages}
        agentUsage={agentUsage.length > 0 ? agentUsage : [{ name: "Sin interacciones aún", value: 1 }]}
      />

      {attempts.length > 0 && (
        <div className="card">
          <div className="text-[12px] font-medium mb-2">Evolución en Exámenes IA</div>
          <ExamProgressChart
            attempts={[...attempts].reverse().map((a) => ({
              label: a.completedAt.toLocaleDateString("es-PA", { day: "2-digit", month: "2-digit" }),
              score: Math.round(a.score),
              examTitle: a.exam.title
            }))}
          />
        </div>
      )}

      {attempts.length > 0 && (
        <div className="card overflow-x-auto">
          <div className="text-[12px] font-medium mb-2">Últimos exámenes IA</div>
          <table className="w-full text-[11px]">
            <tbody>
              {attempts.map((a) => (
                <tr key={a.id} className="border-t border-[var(--border-tertiary)]">
                  <td className="py-1.5 pr-2">{a.exam.title}</td>
                  <td className="py-1.5 pr-2 text-[var(--text-tertiary)]">{a.completedAt.toLocaleDateString("es-PA")}</td>
                  <td className={`py-1.5 text-right font-medium ${a.score < 71 ? "text-[#B91C1C]" : "text-[#166534]"}`}>{Math.round(a.score)}%</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
