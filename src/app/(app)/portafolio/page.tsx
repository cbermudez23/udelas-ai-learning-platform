import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import Portfolio from "@/components/Portfolio";
import AchievementsPanel from "@/components/AchievementsPanel";

export const dynamic = "force-dynamic";

export default async function PortafolioPage() {
  const session = await getServerSession(authOptions);
  const userId = session!.user.id;

  const [microcredentials, badges, certificates] = await Promise.all([
    prisma.userMicrocredentialProgress.findMany({
      where: { userId, earnedAt: { not: null } },
      include: { microcredential: { include: { course: { select: { name: true } } } } },
      orderBy: { earnedAt: "desc" }
    }),
    prisma.userBadge.findMany({
      where: { userId },
      include: { badge: { include: { course: { select: { name: true } } } } },
      orderBy: { earnedAt: "desc" }
    }),
    prisma.exportFile.findMany({
      where: { userId, kind: "certificate" },
      orderBy: { createdAt: "desc" }
    })
  ]);

  return (
    <div className="space-y-3">
      <AchievementsPanel
        microcredentials={microcredentials.map((m) => ({
          id: m.microcredentialId,
          name: m.microcredential.name,
          courseName: m.microcredential.course?.name || null,
          earnedAt: m.earnedAt!.toISOString()
        }))}
        badges={badges.map((b) => ({
          id: b.badgeId,
          name: b.badge.name,
          courseName: b.badge.course?.name || null,
          issuer: b.badge.issuer,
          earnedAt: b.earnedAt.toISOString()
        }))}
        certificates={certificates.map((c) => ({ id: c.id, title: c.title, createdAt: c.createdAt.toISOString() }))}
      />
      <Portfolio />
    </div>
  );
}
