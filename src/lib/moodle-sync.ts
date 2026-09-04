/**
 * Sincronización Moodle → Plataforma UDELAS.
 *
 * Dos modos:
 *  - syncUser(userId): sincroniza SOLO lo del usuario (sus cursos, notas, progreso).
 *    Es rápida y se ejecuta al entrar desde Moodle (LTI) o al pulsar "Actualizar".
 *  - syncAll(): recorre todos los cursos de Moodle con sus participantes.
 *    Es la que usa el panel de administración / tarea programada.
 *
 * Moodle es la fuente de verdad: aquí nunca se escribe hacia Moodle.
 */
import { prisma } from "@/lib/prisma";
import { Role } from "@prisma/client";
import {
  moodle,
  moodleBaseUrl,
  moodleConfigured,
  type MoodleCourse,
  type MoodleSection,
  type MoodleAssignment,
  type MoodleGradeItem,
  type MoodleCompletionStatus
} from "@/lib/moodle";

const COLORS = ["blue", "amber", "green", "red"];
const TEACHER_ROLES = new Set(["editingteacher", "teacher", "manager", "coursecreator"]);

export interface SyncReport {
  courses: number;
  enrollments: number;
  contents: number;
  assignments: number;
  grades: number;
  users: number;
  errors: string[];
  startedAt: string;
  finishedAt?: string;
}

function newReport(): SyncReport {
  return { courses: 0, enrollments: 0, contents: 0, assignments: 0, grades: 0, users: 0, errors: [], startedAt: new Date().toISOString() };
}

function stripHtml(html?: string | null): string {
  return (html || "").replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
}

function initialsOf(name: string): string {
  const [f, ...r] = name.trim().split(/\s+/);
  return ((f?.[0] || "U") + (r[r.length - 1]?.[0] || "D")).toUpperCase();
}

function tsToDate(ts?: number | null): Date | null {
  return ts && ts > 0 ? new Date(ts * 1000) : null;
}

// ---------------------------------------------------------------------------
// Cursos
// ---------------------------------------------------------------------------

async function upsertCourse(mc: MoodleCourse, categoryNames: Map<number, string>) {
  const professorName = mc.contacts?.map((c) => c.fullname).join(", ") || "Docente por asignar";
  const catId = mc.categoryid ?? mc.category;
  const category = (catId && categoryNames.get(catId)) || "Moodle";
  const base = moodleBaseUrl();
  const data = {
    name: mc.fullname,
    shortName: mc.shortname,
    category,
    professorName,
    summary: stripHtml(mc.summary).slice(0, 2000) || null,
    moodleUrl: `${base}/course/view.php?id=${mc.id}`,
    source: "MOODLE",
    lastSyncedAt: new Date()
  };
  return prisma.course.upsert({
    where: { moodleCourseId: mc.id },
    update: data,
    create: { ...data, moodleCourseId: mc.id, colorTheme: COLORS[mc.id % COLORS.length], icon: "book" }
  });
}

async function syncCourseContents(courseId: string, sections: MoodleSection[], report: SyncReport) {
  const seen: number[] = [];
  for (const section of sections) {
    let order = 0;
    for (const m of section.modules || []) {
      if (m.visible === 0) continue;
      seen.push(m.id);
      await prisma.courseContent.upsert({
        where: { moodleModuleId: m.id },
        update: {
          courseId,
          sectionName: section.name || `Sección ${section.section}`,
          sectionOrder: section.section,
          order: order,
          name: m.name,
          modName: m.modname,
          url: m.url || null,
          description: stripHtml(m.description).slice(0, 1000) || null
        },
        create: {
          courseId,
          moodleModuleId: m.id,
          sectionName: section.name || `Sección ${section.section}`,
          sectionOrder: section.section,
          order: order,
          name: m.name,
          modName: m.modname,
          url: m.url || null,
          description: stripHtml(m.description).slice(0, 1000) || null
        }
      });
      order++;
      report.contents++;
    }
  }
  // Eliminamos módulos que ya no existen en Moodle
  await prisma.courseContent.deleteMany({ where: { courseId, moodleModuleId: { notIn: seen } } });
}

async function syncAssignments(courseId: string, assignments: MoodleAssignment[], report: SyncReport) {
  const base = moodleBaseUrl();
  const seen: number[] = [];
  for (const a of assignments) {
    seen.push(a.id);
    const data = {
      courseId,
      name: a.name,
      intro: stripHtml(a.intro).slice(0, 1000) || null,
      dueDate: tsToDate(a.duedate),
      openDate: tsToDate(a.allowsubmissionsfromdate),
      url: `${base}/mod/assign/view.php?id=${a.cmid}`
    };
    await prisma.assignment.upsert({
      where: { moodleAssignId: a.id },
      update: data,
      create: { ...data, moodleAssignId: a.id }
    });
    report.assignments++;
  }
  await prisma.assignment.deleteMany({ where: { courseId, moodleAssignId: { notIn: seen } } });
}

