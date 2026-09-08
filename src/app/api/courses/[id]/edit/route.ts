import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { moodle } from "@/lib/moodle";
import { updateCourseInMoodle } from "@/lib/course-creation";
import { stripHtml } from "@/lib/html";

export const dynamic = "force-dynamic";
export const maxDuration = 30;

async function assertCanEdit(courseId: string, userId: string, role: string) {
  if (role === "ADMIN") return;
  const enr = await prisma.enrollment.findUnique({ where: { userId_courseId: { userId, courseId } } });
  if (enr?.roleInCourse !== "teacher") {
    throw Object.assign(new Error("Solo el docente del curso o un administrador puede editarlo"), { status: 403 });
  }
}

/** Datos actuales del curso (local + en vivo de Moodle: formato y categoría real), para precargar el formulario. */
export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "No autenticado" }, { status: 401 });

  const course = await prisma.course.findUnique({ where: { id: params.id } });
  if (!course) return NextResponse.json({ error: "Curso no encontrado" }, { status: 404 });
  if (!course.moodleCourseId) return NextResponse.json({ error: "Este curso no vive en Moodle" }, { status: 400 });

  try {
    await assertCanEdit(params.id, session.user.id, session.user.role);
    const [live, categories] = await Promise.all([
      moodle.courseById(course.moodleCourseId),
      moodle.categories()
    ]);
    return NextResponse.json({
      course: {
        id: course.id,
        fullname: live?.fullname ?? course.name,
        summary: stripHtml(live?.summary ?? course.summary ?? ""),
        format: live?.format ?? "topics",
        categoryid: live?.categoryid ?? live?.category
      },
      categories: categories.map((c) => ({ id: c.id, name: c.name, depth: c.depth }))
    });
  } catch (e: any) {
    console.error("[course-edit] EXCEPCIÓN al leer datos para editar:", e);
    return NextResponse.json({ error: e.message || "No se pudo leer el curso" }, { status: e.status || 500 });
  }
}

export async function PUT(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "No autenticado" }, { status: 401 });

  try {
    await assertCanEdit(params.id, session.user.id, session.user.role);
    const { fullname, categoryid, summary, format } = await req.json().catch(() => ({}));
    console.log(`[course-edit] Petición recibida para courseId=${params.id}`);
    const updated = await updateCourseInMoodle({
      courseId: params.id,
      fullname: fullname !== undefined ? String(fullname) : undefined,
      categoryid: categoryid !== undefined ? Number(categoryid) : undefined,
      summary: summary !== undefined ? String(summary) : undefined,
      format: format !== undefined ? String(format) : undefined
    });
    return NextResponse.json({ ok: true, course: updated });
  } catch (e: any) {
    console.error("[course-edit] EXCEPCIÓN al guardar edición:", e);
    return NextResponse.json({ error: e.message || "No se pudo actualizar el curso" }, { status: e.status || 500 });
  }
}
