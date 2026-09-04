import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import Sidebar from "@/components/Sidebar";
import Header from "@/components/Header";

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
    <div className="h-screen flex flex-col overflow-hidden">
      <Header avatarInitials={session.user.avatarInitials} />
      <div className="flex flex-1 overflow-hidden">
        <Sidebar userName={session.user.name || "Usuario"} progress={avgProgress} role={session.user.role} />
        <main className="flex-1 overflow-y-auto p-4 bg-[var(--bg-tertiary)]">
          {children}
        </main>
      </div>
    </div>
  );
}
