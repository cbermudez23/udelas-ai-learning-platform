import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { listSubmissions } from "@/lib/grading";

export const dynamic = "force-dynamic";

async function assertTeacher(userId: string, courseId: string, role: string) {
  if (role === "ADMIN") return;
  const enr = await prisma.enrollment.findUnique({ where: { userId_courseId: { userId, courseId } } });
  if (enr?.roleInCourse !== "teacher") throw new Error("Solo el docente del curso o un administrador");
}

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "No autenticado" }, { status: 401 });
  try {
    const assignment = await prisma.assignment.findUnique({ where: { id: params.id }, select: { courseId: true } });
    if (!assignment) return NextResponse.json({ error: "Tarea no encontrada" }, { status: 404 });
    await assertTeacher(session.user.id, assignment.courseId, session.user.role);
    const { submissions } = await listSubmissions(params.id);
    return NextResponse.json({ submissions });
  } catch (e: any) {
    return NextResponse.json({ error: e.message || "Error" }, { status: 400 });
  }
}
