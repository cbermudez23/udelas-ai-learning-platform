import { redirect, notFound } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { Pencil } from "lucide-react";
import EditCourseForm from "@/components/EditCourseForm";

export const dynamic = "force-dynamic";

export default async function EditarCursoPage({ params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session) redirect("/login");

  const course = await prisma.course.findUnique({ where: { id: params.id } });
  if (!course) notFound();

  if (session.user.role !== "ADMIN") {
    const enr = await prisma.enrollment.findUnique({
      where: { userId_courseId: { userId: session.user.id, courseId: params.id } }
    });
    if (enr?.roleInCourse !== "teacher") redirect(`/cursos/${params.id}`);
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2 text-[13px] font-medium">
        <Pencil className="w-4 h-4 text-[var(--clr-brand2)]" /> Editar curso
      </div>
      <EditCourseForm courseId={course.id} />
    </div>
  );
}
