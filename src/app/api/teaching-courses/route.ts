import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "No autenticado" }, { status: 401 });

  const enrollments = await prisma.enrollment.findMany({
    where: { userId: session.user.id, roleInCourse: "teacher" },
    include: { course: { select: { id: true, name: true, moodleCourseId: true } } }
  });

  return NextResponse.json({
    courses: enrollments.map((e) => e.course)
  });
}
