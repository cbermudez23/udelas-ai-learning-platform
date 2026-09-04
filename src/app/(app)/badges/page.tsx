import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { BadgeCheck, Award } from "lucide-react";

export const dynamic = "force-dynamic";

export default async function BadgesPage() {
  const session = await getServerSession(authOptions);
  const earned = await prisma.userBadge.findMany({
    where: { userId: session!.user.id },
    include: { badge: { include: { course: { select: { name: true } } } } },
    orderBy: { earnedAt: "desc" }
  });
  const earnedIds = new Set(earned.map((e) => e.badgeId));
  // Insignias locales aún no obtenidas (catálogo institucional); las de Moodle solo se ven cuando se obtienen
  const pendingLocal = await prisma.badge.findMany({ where: { source: "LOCAL", id: { notIn: [...earnedIds] } } });

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2 text-[13px] font-medium">
        <BadgeCheck className="w-4 h-4 text-[var(--clr-brand2)]" /> Credenciales digitales
      </div>

      <div className="card">
        <div className="text-[12px] font-medium mb-2">Obtenidas ({earned.length})</div>
        {earned.length === 0 && (
          <div className="text-[12px] text-[var(--text-tertiary)]">
            Aún no tienes insignias. Las que ganes en Moodle aparecerán aquí automáticamente.
          </div>
        )}
        <div className="grid grid-cols-4 gap-2">
          {earned.map((e) => (
            <div key={e.id} className="text-center p-2.5">
              <div className="w-[64px] h-[64px] rounded-full flex items-center justify-center text-xl mx-auto mb-1.5 bg-[#FDF3E3] overflow-hidden">
                {e.badge.imageUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={e.badge.imageUrl} alt={e.badge.name} className="w-full h-full object-cover" />
                ) : e.badge.source === "MOODLE" ? (
                  <Award className="w-7 h-7 text-[#B45309]" />
                ) : (
                  e.badge.icon
                )}
              </div>
              <div className="text-[11px] font-medium">{e.badge.name}</div>
              <div className="text-[10px] text-[var(--text-tertiary)]">
                {e.badge.course?.name ? `${e.badge.course.name} · ` : ""}{e.earnedAt.toLocaleDateString("es-PA")}
              </div>
              {e.badge.issuer && <div className="text-[10px] text-[var(--text-tertiary)]">Emite: {e.badge.issuer}</div>}
            </div>
          ))}
        </div>
      </div>

      {pendingLocal.length > 0 && (
        <div className="card">
          <div className="text-[12px] font-medium mb-2">Por obtener</div>
          <div className="grid grid-cols-4 gap-2">
            {pendingLocal.map((b) => (
              <div key={b.id} className="text-center p-2.5">
                <div className="w-[52px] h-[52px] rounded-full flex items-center justify-center text-xl mx-auto mb-1.5 bg-[var(--bg-secondary)] opacity-40 grayscale">{b.icon}</div>
                <div className="text-[11px] font-medium">{b.name}</div>
                <div className="text-[10px] text-[var(--text-tertiary)]">Pendiente</div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
