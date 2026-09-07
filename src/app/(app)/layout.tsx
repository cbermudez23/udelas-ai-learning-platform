import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import AppShell from "@/components/AppShell";

export default async function AppLayout({
  children
}: {
  children: React.ReactNode;
}) {
  const session = await getServerSession(authOptions);
  if (!session) redirect("/login");

  const enrollments = await prisma.enrollment.findMany({
    where: { userId: session.user.id }
  });
  const avgProgress =
    enrollments.length > 0
      ? Math.round(
          enrollments.reduce((sum, e) => sum + e.progressPercent, 0) /
            enrollments.length
        )
      : 0;

  return (
    <AppShell
      avatarInitials={session.user.avatarInitials}
      userName={session.user.name || "Usuario"}
      progress={avgProgress}
      role={session.user.role}
    >
      {children}
    </AppShell>
  );
}