// ---------------------------------------------------------------------------
// Usuarios y matrículas
// ---------------------------------------------------------------------------

async function resolveLocalUser(mu: { id: number; fullname: string; email?: string }, roles: string[], report: SyncReport) {
  const email = (mu.email || "").toLowerCase().trim();
  const isTeacher = roles.some((r) => TEACHER_ROLES.has(r));

  let user = await prisma.user.findUnique({ where: { moodleUserId: mu.id } });
  if (!user && email) user = await prisma.user.findUnique({ where: { email } });

  if (user) {
    if (user.moodleUserId !== mu.id) {
      user = await prisma.user.update({ where: { id: user.id }, data: { moodleUserId: mu.id } });
    }
    // Un estudiante que en Moodle es docente sube a PROFESSOR; nunca bajamos a un ADMIN.
    if (isTeacher && user.role === Role.STUDENT) {
      user = await prisma.user.update({ where: { id: user.id }, data: { role: Role.PROFESSOR } });
    }
    return user;
  }

  if (!email) return null; // sin correo no podemos crear una cuenta útil
  report.users++;
  return prisma.user.create({
    data: {
      name: mu.fullname,
      email,
      passwordHash: "moodle-no-password", // entra vía LTI desde Moodle
      role: isTeacher ? Role.PROFESSOR : Role.STUDENT,
      avatarInitials: initialsOf(mu.fullname),
      moodleUserId: mu.id
    }
  });
}

async function upsertEnrollment(userId: string, courseId: string, roleInCourse: string, progress: number | null) {
  const data: any = { roleInCourse };
  if (progress !== null && progress !== undefined) data.progressPercent = Math.round(progress);
  return prisma.enrollment.upsert({
    where: { userId_courseId: { userId, courseId } },
    update: data,
    create: { userId, courseId, roleInCourse, progressPercent: Math.round(progress ?? 0) }
  });
}

// ---------------------------------------------------------------------------
// Calificaciones, progreso y calendario
// ---------------------------------------------------------------------------

async function syncGrades(enrollmentId: string, items: MoodleGradeItem[], report: SyncReport) {
  for (const it of items) {
    if (it.graderaw === null || it.graderaw === undefined) continue;
    const max = it.grademax ?? 0;
    const score = max > 0 ? (it.graderaw / max) * 100 : it.graderaw;
    const label = it.itemtype === "course" ? "Total del curso" : it.itemname || "Ítem";
    await prisma.grade.upsert({
      where: { enrollmentId_moodleItemId: { enrollmentId, moodleItemId: it.id } },
      update: { label, score: Math.round(score * 10) / 10, rawScore: it.graderaw, maxScore: max || null },
      create: { enrollmentId, moodleItemId: it.id, label, score: Math.round(score * 10) / 10, rawScore: it.graderaw, maxScore: max || null }
    });
    report.grades++;
  }
}

function progressFromCompletion(statuses: MoodleCompletionStatus[]): number | null {
  if (!statuses || statuses.length === 0) return null;
  const done = statuses.filter((s) => s.state === 1 || s.state === 2).length;
  return (done / statuses.length) * 100;
}

async function syncCalendarForUser(userId: string, courseName: string, assignments: { moodleAssignId: number; name: string; dueDate: Date | null; url: string | null }[]) {
  for (const a of assignments) {
    if (!a.dueDate) continue;
    const moodleKey = `assign:${a.moodleAssignId}`;
    await prisma.calendarEvent.upsert({
      where: { userId_moodleKey: { userId, moodleKey } },
      update: { title: `Entrega: ${a.name}`, detail: `${courseName}${a.url ? ` · ${a.url}` : ""}`, date: a.dueDate, colorTag: "red" },
      create: { userId, moodleKey, title: `Entrega: ${a.name}`, detail: `${courseName}${a.url ? ` · ${a.url}` : ""}`, date: a.dueDate, colorTag: "red" }
    });
  }
}

// ---------------------------------------------------------------------------
// Sincronización de un usuario (rápida)
// ---------------------------------------------------------------------------

