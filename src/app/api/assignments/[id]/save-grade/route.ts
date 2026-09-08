import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { saveGradeToMoodle } from "@/lib/grading";

export const dynamic = "force-dynamic";
export const maxDuration = 30;

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  console.log(`[save-grade] Petición recibida para assignment=${params.id}`);
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "No autenticado" }, { status: 401 });
  const assignment = await prisma.assignment.findUnique({ where: { id: params.id }, select: { courseId: true } });
  if (!assignment) return NextResponse.json({ error: "Tarea no encontrada" }, { status: 404 });
  if (session.user.role !== "ADMIN") {
    const enr = await prisma.enrollment.findUnique({ where: { userId_courseId: { userId: session.user.id, courseId: assignment.courseId } } });
    if (enr?.roleInCourse !== "teacher") return NextResponse.json({ error: "Solo el docente del curso o un administrador" }, { status: 403 });
  }

  const { moodleUserId, grade, feedback } = await req.json().catch(() => ({}));
  console.log(`[save-grade] Datos: moodleUserId=${moodleUserId} grade=${grade} feedbackLength=${(feedback || "").length}`);
  if (!moodleUserId || grade === undefined) return NextResponse.json({ error: "Faltan datos" }, { status: 400 });
  const g = Number(grade);
  if (!Number.isFinite(g) || g < 0 || g > 100) return NextResponse.json({ error: "La nota debe estar entre 0 y 100" }, { status: 400 });

  try {
    console.log(`[save-grade] Llamando a saveGradeToMoodle...`);
    const { warning } = await saveGradeToMoodle({ assignmentId: params.id, moodleUserId: Number(moodleUserId), grade: g, feedback: String(feedback || "") });
    console.log(`[save-grade] Resultado OK. warning=${warning || "(ninguno)"}`);
    return NextResponse.json({ ok: true, warning });
  } catch (e: any) {
    console.error("[save-grade] EXCEPCIÓN al guardar calificación en Moodle:", e);
    return NextResponse.json({ error: e.message || "No se pudo guardar en Moodle." }, { status: 500 });
  }
}
