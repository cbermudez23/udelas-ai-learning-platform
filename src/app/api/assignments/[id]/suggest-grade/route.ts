import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { suggestGrade } from "@/lib/grading";
import { AIConfigError } from "@/lib/ai";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "No autenticado" }, { status: 401 });
  const assignment = await prisma.assignment.findUnique({ where: { id: params.id }, select: { courseId: true } });
  if (!assignment) return NextResponse.json({ error: "Tarea no encontrada" }, { status: 404 });
  if (session.user.role !== "ADMIN") {
    const enr = await prisma.enrollment.findUnique({ where: { userId_courseId: { userId: session.user.id, courseId: assignment.courseId } } });
    if (enr?.roleInCourse !== "teacher") return NextResponse.json({ error: "Solo el docente del curso o un administrador" }, { status: 403 });
  }

  const { moodleUserId, rubricText } = await req.json().catch(() => ({}));
  if (!moodleUserId) return NextResponse.json({ error: "Falta moodleUserId" }, { status: 400 });

  try {
    const suggestion = await suggestGrade({ assignmentId: params.id, moodleUserId: Number(moodleUserId), rubricText });
    return NextResponse.json({ suggestion });
  } catch (e: any) {
    if (e instanceof AIConfigError) {
      return NextResponse.json({ error: "La calificación asistida requiere ANTHROPIC_API_KEY u OPENAI_API_KEY configurada en el servidor." }, { status: 503 });
    }
    return NextResponse.json({ error: e.message || "No se pudo generar la sugerencia." }, { status: 400 });
  }
}
