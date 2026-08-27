import { FileCheck } from "lucide-react";
import { prisma } from "@/lib/prisma";
import ExamCenter from "@/components/ExamCenter";

export default async function ExamenesPage() {
  const courses = await prisma.course.findMany({ select: { id: true, name: true } });

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2 text-[13px] font-medium">
        <FileCheck className="w-4 h-4 text-[var(--clr-brand2)]" /> Exámenes IA
      </div>
      <ExamCenter courses={courses} />
    </div>
  );
}
