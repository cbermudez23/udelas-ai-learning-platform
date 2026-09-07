import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { storageConfigured } from "@/lib/storage";
import { createExport, courseReportBlocks, agentOutputBlocks, examBlocks, certificateBlocks, type ExportFormat } from "@/lib/exports";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/** GET → mis archivos */
export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({ error: "No autenticado" }, { status: 401 });
  const files = await prisma.exportFile.findMany({ where: { userId: session.user.id }, orderBy: { createdAt: "desc" }, take: 100 });
  return NextResponse.json({ configured: storageConfigured(), files });
}

/**
 * POST { kind, format, courseId?, examId?, withAnswers?, title?, content?, microcredentialId? }
 */
export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({ error: "No autenticado" }, { status: 401 });
  if (!storageConfigured()) return NextResponse.json({ error: "El almacenamiento de archivos no está configurado. Un administrador debe definir las variables SPACES_* en Render." }, { status: 503 });

  const body = await req.json().catch(() => ({}));
  const format: ExportFormat = body.format === "docx" ? "docx" : "pdf";
  const userId = session.user.id;
  const role = session.user.role;
  const author = session.user.name || undefined;

  try {
    switch (body.kind) {
      case "course_report": {
        if (!body.courseId) return NextResponse.json({ error: "Falta courseId" }, { status: 400 });
        const enr = await prisma.enrollment.findUnique({ where: { userId_courseId: { userId, courseId: body.courseId } } });
        if (role !== "ADMIN" && enr?.roleInCourse !== "teacher") return NextResponse.json({ error: "Solo el docente del curso o un administrador" }, { status: 403 });
        const { meta, blocks } = await courseReportBlocks(body.courseId);
        const f = await createExport({ userId, kind: "course_report", format, meta: { ...meta, author }, blocks, courseId: body.courseId });
        return NextResponse.json({ ok: true, file: f });
      }
      case "agent_output": {
        if (!["ADMIN", "PROFESSOR"].includes(role)) return NextResponse.json({ error: "Solo docentes y administradores" }, { status: 403 });
        const content = String(body.content || "").trim();
        if (!content) return NextResponse.json({ error: "Nada que exportar" }, { status: 400 });
        const title = String(body.title || "Material docente").slice(0, 120);
        const { meta, blocks } = agentOutputBlocks(title, content, body.courseName);
        const f = await createExport({ userId, kind: "agent_output", format, meta: { ...meta, author }, blocks });
        return NextResponse.json({ ok: true, file: f });
      }
      case "exam": {
        if (!body.examId) return NextResponse.json({ error: "Falta examId" }, { status: 400 });
        const withAnswers = Boolean(body.withAnswers) && ["ADMIN", "PROFESSOR"].includes(role);
        const { meta, blocks, courseId } = await examBlocks(body.examId, withAnswers);
        const f = await createExport({ userId, kind: "exam", format, meta: { ...meta, author }, blocks, courseId });
        return NextResponse.json({ ok: true, file: f });
      }
      case "certificate": {
        if (!body.microcredentialId) return NextResponse.json({ error: "Falta microcredentialId" }, { status: 400 });
        const { meta, blocks, courseId } = await certificateBlocks(userId, body.microcredentialId);
        const f = await createExport({ userId, kind: "certificate", format: "pdf", meta, blocks, courseId });
        return NextResponse.json({ ok: true, file: f });
      }
      default:
        return NextResponse.json({ error: "Tipo de exportación desconocido" }, { status: 400 });
    }
  } catch (e: any) {
    console.error("Error al exportar:", e);
    return NextResponse.json({ error: e.message || "Error al generar el archivo" }, { status: 500 });
  }
}

/** DELETE { id } */
export async function DELETE(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({ error: "No autenticado" }, { status: 401 });
  const { id } = await req.json().catch(() => ({}));
  const f = await prisma.exportFile.findUnique({ where: { id } });
  if (!f || (f.userId !== session.user.id && session.user.role !== "ADMIN")) return NextResponse.json({ error: "No encontrado" }, { status: 404 });
  const { deleteFile } = await import("@/lib/storage");
  await deleteFile(f.storageKey).catch(() => {});
  await prisma.exportFile.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
