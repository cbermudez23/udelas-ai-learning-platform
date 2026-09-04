import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { Award, Check, ExternalLink } from "lucide-react";

export const dynamic = "force-dynamic";

export default async function MicrocredencialesPage() {
  const session = await getServerSession(authOptions);
  // Microcredenciales de los cursos del usuario (Moodle) + las institucionales sin curso
  const microcredentials = await prisma.microcredential.findMany({
    where: { OR: [{ courseId: null }, { course: { enrollments: { some: { userId: session!.user.id } } } }] },
    include: { progress: { where: { userId: session!.user.id } } },
    orderBy: { name: "asc" }
  });

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2 text-[13px] font-medium">
        <Award className="w-4 h-4 text-[var(--clr-brand2)]" /> Microcredenciales
      </div>
      {microcredentials.map((mc) => {
        const steps = mc.steps as { label: string }[];
        const currentStep = mc.progress[0]?.currentStep ?? 0;
        return (
          <div key={mc.id} className="card">
            <div className="flex items-start justify-between gap-2">
              <div>
                <div className="text-[13px] font-medium flex items-center gap-2">
                  {mc.name}
                  {mc.source === "MOODLE" && <span className="text-[10px] font-medium text-[#B45309] bg-[#FDF3E3] px-2 py-0.5 rounded-full">Moodle</span>}
                  {mc.progress[0]?.earnedAt && <span className="text-[10px] font-medium text-[#166534] bg-[#E4F5EC] px-2 py-0.5 rounded-full">Obtenida · {mc.progress[0].earnedAt.toLocaleDateString("es-PA")}</span>}
                </div>
                <div className="text-[11px] text-[var(--text-tertiary)] mb-3">{mc.description} · {currentStep}/{steps.length} pasos</div>
              </div>
              {mc.moodleUrl && <a href={mc.moodleUrl} target="_blank" rel="noreferrer" className="text-[10px] text-[var(--clr-brand2)] inline-flex items-center gap-1 hover:underline shrink-0">Ver en Moodle <ExternalLink className="w-3 h-3" /></a>}
            </div>
            <div className="flex items-center overflow-x-auto gap-0 py-2">
              {steps.map((s, i) => (
                <div key={i} className="flex items-center">
                  <div className="text-center flex-shrink-0 w-[70px]">
                    <div
                      className={`w-[42px] h-[42px] rounded-full flex items-center justify-center text-[13px] mx-auto mb-1 border-2 ${
                        i < currentStep
                          ? "bg-[#E4F5EC] border-[#22A05B] text-[#22A05B]"
                          : i === currentStep
                          ? "bg-[#EEF3FF] border-[var(--clr-brand2)] text-[var(--clr-brand2)]"
                          : "bg-[var(--bg-secondary)] border-[var(--border-tertiary)] text-[var(--text-tertiary)]"
                      }`}
                    >
                      {i < currentStep ? <Check className="w-4 h-4" /> : i + 1}
                    </div>
                    <div className="text-[9px] text-[var(--text-secondary)] leading-tight">
                      {s.label}
                    </div>
                  </div>
                  {i < steps.length - 1 && (
                    <div className="w-5 h-0.5 bg-[var(--border-secondary)] mb-4 shrink-0" />
                  )}
                </div>
              ))}
            </div>
          </div>
        );
      })}
      {microcredentials.length === 0 && (
        <div className="text-[12px] text-[var(--text-tertiary)]">
          Aún no tienes microcredenciales. Se generan automáticamente a partir de las competencias o la finalización de tus cursos en Moodle.
        </div>
      )}
    </div>
  );
}
