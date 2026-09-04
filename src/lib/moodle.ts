/**
 * Cliente para los Web Services REST de Moodle.
 *
 * Moodle es el LMS oficial de UDELAS; esta plataforma lee de él (cursos,
 * matrículas, contenidos, tareas, calificaciones) para alimentar la capa de IA.
 *
 * Variables de entorno necesarias:
 *  - MOODLE_WS_URL   → https://<moodle>/webservice/rest/server.php
 *  - MOODLE_WS_TOKEN → token del servicio "UDELAS IA" (usuario udelas_api)
 */

function env(name: string): string {
  return (process.env[name] || "").trim().replace(/^["']|["']$/g, "").trim();
}

export function moodleConfigured(): boolean {
  return Boolean(env("MOODLE_WS_URL") && env("MOODLE_WS_TOKEN"));
}

/** Convierte { courseids: [2,3], options: { a: 1 } } en el formato plano que exige Moodle: courseids[0]=2&courseids[1]=3&options[a]=1 */
function flatten(obj: any, prefix = "", out: Record<string, string> = {}): Record<string, string> {
  if (obj === null || obj === undefined) return out;
  if (Array.isArray(obj)) {
    obj.forEach((v, i) => flatten(v, `${prefix}[${i}]`, out));
  } else if (typeof obj === "object") {
    for (const [k, v] of Object.entries(obj)) {
      flatten(v, prefix ? `${prefix}[${k}]` : k, out);
    }
  } else {
    out[prefix] = String(obj);
  }
  return out;
}

export class MoodleError extends Error {
  constructor(message: string, public errorcode?: string) {
    super(message);
    this.name = "MoodleError";
  }
}

/** Llama a una función de los Web Services de Moodle y devuelve el JSON. */
export async function moodleCall<T = any>(wsfunction: string, params: Record<string, any> = {}): Promise<T> {
  const url = env("MOODLE_WS_URL");
  const token = env("MOODLE_WS_TOKEN");
  if (!url || !token) throw new MoodleError("Faltan MOODLE_WS_URL o MOODLE_WS_TOKEN en las variables de entorno.");

  const body = new URLSearchParams({
    wstoken: token,
    wsfunction,
    moodlewsrestformat: "json",
    ...flatten(params)
  });

  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: body.toString(),
    cache: "no-store"
  });

  if (!res.ok) throw new MoodleError(`Moodle respondió HTTP ${res.status} en ${wsfunction}`);
  const data = await res.json();
  if (data && typeof data === "object" && "exception" in data) {
    throw new MoodleError(`${wsfunction}: ${data.message || data.exception}`, data.errorcode);
  }
  return data as T;
}

// ---------- Tipos mínimos de lo que devuelve Moodle ----------

export interface MoodleCourse {
  id: number;
  shortname: string;
  fullname: string;
  displayname?: string;
  categoryid?: number;
  category?: number; // core_enrol_get_users_courses usa este nombre
  summary?: string;
  visible?: number;
  startdate?: number;
  enddate?: number;
  progress?: number | null; // solo en core_enrol_get_users_courses
  contacts?: { id: number; fullname: string }[];
}

export interface MoodleCategory {
  id: number;
  name: string;
}

export interface MoodleSection {
  id: number;
  name: string;
  section: number;
  visible?: number;
  modules: MoodleModule[];
}

export interface MoodleModuleContent {
  type: string;        // file | url | content
  filename: string;
  filepath?: string;
  filesize?: number;
  fileurl?: string;
  content?: string;    // html embebido (páginas, libros)
  timemodified?: number;
  mimetype?: string;
}

export interface MoodleModule {
  id: number;
  name: string;
  modname: string;
  url?: string;
  description?: string;
  visible?: number;
  instance?: number;
  contents?: MoodleModuleContent[];
}

export interface MoodleEnrolledUser {
  id: number;
  fullname: string;
  email?: string;
  roles?: { roleid: number; shortname: string }[];
}

export interface MoodleAssignment {
  id: number;
  cmid: number;
  course: number;
  name: string;
  intro?: string;
  duedate?: number;
  allowsubmissionsfromdate?: number;
}

export interface MoodleGradeItem {
  id: number;
  itemname: string | null;
  itemtype: string; // course | mod | manual
  itemmodule?: string | null;
  graderaw?: number | null;
  grademax?: number;
  grademin?: number;
  percentageformatted?: string;
}

export interface MoodleCompletionStatus {
  cmid: number;
  modname: string;
  state: number; // 0 incompleto, 1 completo, 2 aprobado, 3 reprobado
}

export interface MoodleUserBadge {
  id: number;
  name: string;
  description?: string;
  badgeurl?: string;
  dateissued?: number;
  courseid?: number | null;
  issuername?: string;
}

export interface MoodleCompetency {
  id: number;
  shortname: string;
  description?: string;
  idnumber?: string;
}

// ---------- Funciones de alto nivel ----------

