import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { BarChart3 } from "lucide-react";

function statusFor(avg: number | null) {
  if (avg === null) return { label: "Sin notas", cls: "chip-blue" };
  if (avg >= 90) return { label: "Excelente", cls: "chip-blue" };
  if (avg >= 75) return { label: "En curso", cls: "chip-green" };
  return { label: "Atención", cls: "chip-amber" };
}

export default async function CalificacionesPage() {
  const session = await getServerSession(authOptions);
  const enrollments = await prisma.enrollment.findMany({
    where: { userId: session!.user.id },
    include: { course: true, grades: true }
  });

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2 text-[13px] font-medium">
        <BarChart3 className="w-4 h-4 text-[var(--clr-brand2)]" /> Calificaciones
      </div>
      <div className="card overflow-x-auto">
        <table className="w-full text-[12px] border-collapse">
          <thead>
            <tr className="bg-[var(--bg-secondary)]">
              <th className="text-left font-medium px-2.5 py-2">Curso</th>
              <th className="font-medium px-2 py-2">Parcial 1</th>
              <th className="font-medium px-2 py-2">Parcial 2</th>
              <th className="font-medium px-2 py-2">Final</th>
              <th className="font-medium px-2 py-2">Promedio</th>
              <th className="font-medium px-2 py-2">Estado</th>
            </tr>
          </thead>
          <tbody>
            {enrollments.map((e) => {
              const g = (label: string) =>
                e.grades.find((gr) => gr.label === label)?.score ?? null;
              const scores = e.grades.map((gr) => gr.score);
              const avg =
                scores.length > 0
                  ? Math.round((scores.reduce((a, b) => a + b, 0) / scores.length) * 10) / 10
                  : null;
              const status = statusFor(avg);
              return (
                <tr key={e.id} className="border-b border-[var(--border-tertiary)]">
                  <td className="px-2.5 py-2">{e.course.name}</td>
                  <td className="text-center px-2 py-2">{g("Parcial 1") ?? "—"}</td>
                  <td className="text-center px-2 py-2">{g("Parcial 2") ?? "—"}</td>
                  <td className="text-center px-2 py-2">{g("Final") ?? "—"}</td>
                  <td className="text-center px-2 py-2 font-medium">{avg ?? "—"}</td>
                  <td className="text-center px-2 py-2">
                    <span className={`chip ${status.cls}`}>{status.label}</span>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
