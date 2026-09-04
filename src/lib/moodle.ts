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

export interface MoodleModule {
  id: number;
  name: string;
  modname: string;
  url?: string;
  description?: string;
  visible?: number;
  instance?: number;
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
      { courseids: courseIds }
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

  completion: async (courseId: number, moodleUserId: number) => {
    const r = await moodleCall<{ statuses: MoodleCompletionStatus[] }>(
      "core_completion_get_activities_completion_status",
      { courseid: courseId, userid: moodleUserId }
    );
    return r.statuses ?? [];
  }
};

/** Base pública de Moodle (para armar enlaces "Abrir en Moodle"). */
export function moodleBaseUrl(): string {
  const issuer = env("MOODLE_ISSUER");
  if (issuer) return issuer.replace(/\/$/, "");
  return env("MOODLE_WS_URL").replace(/\/webservice\/rest\/server\.php$/, "");
}
