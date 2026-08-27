import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { BadgeCheck } from "lucide-react";

export default async function BadgesPage() {
  const session = await getServerSession(authOptions);
  const allBadges = await prisma.badge.findMany();
  const earned = await prisma.userBadge.findMany({
    where: { userId: session!.user.id }
  });
  const earnedIds = new Set(earned.map((e) => e.badgeId));

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2 text-[13px] font-medium">
        <BadgeCheck className="w-4 h-4 text-[var(--clr-brand2)]" /> Credenciales digitales
      </div>
      <div className="card">
        <div className="grid grid-cols-4 gap-2">
          {allBadges.map((b) => {
            const won = earnedIds.has(b.id);
            return (
              <div key={b.id} className="text-center p-2.5">
                <div
                  className={`w-[52px] h-[52px] rounded-full flex items-center justify-center text-xl mx-auto mb-1.5 ${
                    won ? "bg-[#FDF3E3]" : "bg-[var(--bg-secondary)] opacity-40 grayscale"
                  }`}
                >
                  {b.icon}
                </div>
                <div className="text-[11px] font-medium">{b.name}</div>
                <div className="text-[10px] text-[var(--text-tertiary)]">
                  {won ? "Obtenida" : "Pendiente"}
                </div>
              </div>
            );
          })}
        </div>
        {allBadges.length === 0 && (
          <div className="text-[12px] text-[var(--text-tertiary)]">
            No hay credenciales digitales configuradas todavía.
          </div>
        )}
      </div>
    </div>
  );
}
