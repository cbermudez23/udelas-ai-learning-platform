/**
 * Credenciales desde Moodle:
 *  - Insignias: las que el estudiante ya obtuvo en Moodle.
 *  - Microcredenciales: una por curso; sus pasos son las competencias del curso
 *    (o, si no hay, "completar actividades" + "curso finalizado").
 *
 * Todas las funciones toleran que las funciones de Moodle no estén habilitadas:
 * registran un aviso una sola vez y continúan.
 */
import { prisma } from "@/lib/prisma";
import { moodle, moodleBaseUrl, MoodleError } from "@/lib/moodle";

const disabled = new Set<string>();

function isAccessError(e: any): boolean {
  return e instanceof MoodleError && /accessexception|invalidrecord|Access control|no está permitido|not allowed/i.test(`${e.errorcode} ${e.message}`);
}

/** Insignias ganadas por un usuario. Devuelve la cantidad sincronizada. */
export async function syncUserBadges(userId: string, moodleUserId: number, warn: (m: string) => void): Promise<number> {
  if (disabled.has("badges")) return 0;
  let badges;
  try {
    badges = await moodle.userBadges(moodleUserId);
  } catch (e: any) {
    if (isAccessError(e)) {
      disabled.add("badges");
      warn("Insignias: falta habilitar core_badges_get_user_badges en el servicio web de Moodle.");
      return 0;
    }
    throw e;
  }
  let n = 0;
  for (const b of badges) {
    const course = b.courseid ? await prisma.course.findUnique({ where: { moodleCourseId: b.courseid }, select: { id: true } }) : null;
    const data = {
      name: b.name,
      description: (b.description || "").replace(/<[^>]+>/g, " ").trim() || "Insignia otorgada en Moodle",
      icon: "award",
      source: "MOODLE",
      imageUrl: b.badgeurl || null,
      issuer: b.issuername || null,
      courseId: course?.id || null
    };
    const badge = await prisma.badge.upsert({ where: { moodleBadgeId: b.id }, update: data, create: { ...data, moodleBadgeId: b.id } });
    await prisma.userBadge.upsert({
      where: { userId_badgeId: { userId, badgeId: badge.id } },
      update: { earnedAt: b.dateissued ? new Date(b.dateissued * 1000) : new Date() },
      create: { userId, badgeId: badge.id, earnedAt: b.dateissued ? new Date(b.dateissued * 1000) : new Date() }
    });
    n++;
  }
  return n;
}

/**
 * Microcredencial del curso para un estudiante.
 * Crea/actualiza la microcredencial del curso (pasos = competencias) y el progreso del usuario.
 */
export async function syncUserCourseMicrocredential(
  userId: string,
  moodleUserId: number,
  course: { id: string; name: string; moodleCourseId: number | null },
  progressPercent: number,
  warn: (m: string) => void
): Promise<void> {
  if (!course.moodleCourseId) return;
  const base = moodleBaseUrl();

  // 1. Competencias del curso (si la función está habilitada)
  let competencies: { id: number; shortname: string; description?: string }[] = [];
  if (!disabled.has("competencies")) {
    try {
      competencies = await moodle.courseCompetencies(course.moodleCourseId);
    } catch (e: any) {
      if (isAccessError(e)) {
        disabled.add("competencies");
        warn("Competencias: falta habilitar core_competency_list_course_competencies en el servicio web de Moodle.");
      } else throw e;
    }
  }

  // 2. Finalización oficial del curso
  let completed = false;
  let timeCompleted: Date | null = null;
  if (!disabled.has("completion")) {
    try {
      const c = await moodle.courseCompletion(course.moodleCourseId, moodleUserId);
      completed = Boolean(c?.completed);
      timeCompleted = c?.timecompleted ? new Date(c.timecompleted * 1000) : null;
    } catch (e: any) {
      if (isAccessError(e)) {
        disabled.add("completion");
        warn("Finalización: falta habilitar core_completion_get_course_completion_status en el servicio web de Moodle.");
      } else if (!/completion is not enabled|no está habilitad/i.test(e.message)) {
        throw e;
      }
      // Si el curso no tiene seguimiento de finalización, simplemente no se marca.
    }
  }

  // 3. Pasos y progreso
  let steps: { label: string }[];
  let currentStep = 0;
  if (competencies.length > 0) {
    steps = competencies.map((c) => ({ label: c.shortname }));
    for (const c of competencies) {
      try {
        const uc = await moodle.userCompetencyInCourse(course.moodleCourseId, c.id, moodleUserId);
        if (uc?.proficiency) currentStep++;
      } catch {
        /* sin datos para esta competencia */
      }
    }
  } else {
    steps = [{ label: "Completar las actividades del curso" }, { label: "Curso finalizado en Moodle" }];
    if (progressPercent >= 100) currentStep = 1;
    if (completed) currentStep = 2;
  }
  const earned = currentStep >= steps.length && steps.length > 0;

  const mc = await prisma.microcredential.upsert({
    where: { moodleCourseId: course.moodleCourseId },
    update: {
      name: `Microcredencial: ${course.name}`,
      description: competencies.length ? `Competencias del curso ${course.name} en Moodle.` : `Finalización del curso ${course.name} en Moodle.`,
      steps,
      source: "MOODLE",
      courseId: course.id,
      moodleUrl: `${base}/course/view.php?id=${course.moodleCourseId}`
    },
    create: {
      name: `Microcredencial: ${course.name}`,
      description: competencies.length ? `Competencias del curso ${course.name} en Moodle.` : `Finalización del curso ${course.name} en Moodle.`,
      steps,
      source: "MOODLE",
      moodleCourseId: course.moodleCourseId,
      courseId: course.id,
      moodleUrl: `${base}/course/view.php?id=${course.moodleCourseId}`
    }
  });

  await prisma.userMicrocredentialProgress.upsert({
    where: { userId_microcredentialId: { userId, microcredentialId: mc.id } },
    update: { currentStep, earnedAt: earned ? timeCompleted || new Date() : null },
    create: { userId, microcredentialId: mc.id, currentStep, earnedAt: earned ? timeCompleted || new Date() : null }
  });
}