export const moodle = {
  siteInfo: () => moodleCall("core_webservice_get_site_info"),

  categories: () => moodleCall<MoodleCategory[]>("core_course_get_categories"),

  /** Todos los cursos del sitio (excluye el curso "sitio" id=1). */
  allCourses: async () => {
    const courses = await moodleCall<MoodleCourse[]>("core_course_get_courses");
    return courses.filter((c) => c.id !== 1);
  },

  /** Cursos con datos de contacto (docentes). */
  coursesByIds: async (ids: number[]) => {
    if (ids.length === 0) return [];
    const r = await moodleCall<{ courses: MoodleCourse[] }>("core_course_get_courses_by_field", {
      field: "ids",
      value: ids.join(",")
    });
    return r.courses;
  },

  /** Cursos en los que está matriculado un usuario de Moodle (incluye progreso %). */
  userCourses: (moodleUserId: number) =>
    moodleCall<MoodleCourse[]>("core_enrol_get_users_courses", { userid: moodleUserId }),

  courseContents: (courseId: number) =>
    moodleCall<MoodleSection[]>("core_course_get_contents", { courseid: courseId }),

  enrolledUsers: (courseId: number) =>
    moodleCall<MoodleEnrolledUser[]>("core_enrol_get_enrolled_users", { courseid: courseId }),

  usersByEmail: (emails: string[]) =>
    moodleCall<{ id: number; email: string; fullname: string }[]>("core_user_get_users_by_field", {
      field: "email",
      values: emails
    }),

  assignments: async (courseIds: number[]) => {
    if (courseIds.length === 0) return [];
    const r = await moodleCall<{ courses: { id: number; assignments: MoodleAssignment[] }[] }>(
      "mod_assign_get_assignments",
      { courseids: courseIds, includenotenrolledcourses: 1 }
    );
    return r.courses.flatMap((c) => c.assignments.map((a) => ({ ...a, course: c.id })));
  },

  gradeItems: async (courseId: number, moodleUserId: number) => {
    const r = await moodleCall<{ usergrades: { gradeitems: MoodleGradeItem[] }[] }>(
      "gradereport_user_get_grade_items",
      { courseid: courseId, userid: moodleUserId }
    );
    return r.usergrades?.[0]?.gradeitems ?? [];
  },

  /** Insignias obtenidas por un usuario (requiere core_badges_get_user_badges). */
  userBadges: async (moodleUserId: number) => {
    const r = await moodleCall<{ badges: MoodleUserBadge[] }>("core_badges_get_user_badges", { userid: moodleUserId });
    return r.badges ?? [];
  },

  /** Competencias asociadas a un curso (requiere core_competency_list_course_competencies). */
  courseCompetencies: async (courseId: number) => {
    const r = await moodleCall<{ competency: MoodleCompetency }[]>("core_competency_list_course_competencies", { id: courseId });
    return (r || []).map((x) => x.competency);
  },

  /** Estado de una competencia para un usuario en un curso. */
  userCompetencyInCourse: async (courseId: number, competencyId: number, moodleUserId: number) => {
    const r = await moodleCall<{ usercompetency?: { proficiency?: boolean | null; grade?: number | null } }>(
      "core_competency_get_user_competency_in_course",
      { courseid: courseId, competencyid: competencyId, userid: moodleUserId }
    );
    return r.usercompetency ?? null;
  },

  /** Finalización oficial del curso para un usuario. */
  courseCompletion: async (courseId: number, moodleUserId: number) => {
    const r = await moodleCall<{ completionstatus: { completed: boolean; timecompleted?: number | null } }>(
      "core_completion_get_course_completion_status",
      { courseid: courseId, userid: moodleUserId }
    );
    return r.completionstatus;
  },

  completion: async (courseId: number, moodleUserId: number) => {
    const r = await moodleCall<{ statuses: MoodleCompletionStatus[] }>(
      "core_completion_get_activities_completion_status",
      { courseid: courseId, userid: moodleUserId }
    );
    return r.statuses ?? [];
  }
};

/** Descarga un archivo de Moodle (pluginfile) usando el token del servicio. */
export async function moodleDownload(fileurl: string): Promise<{ buffer: Buffer; contentType: string }> {
  const token = env("MOODLE_WS_TOKEN");
  const sep = fileurl.includes("?") ? "&" : "?";
  const res = await fetch(`${fileurl}${sep}token=${encodeURIComponent(token)}`, { cache: "no-store", redirect: "follow" });
  const contentType = res.headers.get("content-type") || "";
  const ab = await res.arrayBuffer();
  const buffer = Buffer.from(ab);
  if (!res.ok) throw new MoodleError(`No se pudo descargar el archivo (HTTP ${res.status}): ${buffer.toString("utf8").slice(0, 160)}`);
  // Moodle devuelve HTML o JSON cuando el token no puede acceder al archivo
  const head = buffer.subarray(0, 300).toString("utf8").trim();
  if (/^(<!DOCTYPE|<html|\{"exception")/i.test(head) || (/text\/html|application\/json/i.test(contentType) && !/pdf|word|text\/plain/i.test(fileurl))) {
    const msg = head.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").slice(0, 200);
    throw new MoodleError(`Moodle no entregó el archivo (respondió ${contentType || "sin tipo"}): ${msg}`);
  }
  return { buffer, contentType };
}

/** Base pública de Moodle (para armar enlaces "Abrir en Moodle"). */
export function moodleBaseUrl(): string {
  const issuer = env("MOODLE_ISSUER");
  if (issuer) return issuer.replace(/\/$/, "");
  return env("MOODLE_WS_URL").replace(/\/webservice\/rest\/server\.php$/, "");
}
