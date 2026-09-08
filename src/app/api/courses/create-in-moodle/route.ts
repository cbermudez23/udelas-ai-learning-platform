import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { createCourseInMoodle } from "@/lib/course-creation";
import { moodle } from "@/lib/moodle";

export const dynamic = "force-dynamic";
export const maxDuration = 30;

/** Lista de categorías de Moodle, para el selector del formulario de creación. */
export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "No autenticado" }, { status: 401 });
  try {
    const categories = await moodle.categories();
    return NextResponse.json({ categories: categories.map((c) => ({ id: c.id, name: c.name, depth: c.depth })) });
  } catch (e: any) {
    console.error("[create-course] EXCEPCIÓN al leer categorías:", e);
    return NextResponse.json({ error: e.message || "No se pudieron leer las categorías de Moodle." }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "No autenticado" }, { status: 401 });
  if (session.user.role !== "PROFESSOR" && session.user.role !== "ADMIN") {
    return NextResponse.json({ error: "Solo docentes o administradores pueden crear cursos" }, { status: 403 });
  }

  const { fullname, shortname, categoryid, summary, startdate, format } = await req.json().catch(() => ({}));
  if (!fullname || !shortname || !categoryid) {
    return NextResponse.json({ error: "Faltan datos: nombre completo, nombre corto y categoría son obligatorios" }, { status: 400 });
  }

  console.log(`[create-course] Petición recibida: fullname="${fullname}" shortname="${shortname}" categoryid=${categoryid}`);
  try {
    const course = await createCourseInMoodle({
      requestingUserId: session.user.id,
      fullname: String(fullname),
      shortname: String(shortname),
      categoryid: Number(categoryid),
      summary: summary ? String(summary) : undefined,
      startdate: startdate ? Number(startdate) : undefined,
      format: format ? String(format) : undefined
    });
    console.log(`[create-course] Resultado OK. courseId local=${course.id} moodleCourseId=${course.moodleCourseId}`);
    return NextResponse.json({ ok: true, course });
  } catch (e: any) {
    console.error("[create-course] EXCEPCIÓN al crear curso en Moodle:", e);
    // Mensaje típico de Moodle si el shortname ya existe: "shortnametaken"
    const msg = e?.message || "No se pudo crear el curso en Moodle.";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
