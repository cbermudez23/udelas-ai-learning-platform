import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { Award, Check } from "lucide-react";

export default async function MicrocredencialesPage() {
  const session = await getServerSession(authOptions);
  const microcredentials = await prisma.microcredential.findMany({
    include: {
      progress: { where: { userId: session!.user.id } }
    }
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
            <div className="text-[13px] font-medium">{mc.name}</div>
            <div className="text-[11px] text-[var(--text-tertiary)] mb-3">{mc.description}</div>
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
          No hay microcredenciales configuradas todavía.
        </div>
      )}
    </div>
  );
}
