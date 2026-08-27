import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { LayoutDashboard, Sparkles, Lightbulb, TrendingUp, Clock } from "lucide-react";
import { format } from "date-fns";
import { es } from "date-fns/locale";

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

  const avgProgress =
    enrollments.length > 0
      ? Math.round(
          enrollments.reduce((s, e) => s + e.progressPercent, 0) / enrollments.length
        )
      : 0;

  const lowestCourse = [...enrollments].sort(
    (a, b) => a.progressPercent - b.progressPercent
  )[0];

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 text-[13px] font-medium">
        <LayoutDashboard className="w-4 h-4 text-[var(--clr-brand2)]" /> Dashboard
      </div>

      <div className="grid grid-cols-4 gap-3">
        <Stat label="Progreso general" value={`${avgProgress}%`} sub="Promedio de tus cursos" />
        <Stat label="Cursos activos" value={String(enrollments.length)} sub="Este período académico" />
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

      <div className="card">
        <div className="flex items-center justify-between mb-3">
          <div className="text-sm font-medium flex items-center gap-2">
            Mis cursos
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3">
          {enrollments.map((e) => (
            <div key={e.id} className="border border-[var(--border-tertiary)] rounded-lg p-3">
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
            </div>
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
            value="Continúa tu microcredencial"
            sub={`Estás al ${avgProgress}% del camino`}
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
