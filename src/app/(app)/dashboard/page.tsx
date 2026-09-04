import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { LayoutDashboard, Sparkles, Lightbulb, TrendingUp, Clock } from "lucide-react";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import Link from "next/link";
import { teacherOverview } from "@/lib/teacher";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const session = await getServerSession(authOptions);
  const userId = session!.user.id;

  const enrollments = await prisma.enrollment.findMany({
    where: { userId },
    include: { course: true, grades: true }
  });

  const events = await prisma.calendarEvent.findMany({
    where: { userId, date: { gte: new Date() } },
    orderBy: { date: "asc" },
    take: 3
  });

  const studentEnrollments = enrollments.filter((e) => e.roleInCourse !== "teacher");
  const teaching = enrollments.some((e) => e.roleInCourse === "teacher") ? await teacherOverview(userId) : [];

  const avgProgress =
    studentEnrollments.length > 0
      ? Math.round(
          studentEnrollments.reduce((s, e) => s + e.progressPercent, 0) / studentEnrollments.length
        )
      : 0;

  const lowestCourse = [...studentEnrollments].sort(
    (a, b) => a.progressPercent - b.progressPercent
  )[0];

  // Recomendación "Próximo paso": la tarea pendiente más cercana; si no hay, la Biblioteca IA
  const nextAssignment = await prisma.assignment.findFirst({
    where: { dueDate: { gte: new Date() }, course: { enrollments: { some: { userId } } } },
    orderBy: { dueDate: "asc" },
    include: { course: { select: { name: true } } }
  });
  const nextStep = nextAssignment
    ? { value: `Entregar: ${nextAssignment.name}`, sub: `${nextAssignment.course.name} · ${format(nextAssignment.dueDate!, "d 'de' MMMM", { locale: es })}` }
    : { value: "Explora la Biblioteca IA", sub: "Materiales y apoyo para tus cursos" };

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 text-[13px] font-medium">
        <LayoutDashboard className="w-4 h-4 text-[var(--clr-brand2)]" /> Dashboard
      </div>

      <div className="grid grid-cols-4 gap-3">
        <Stat label="Progreso general" value={`${avgProgress}%`} sub="Promedio de tus cursos" />
        <Stat label="Cursos activos" value={String(studentEnrollments.length)} sub="Este período académico" />
        <Stat
          label="Próximo evento"
          value={events[0] ? format(events[0].date, "d MMM", { locale: es }) : "—"}
          sub={events[0]?.title ?? "Sin eventos próximos"}
        />
        <Stat
          label="Curso a reforzar"
          value={lowestCourse ? `${lowestCourse.progressPercent}%` : "—"}
          sub={lowestCourse?.course.name ?? "—"}
        />
      </div>

      {teaching.length > 0 && (
        <div className="card">
          <div className="text-sm font-medium mb-2">Mis cursos como docente</div>
          <div className="grid grid-cols-2 gap-3">
            {teaching.map((t) => (
              <Link key={t.courseId} href={`/cursos/${t.courseId}`} className="border border-[var(--border-tertiary)] rounded-lg p-3 hover:shadow-md transition-shadow block">
                <div className="text-[13px] font-medium">{t.courseName}</div>
                <div className="text-[11px] text-[var(--text-tertiary)] mt-1">
                  {t.studentCount} estudiante(s) · promedio {t.averageTotal !== null ? `${t.averageTotal}%` : "—"}
                </div>
                <div className={`text-[11px] mt-1 font-medium ${t.atRiskCount ? "text-[#B91C1C]" : "text-[#166534]"}`}>
                  {t.atRiskCount ? `${t.atRiskCount} estudiante(s) en riesgo` : "Todos al día"}
                </div>
              </Link>
            ))}
          </div>
        </div>
      )}

      <div className="card">
        <div className="flex items-center justify-between mb-3">
          <div className="text-sm font-medium flex items-center gap-2">
            Mis cursos
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3">
          {studentEnrollments.length === 0 && <div className="text-[11px] text-[var(--text-tertiary)] col-span-2">No estás matriculado como estudiante en ningún curso.</div>}
          {studentEnrollments.map((e) => (
            <Link href={`/cursos/${e.id ? e.course.id : ""}`} key={e.id} className="border border-[var(--border-tertiary)] rounded-lg p-3 block hover:shadow-md transition-shadow">
              <div className="text-[11px] text-[var(--clr-brand2)] bg-[#EEF3FF] inline-block px-2 py-0.5 rounded-full mb-1">
                {e.course.category}
              </div>
              <div className="text-[13px] font-medium">{e.course.name}</div>
              <div className="text-[11px] text-[var(--text-tertiary)] mb-2">
                {e.course.professorName} · {e.progressPercent}% completado
              </div>
              <div className="prog-bar">
                <div
                  className={`prog-fill ${
                    e.progressPercent >= 80 ? "green" : e.progressPercent >= 50 ? "" : "red"
                  }`}
                  style={{ width: `${e.progressPercent}%` }}
                />
              </div>
            </Link>
          ))}
        </div>
      </div>

      <div className="card">
        <div className="flex items-center justify-between mb-3">
          <div className="text-sm font-medium flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-[var(--clr-brand2)]" /> Recomendaciones del
            Tutor IA
          </div>
          <span className="chip chip-purple">Personalizado</span>
        </div>
        <div className="flex gap-2 flex-wrap">
          <RecoCard
            icon={<Lightbulb className="w-3.5 h-3.5" />}
            color="#5530A0"
            bg="#F0EAFF"
            title="Reforzar ahora"
            value={lowestCourse?.course.name ?? "Sin datos aún"}
            sub="Basado en tu progreso actual"
          />
          <RecoCard
            icon={<TrendingUp className="w-3.5 h-3.5" />}
            color="#1A4DB0"
            bg="#EEF3FF"
            title="Próximo paso"
            value={nextStep.value}
            sub={nextStep.sub}
          />
          <RecoCard
            icon={<Clock className="w-3.5 h-3.5" />}
            color="#1A7A45"
            bg="#E4F5EC"
            title="Próxima actividad"
            value={events[0]?.title ?? "Sin actividades próximas"}
            sub={events[0] ? format(events[0].date, "d 'de' MMMM", { locale: es }) : ""}
          />
        </div>
      </div>
    </div>
  );
}

function Stat({ label, value, sub }: { label: string; value: string; sub: string }) {
  return (
    <div className="card">
      <div className="text-[11px] text-[var(--text-secondary)] mb-1">{label}</div>
      <div className="text-[22px] font-medium">{value}</div>
      <div className="text-[11px] text-[var(--text-tertiary)] mt-0.5 truncate">{sub}</div>
    </div>
  );
}

function RecoCard({
  icon,
  color,
  bg,
  title,
  value,
  sub
}: {
  icon: React.ReactNode;
  color: string;
  bg: string;
  title: string;
  value: string;
  sub: string;
}) {
  return (
    <div className="flex-1 min-w-[160px] rounded-lg p-2.5" style={{ background: bg }}>
      <div
        className="text-[11px] font-medium mb-1 flex items-center gap-1"
        style={{ color }}
      >
        {icon} {title}
      </div>
      <div className="text-[12px]">{value}</div>
      <div className="text-[10px] mt-0.5" style={{ color, opacity: 0.75 }}>
        {sub}
      </div>
    </div>
  );
}
