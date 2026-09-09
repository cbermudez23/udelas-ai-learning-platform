import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { moodle, moodleBaseUrl } from "@/lib/moodle";
import { textToHtml } from "@/lib/html";

export const dynamic = "force-dynamic";
export const maxDuration = 30;

async function assertCanEdit(courseId: string, userId: string, role: string) {
  if (role === "ADMIN") return;
  const enr = await prisma.enrollment.findUnique({ where: { userId_courseId: { userId, courseId } } });
  if (enr?.roleInCourse !== "teacher") {
    throw Object.assign(new Error("Solo el docente del curso o un administrador puede crear actividades"), { status: 403 });
  }
}

const ALLOWED = ["forum", "page", "url", "label", "folder", "assign"];

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "No autenticado" }, { status: 401 });

  const course = await prisma.course.findUnique({ where: { id: params.id } });
  if (!course) return NextResponse.json({ error: "Curso no encontrado" }, { status: 404 });
  if (!course.moodleCourseId) return NextResponse.json({ error: "Este curso no vive en Moodle" }, { status: 400 });

  try {
    await assertCanEdit(params.id, session.user.id, session.user.role);
    const { sectionId, modname, name, intro, content, externalurl, duedate, grade } = await req.json().catch(() => ({}));

    if (!sectionId || !modname || !name) {
      return NextResponse.json({ error: "Faltan datos: sección, tipo y nombre son obligatorios" }, { status: 400 });
    }
    if (!ALLOWED.includes(modname)) {
      return NextResponse.json({ error: `Tipo de actividad no soportado: ${modname}` }, { status: 400 });
    }

    const settings: Record<string, unknown> = {};
    if (modname === "page") settings.content = textToHtml(content || "");
    if (modname === "url") {
      if (!externalurl) return NextResponse.json({ error: "Falta la URL de destino" }, { status: 400 });
      settings.externalurl = externalurl;
    }
    if (modname === "assign") {
      settings.grade = grade ? Number(grade) : 100;
      // duedate llega como fecha "YYYY-MM-DD" desde el formulario; 0 = sin fecha límite.
      settings.duedate = duedate ? Math.floor(new Date(duedate).getTime() / 1000) : 0;
    }

    console.log(`[activities] Petición courseId=${params.id} sectionId=${sectionId} modname=${modname} name="${name}"`);
    const result = await moodle.createActivity({
      courseId: course.moodleCourseId,
      sectionId: Number(sectionId),
      modname: String(modname),
      name: String(name),
      intro: textToHtml(intro || ""),
      settings
    });
    console.log(`[activities] OK cmid=${result.cmid}`);

    return NextResponse.json({
      ok: true,
      result,
      moodleUrl: `${moodleBaseUrl()}/mod/${modname}/view.php?id=${result.cmid}`
    });
  } catch (e: any) {
    console.error("[activities] EXCEPCIÓN:", e);
    return NextResponse.json({ error: e.message || "No se pudo crear la actividad" }, { status: e.status || 500 });
  }
}