export async function syncUser(userId: string): Promise<SyncReport> {
  const report = newReport();
  if (!moodleConfigured()) {
    report.errors.push("Moodle no está configurado (MOODLE_WS_URL / MOODLE_WS_TOKEN).");
    return report;
  }

  let user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) throw new Error("Usuario no encontrado");

  // 1. Encontrar su id en Moodle (por correo) si aún no lo tenemos
  if (!user.moodleUserId) {
    const found = await moodle.usersByEmail([user.email]);
    if (!found.length) {
      report.errors.push(`No existe en Moodle un usuario con el correo ${user.email}.`);
      return report;
    }
    user = await prisma.user.update({ where: { id: userId }, data: { moodleUserId: found[0].id } });
  }
  const mid = user.moodleUserId!;

  // 2. Sus cursos (trae el progreso % calculado por Moodle)
  const [userCourses, categories] = await Promise.all([moodle.userCourses(mid), moodle.categories()]);
  const categoryNames = new Map(categories.map((c) => [c.id, c.name]));
  const detailed = await moodle.coursesByIds(userCourses.map((c) => c.id));
  const contactsById = new Map(detailed.map((c) => [c.id, c.contacts || []]));
  const courseIds = userCourses.map((c) => c.id);
  const allAssignments = courseIds.length ? await moodle.assignments(courseIds) : [];

  for (const mc of userCourses) {
    try {
      const course = await upsertCourse({ ...mc, contacts: contactsById.get(mc.id) }, categoryNames);
      report.courses++;

      const [sections, gradeItems, completion, enrolled] = await Promise.all([
        moodle.courseContents(mc.id),
        moodle.gradeItems(mc.id, mid).catch(() => [] as MoodleGradeItem[]),
        moodle.completion(mc.id, mid).catch(() => [] as MoodleCompletionStatus[]),
        moodle.enrolledUsers(mc.id).catch(() => [])
      ]);

      await syncCourseContents(course.id, sections, report);
      await syncAssignments(course.id, allAssignments.filter((a) => a.course === mc.id), report);

      const me = enrolled.find((u) => u.id === mid);
      const roles = me?.roles?.map((r) => r.shortname) || [];
      const isTeacher = roles.some((r) => TEACHER_ROLES.has(r));
      const progress = mc.progress ?? progressFromCompletion(completion);

      const enrollment = await upsertEnrollment(userId, course.id, isTeacher ? "teacher" : "student", progress);
      report.enrollments++;

      if (!isTeacher) await syncGrades(enrollment.id, gradeItems, report);

      const saved = await prisma.assignment.findMany({ where: { courseId: course.id } });
      await syncCalendarForUser(userId, course.name, saved);
    } catch (e: any) {
      report.errors.push(`Curso ${mc.fullname}: ${e.message}`);
    }
  }

  report.finishedAt = new Date().toISOString();
  return report;
}

// ---------------------------------------------------------------------------
// Sincronización completa (administración)
// ---------------------------------------------------------------------------

export async function syncAll(): Promise<SyncReport> {
  const report = newReport();
  if (!moodleConfigured()) {
    report.errors.push("Moodle no está configurado (MOODLE_WS_URL / MOODLE_WS_TOKEN).");
    return report;
  }

  const [courses, categories] = await Promise.all([moodle.allCourses(), moodle.categories()]);
  const categoryNames = new Map(categories.map((c) => [c.id, c.name]));
  const detailed = await moodle.coursesByIds(courses.map((c) => c.id));
  const contactsById = new Map(detailed.map((c) => [c.id, c.contacts || []]));
  const allAssignments = courses.length ? await moodle.assignments(courses.map((c) => c.id)) : [];

  for (const mc of courses) {
    try {
      const course = await upsertCourse({ ...mc, contacts: contactsById.get(mc.id) }, categoryNames);
      report.courses++;

      const [sections, enrolled] = await Promise.all([moodle.courseContents(mc.id), moodle.enrolledUsers(mc.id)]);
      await syncCourseContents(course.id, sections, report);
      await syncAssignments(course.id, allAssignments.filter((a) => a.course === mc.id), report);
      const saved = await prisma.assignment.findMany({ where: { courseId: course.id } });

      for (const mu of enrolled) {
        try {
          const roles = mu.roles?.map((r) => r.shortname) || [];
          const local = await resolveLocalUser(mu, roles, report);
          if (!local) continue;
          const isTeacher = roles.some((r) => TEACHER_ROLES.has(r));

          let progress: number | null = null;
          if (!isTeacher) {
            const completion = await moodle.completion(mc.id, mu.id).catch(() => [] as MoodleCompletionStatus[]);
            progress = progressFromCompletion(completion);
          }
          const enrollment = await upsertEnrollment(local.id, course.id, isTeacher ? "teacher" : "student", progress);
          report.enrollments++;

          if (!isTeacher) {
            const items = await moodle.gradeItems(mc.id, mu.id).catch(() => [] as MoodleGradeItem[]);
            await syncGrades(enrollment.id, items, report);
            await syncCalendarForUser(local.id, course.name, saved);
          }
        } catch (e: any) {
          report.errors.push(`Usuario ${mu.fullname} en ${mc.fullname}: ${e.message}`);
        }
      }
    } catch (e: any) {
      report.errors.push(`Curso ${mc.fullname}: ${e.message}`);
    }
  }

  report.finishedAt = new Date().toISOString();
  return report;
}
