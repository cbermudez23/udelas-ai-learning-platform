// src/app/api/courses/build/route.ts
// Recibe la estructura revisada en /admin/importar-curso (generada por
// /api/courses/import) y crea el curso en Moodle: curso + secciones
// renombradas + actividades (vía el plugin local_udelascreator).

import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { createCourseInMoodle } from "@/lib/course-creation";
import { moodle } from "@/lib/moodle";
import { stripHtml } from "@/lib/html";
import type { CourseActivity, CourseStructure } from "@/app/api/courses/import/route";

export const dynamic = "force-dynamic";

export interface BuildResult {
  success: boolean;
  courseId?: string;       // id local (Prisma)
  moodleCourseId?: number;
  courseUrl?: string;
  sectionsCreated: number;
  activitiesCreated: number;
  errors: string[];
}

// Tipos que acepta local_udelascreator_create_activity (ver src/lib/moodle.ts).
const SUPPORTED_MODULES = new Set(["forum", "page", "url", "label", "folder", "assign"]);

/** Quita <script> del HTML generado por la IA antes de mandarlo a Moodle. */
function safeHtml(html?: string): string {
  return (html || "").replace(/<script[\s\S]*?<\/script>/gi, "");
}

function activitySettings(act: CourseActivity): Record<string, unknown> {
  if (act.type === "page") return { content: safeHtml(act.content || act.intro) };
  if (act.type === "assign") return { grade: act.grade ?? 100, duedate: 0 };
  return {};
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session || session.user?.role !== "ADMIN") {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const { structure, categoryId, startDate } = (await req.json().catch(() => ({}))) as {
    structure?: CourseStructure;
    categoryId?: number;
    startDate?: string; // "YYYY-MM-DD"
  };
  if (!structure?.fullname || !structure.shortname || !structure.sections?.length || !categoryId) {
    return NextResponse.json(
      { error: "Faltan datos: estructura del curso (nombre, nombre corto, secciones) y categoría" },
      { status: 400 }
    );
  }

  const format = structure.format === "weeks" ? "weeks" : "topics";

  // 1. Curso (si esto falla no hay nada más que hacer)
  let course: Awaited<ReturnType<typeof createCourseInMoodle>>;
  try {
    course = await createCourseInMoodle({
      requestingUserId: session.user.id,
      fullname: structure.fullname,
      shortname: structure.shortname,
      categoryid: Number(categoryId),
      summary: stripHtml(structure.summary),
      startdate: startDate ? Math.floor(new Date(startDate).getTime() / 1000) : undefined,
      format
    });
  } catch (e: unknown) {
    console.error("[course-build] EXCEPCIÓN al crear el curso:", e);
    const msg = e instanceof Error ? e.message : "No se pudo crear el curso en Moodle.";
    return NextResponse.json({ error: msg }, { status: 500 });
  }

  const moodleCourseId = course.moodleCourseId!;
  const result: BuildResult = {
    success: true,
    courseId: course.id,
    moodleCourseId,
    courseUrl: course.moodleUrl ?? undefined,
    sectionsCreated: 0,
    activitiesCreated: 0,
    errors: []
  };

  // 2. Secciones: la sección i de la estructura va a la sección número i de
  // Moodle (0 = General). Se reutilizan las que Moodle crea por defecto.
  // Las secciones nuevas se agregan al final, así que esta lista inicial basta.
  const existing = await moodle.courseContents(moodleCourseId).catch(() => []);

  for (const [i, section] of structure.sections.entries()) {
    let sectionId: number;
    try {
      const found = existing.find((s) => s.section === i);
      if (found) {
        sectionId = found.id;
      } else {
        sectionId = (await moodle.createSection(moodleCourseId)).id;
        result.sectionsCreated++;
      }
      if (section.name) {
        await moodle.renameSection({ sectionid: sectionId, name: section.name, format });
      }
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      result.errors.push(`Sección ${i} "${section.name}": ${msg} (se omitieron sus actividades)`);
      continue;
    }

    // 3. Actividades de la sección
    for (const act of section.activities ?? []) {
      const label = `Sección ${i} · ${act.type} "${act.name}"`;
      if (!SUPPORTED_MODULES.has(act.type)) {
        result.errors.push(`${label}: tipo no soportado por el creador de actividades; créala manualmente en Moodle.`);
        continue;
      }
      if (act.type === "url") {
        result.errors.push(`${label}: la IA no proporciona la dirección del enlace; créala manualmente en Moodle.`);
        continue;
      }
      try {
        await moodle.createActivity({
          courseId: moodleCourseId,
          sectionId,
          modname: act.type,
          name: act.name,
          intro: safeHtml(act.type === "label" ? act.content || act.intro : act.intro),
          settings: activitySettings(act)
        });
        result.activitiesCreated++;
      } catch (e: unknown) {
        result.errors.push(`${label}: ${e instanceof Error ? e.message : String(e)}`);
      }
    }
  }

  console.log(
    `[course-build] Curso ${course.id} (moodleCourseId=${moodleCourseId}): ${result.activitiesCreated} actividades, ${result.errors.length} errores.`
  );
  return NextResponse.json(result);
}
