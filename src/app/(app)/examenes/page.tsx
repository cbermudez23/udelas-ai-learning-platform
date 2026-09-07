import { FileCheck } from "lucide-react";
import { prisma } from "@/lib/prisma";
import ExamCenter from "@/components/ExamCenter";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";

export const dynamic = "force-dynamic";

export default async function ExamenesPage() {
  const session = await getServerSession(authOptions);
  // Solo los cursos del usuario (Moodle), como el resto de la Plataforma
  const courses = await prisma.course.findMany({
    where: { enrollments: { some: { userId: session!.user.id } } },
    select: { id: true, name: true },
    orderBy: { name: "asc" }
  });

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2 text-[13px] font-medium">
        <FileCheck className="w-4 h-4 text-[var(--clr-brand2)]" /> Exámenes IA
      </div>
      <ExamCenter courses={courses} isTeacher={["PROFESSOR", "ADMIN"].includes(session!.user.role)} />
    </div>
  );
}
