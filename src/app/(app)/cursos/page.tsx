import Link from "next/link";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { BookOpen } from "lucide-react";
import MoodleSyncButton from "@/components/MoodleSyncButton";

const THUMB_BG: Record<string, string> = {
  blue: "#EEF3FF",
  amber: "#FDF3E3",
  green: "#E4F5EC",
  red: "#FDEAEA"
};

export const dynamic = "force-dynamic";

export default async function CursosPage() {
  const session = await getServerSession(authOptions);
  const enrollments = await prisma.enrollment.findMany({
    where: { userId: session!.user.id },
    include: { course: { include: { _count: { select: { contents: true, assignments: true } } } } },
    orderBy: { course: { name: "asc" } }
  });

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 text-[13px] font-medium">
          <BookOpen className="w-4 h-4 text-[var(--clr-brand2)]" /> Mis cursos
        </div>
        <MoodleSyncButton />
      </div>
      <div className="grid grid-cols-2 gap-3">
        {enrollments.map((e) => (
          <Link key={e.id} href={`/cursos/${e.course.id}`} className="card block hover:shadow-md transition-shadow">
            <div
              className="h-[72px] rounded-md mb-2 flex items-center justify-center text-xl"
              style={{ background: THUMB_BG[e.course.colorTheme] ?? "#EEF3FF" }}
            >
              📘
            </div>
            <div className="flex items-center gap-1.5 mb-1">
              <span className="text-[10px] font-medium text-[var(--clr-brand2)] bg-[#EEF3FF] inline-block px-2 py-0.5 rounded-full">
                {e.course.category}
              </span>
              {e.course.source === "MOODLE" && (
                <span className="text-[10px] font-medium text-[#B45309] bg-[#FDF3E3] inline-block px-2 py-0.5 rounded-full">
                  Moodle
                </span>
              )}
              {e.roleInCourse === "teacher" && (
                <span className="text-[10px] font-medium text-[#166534] bg-[#E4F5EC] inline-block px-2 py-0.5 rounded-full">
                  Docente
                </span>
              )}
            </div>
            <div className="text-[12px] font-medium mb-1">{e.course.name}</div>
            <div className="text-[11px] text-[var(--text-tertiary)]">
              {e.course.professorName} · {e.progressPercent}% completado
            </div>
            <div className="text-[10px] text-[var(--text-tertiary)] mt-0.5">
              {e.course._count.contents} contenidos · {e.course._count.assignments} tareas
            </div>
            <div className="prog-bar mt-1.5">
              <div className="prog-fill" style={{ width: `${e.progressPercent}%` }} />
            </div>
          </Link>
        ))}
        {enrollments.length === 0 && (
          <div className="text-sm text-[var(--text-tertiary)] col-span-2">
            No tienes cursos todavía. Si estás matriculado en Moodle, pulsa "Actualizar desde Moodle".
          </div>
        )}
      </div>
    </div>
  );
}
