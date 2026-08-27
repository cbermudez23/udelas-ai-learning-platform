import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { LineChart } from "lucide-react";
import AnalyticsCharts from "@/components/AnalyticsCharts";

const AGENT_LABELS: Record<string, string> = {
  TUTOR: "Tutor IA",
  PROFESSOR_QUESTION_BANK: "Banco de preguntas",
  PROFESSOR_RUBRIC: "Rúbricas",
  PROFESSOR_STUDY_GUIDE: "Guías de estudio",
  PROFESSOR_FEEDBACK: "Retroalimentación",
  ADVISOR: "Asesor académico"
};

export default async function AnaliticasPage() {
  const session = await getServerSession(authOptions);
  const userId = session!.user.id;

  const enrollments = await prisma.enrollment.findMany({
    where: { userId },
    include: { course: true, grades: true }
  });

  const courseProgress = enrollments.map((e) => ({
    name: e.course.name.length > 16 ? e.course.name.slice(0, 16) + "…" : e.course.name,
    progress: e.progressPercent
  }));

  const gradeAverages = enrollments.map((e) => {
    const scores = e.grades.map((g) => g.score);
    const avg = scores.length ? scores.reduce((a, b) => a + b, 0) / scores.length : 0;
    return {
      name: e.course.name.length > 16 ? e.course.name.slice(0, 16) + "…" : e.course.name,
      promedio: Math.round(avg * 10) / 10
    };
  });

  const chatCounts = await prisma.chatMessage.groupBy({
    by: ["agentType"],
    where: { userId, role: "user" },
    _count: { _all: true }
  });

  const agentUsage = chatCounts.map((c) => ({
    name: AGENT_LABELS[c.agentType] ?? c.agentType,
    value: c._count._all
  }));

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2 text-[13px] font-medium">
        <LineChart className="w-4 h-4 text-[var(--clr-brand2)]" /> Analíticas de aprendizaje
      </div>
      <AnalyticsCharts
        courseProgress={courseProgress}
        gradeAverages={gradeAverages}
        agentUsage={agentUsage.length > 0 ? agentUsage : [{ name: "Sin interacciones aún", value: 1 }]}
      />
    </div>
  );
}
