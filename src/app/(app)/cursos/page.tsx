import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { BookOpen } from "lucide-react";

const THUMB_BG: Record<string, string> = {
  blue: "#EEF3FF",
  amber: "#FDF3E3",
  green: "#E4F5EC",
  red: "#FDEAEA"
};

export default async function CursosPage() {
  const session = await getServerSession(authOptions);
  const enrollments = await prisma.enrollment.findMany({
    where: { userId: session!.user.id },
    include: { course: true }
  });

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2 text-[13px] font-medium">
        <BookOpen className="w-4 h-4 text-[var(--clr-brand2)]" /> Mis cursos
      </div>
      <div className="grid grid-cols-2 gap-3">
        {enrollments.map((e) => (
          <div key={e.id} className="card">
            <div
              className="h-[72px] rounded-md mb-2 flex items-center justify-center text-xl"
              style={{ background: THUMB_BG[e.course.colorTheme] ?? "#EEF3FF" }}
            >
              📘
            </div>
            <div className="text-[10px] font-medium text-[var(--clr-brand2)] bg-[#EEF3FF] inline-block px-2 py-0.5 rounded-full mb-1">
              {e.course.category}
            </div>
            <div className="text-[12px] font-medium mb-1">{e.course.name}</div>
            <div className="text-[11px] text-[var(--text-tertiary)]">
              {e.course.professorName} · {e.progressPercent}% completado
            </div>
            <div className="prog-bar mt-1.5">
              <div className="prog-fill" style={{ width: `${e.progressPercent}%` }} />
            </div>
          </div>
        ))}
        {enrollments.length === 0 && (
          <div className="text-sm text-[var(--text-tertiary)]">
            No tienes cursos matriculados todavía.
          </div>
        )}
      </div>
    </div>
  );
}
