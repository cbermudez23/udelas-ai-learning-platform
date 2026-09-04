import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/admin";
import UsersTable from "@/components/admin/UsersTable";

export const dynamic = "force-dynamic";

export default async function AdminUsuarios() {
  const session = await requireAdmin();
  const users = await prisma.user.findMany({
    orderBy: [{ role: "asc" }, { name: "asc" }],
    select: {
      id: true, name: true, email: true, role: true, moodleUserId: true, createdAt: true,
      _count: { select: { enrollments: true, chatMessages: true } },
      ltiLink: { select: { id: true } }
    }
  });
  const rows = users.map((u) => ({
    id: u.id, name: u.name, email: u.email, role: u.role,
    moodleUserId: u.moodleUserId, viaLti: Boolean(u.ltiLink),
    enrollments: u._count.enrollments, messages: u._count.chatMessages,
    createdAt: u.createdAt.toISOString()
  }));
  return <UsersTable users={rows} currentUserId={session!.user.id} />;
}
