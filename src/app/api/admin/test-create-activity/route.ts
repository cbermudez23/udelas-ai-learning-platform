import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { moodle } from "@/lib/moodle";

export const dynamic = "force-dynamic";
export const maxDuration = 30;

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session || session.user.role !== "ADMIN") {
    return NextResponse.json({ error: "Solo administradores" }, { status: 403 });
  }
  const courseid = req.nextUrl.searchParams.get("courseid");
  if (!courseid) return NextResponse.json({ error: "Falta courseid" }, { status: 400 });
  try {
    const sections = await moodle.courseContents(Number(courseid));
    return NextResponse.json({ sections: sections.map((s) => ({ id: s.id, name: s.name, section: s.section })) });
  } catch (e: any) {
    return NextResponse.json({ error: e.message || "No se pudieron leer las secciones" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session || session.user.role !== "ADMIN") {
    return NextResponse.json({ error: "Solo administradores pueden usar esta página de prueba" }, { status: 403 });
  }

  const { courseid, sectionid, modname, name, intro, settings } = await req.json().catch(() => ({}));
  if (!courseid || !sectionid || !modname || !name) {
    return NextResponse.json({ error: "Faltan datos: courseid, sectionid, modname y name son obligatorios" }, { status: 400 });
  }

  let parsedSettings: Record<string, unknown> = {};
  if (settings) {
    try {
      parsedSettings = JSON.parse(settings);
    } catch {
      return NextResponse.json({ error: "El campo 'settings' no es JSON válido" }, { status: 400 });
    }
  }

  console.log(`[test-create-activity] courseid=${courseid} sectionid=${sectionid} modname=${modname} name="${name}"`);
  try {
    const result = await moodle.createActivity({
      courseId: Number(courseid),
      sectionId: Number(sectionid),
      modname: String(modname),
      name: String(name),
      intro: intro ? String(intro) : "",
      settings: parsedSettings
    });
    console.log(`[test-create-activity] OK:`, result);
    return NextResponse.json({ ok: true, result });
  } catch (e: any) {
    console.error("[test-create-activity] EXCEPCIÓN:", e);
    return NextResponse.json({ error: e.message || "Falló la llamada" }, { status: 500 });
  }
}
