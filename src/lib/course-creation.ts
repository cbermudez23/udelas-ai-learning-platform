/**
 * Creación de cursos por el docente ("cascarón"): la Plataforma crea el
 * curso directamente en Moodle (nombre, categoría, formato, fechas) y
 * matricula al docente como "Editing teacher" — usando únicamente
 * funciones estándar y estables del núcleo de Moodle
 * (core_course_create_courses, enrol_manual_enrol_users).
 *
 * Alcance deliberadamente limitado: Moodle NO expone vía servicios web la
 * creación de actividades (tareas, foros, páginas, cuestionarios) —
 * investigado y confirmado el 9-sep-2026; los plugins de terceros
 * disponibles en ese momento no eran una fuente confiable para instalar en
 * producción (repositorio inaccesible, o resultaron ser solo un puente de
 * protocolo sin esa función). El docente agrega el contenido y las
 * actividades directamente en Moodle, con su editor habitual, una vez que
 * el curso ya existe.
 */
import { prisma } from "@/lib/prisma";
import { moodle, moodleBaseUrl } from "@/lib/moodle";

export async function updateCourseInMoodle(opts: {
  courseId: string; // id local (Prisma)
  fullname?: string;
  categoryid?: number;
  summary?: string;
  format?: string;
}) {
  const course = await prisma.course.findUnique({ where: { id: opts.courseId } });
  if (!course) throw new Error("Curso no encontrado.");
  if (!course.moodleCourseId) {
    throw new Error("Este curso no vive en Moodle (no tiene moodleCourseId), no se puede editar por esta vía.");
  }

  console.log(`[course-edit] Actualizando curso moodleCourseId=${course.moodleCourseId}...`);
  await moodle.updateCourse({
    id: course.moodleCourseId,
    fullname: opts.fullname,
    categoryid: opts.categoryid,
    summary: opts.summary,
    format: opts.format
  });
  console.log(`[course-edit] Moodle actualizado. Refrescando copia local...`);

  let categoryName: string | undefined;
  if (opts.categoryid !== undefined) {
    const categories = await moodle.categories().catch(() => []);
    categoryName = categories.find((c) => c.id === opts.categoryid)?.name;
  }

  const updated = await prisma.course.update({
    where: { id: course.id },
    data: {
      ...(opts.fullname !== undefined ? { name: opts.fullname } : {}),
      ...(categoryName !== undefined ? { category: categoryName, faculty: categoryName } : {}),
      ...(opts.summary !== undefined ? { summary: opts.summary } : {}),
      lastSyncedAt: new Date()
    }
  });

  console.log(`[course-edit] Copia local actualizada, id=${updated.id}`);
  return updated;
}

export async function createCourseInMoodle(opts: {
  requestingUserId: string; // id local (Prisma) del docente que crea el curso
  fullname: string;
  shortname: string;
  categoryid: number;
  summary?: string;
  startdate?: number; // timestamp unix, opcional
  format?: string; // 'topics' | 'weeks'
}) {
  const teacher = await prisma.user.findUnique({ where: { id: opts.requestingUserId } });
  if (!teacher) throw new Error("Usuario no encontrado.");
  if (!teacher.moodleUserId) {
    throw new Error(
      "Tu cuenta todavía no está vinculada a un usuario de Moodle. Debes haber iniciado sesión al menos una vez vía LTI, o pedirle a un administrador que la vincule."
    );
  }

  console.log(`[course-creation] Creando curso "${opts.fullname}" (${opts.shortname}) en categoría ${opts.categoryid}...`);
  const created = await moodle.createCourse({
    fullname: opts.fullname,
    shortname: opts.shortname,
    categoryid: opts.categoryid,
    summary: opts.summary,
    startdate: opts.startdate,
    format: opts.format
  });
  console.log(`[course-creation] Curso creado en Moodle: id=${created.id} shortname=${created.shortname}`);

  console.log(`[course-creation] Matriculando al docente (moodleUserId=${teacher.moodleUserId}) como Editing teacher (roleid=3)...`);
  await moodle.enrolUser({ courseid: created.id, userid: teacher.moodleUserId, roleid: 3 });

  const categories = await moodle.categories().catch((e) => {
    console.warn("[course-creation] No se pudo leer categorías (no crítico):", e?.message);
    return [];
  });
  const cat = categories.find((c) => c.id === opts.categoryid);

  const course = await prisma.course.create({
    data: {
      name: opts.fullname,
      category: cat?.name ?? "Sin categoría",
      professorName: teacher.name,
      source: "MOODLE",
      moodleCourseId: created.id,
      shortName: created.shortname,
      summary: opts.summary ?? null,
      faculty: cat?.name ?? null,
      moodleUrl: `${moodleBaseUrl()}/course/view.php?id=${created.id}`,
      lastSyncedAt: new Date()
    }
  });

  await prisma.enrollment.create({
    data: { userId: teacher.id, courseId: course.id, roleInCourse: "teacher", progressPercent: 0 }
  });

  console.log(`[course-creation] Curso local creado id=${course.id}, matrícula del docente registrada.`);
  return course;
}
