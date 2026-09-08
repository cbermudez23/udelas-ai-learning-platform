import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { GraduationCap } from "lucide-react";
import CreateCourseForm from "@/components/CreateCourseForm";

export const dynamic = "force-dynamic";

export default async function CrearCursoPage() {
  const session = await getServerSession(authOptions);
  if (!session) redirect("/login");
  if (session.user.role !== "PROFESSOR" && session.user.role !== "ADMIN") {
    redirect("/cursos");
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2 text-[13px] font-medium">
        <GraduationCap className="w-4 h-4 text-[var(--clr-brand2)]" /> Crear curso
      </div>
      <CreateCourseForm />
    </div>
  );
}
