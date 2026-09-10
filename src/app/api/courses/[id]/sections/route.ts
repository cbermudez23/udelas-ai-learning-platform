import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { moodle } from "@/lib/moodle";

export const dynamic = "force-dynamic";
export const maxDuration = 30;

async function assertCanEdit(courseId: string, userId: string, role: string) {
  if (role === "ADMIN") return;
  const enr = await prisma.enrollment.findUnique({ where: { userId_courseId: { userId, courseId } } });
  if (enr?.roleInCourse !== "teacher") {
    throw Object.assign(new Error("Solo el docente del curso o un administrador puede editar la estructura"), { status: 403 });
  }
}

/** Secciones actuales del curso, leídas en vivo de Moodle (id, nombre, número). */
export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "No autenticado" }, { status: 401 });

  const course = await prisma.course.findUnique({ where: { id: params.id } });
  if (!course) return NextResponse.json({ error: "Curso no encontrado" }, { status: 404 });
  if (!course.moodleCourseId) return NextResponse.json({ error: "Este curso no vive en Moodle" }, { status: 400 });

  try {
    await assertCanEdit(params.id, session.user.id, session.user.role);
    const sections = await moodle.courseContents(course.moodleCourseId);
    return NextResponse.json({
      sections: sections.map((s) => ({ id: s.id, name: s.name, section: s.section }))
    });
  } catch (e: any) {
    console.error("[sections] EXCEPCIÓN al leer secciones:", e);
    return NextResponse.json({ error: e.message || "No se pudieron leer las secciones" }, { status: e.status || 500 });
  }
}

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "No autenticado" }, { status: 401 });

  const course = await prisma.course.findUnique({ where: { id: params.id } });
  if (!course) return NextResponse.json({ error: "Curso no encontrado" }, { status: 404 });
  if (!course.moodleCourseId) return NextResponse.json({ error: "Este curso no vive en Moodle" }, { status: 400 });

  try {
    await assertCanEdit(params.id, session.user.id, session.user.role);
    const { action, name, targetSectionId } = await req.json().catch(() => ({}));

    if (action === "create_section") {
      if (name) {
        const existing = await moodle.courseContents(course.moodleCourseId);
        const normalized = String(name).trim().toLowerCase();
        const dup = existing.find((s) => s.name.trim().toLowerCase() === normalized);
        if (dup) {
          return NextResponse.json({ error: `Ya existe un bloque llamado "${name}" (sección ${dup.section}). Elige otro nombre, o si de verdad quieres otro con el mismo nombre, cámbialo manualmente después en Moodle.` }, { status: 409 });
        }
      }
      const section = await moodle.createSection(course.moodleCourseId);
      if (name) {
        const live = await moodle.courseById(course.moodleCourseId);
        await moodle.renameSection({ sectionid: section.id, name: String(name), format: live?.format ?? "topics" });
      }
      return NextResponse.json({ ok: true, section });
    }

    if (action === "rename_section") {
      if (!targetSectionId || !name) return NextResponse.json({ error: "Faltan datos: sectionId y nombre" }, { status: 400 });
      const live = await moodle.courseById(course.moodleCourseId);
      await moodle.renameSection({ sectionid: Number(targetSectionId), name: String(name), format: live?.format ?? "topics" });
      return NextResponse.json({ ok: true });
    }

    if (action === "create_subsection") {
      if (!targetSectionId) return NextResponse.json({ error: "Falta targetSectionId (¿en qué bloque va la subsección?)" }, { status: 400 });
      await moodle.createSubsection({ courseId: course.moodleCourseId, targetSectionId: Number(targetSectionId) });
      return NextResponse.json({ ok: true, note: "Subsección creada con nombre por defecto — renómbrala directamente en Moodle." });
    }

    return NextResponse.json({ error: "Acción no reconocida" }, { status: 400 });
  } catch (e: any) {
    console.error("[sections] EXCEPCIÓN:", e);
    return NextResponse.json({ error: e.message || "No se pudo completar la acción" }, { status: e.status || 500 });
  }
}
