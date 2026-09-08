/**
 * Calificación asistida por IA: lee las entregas de una tarea desde Moodle
 * (mod_assign_get_submissions), extrae el texto del archivo entregado
 * (reutilizando el mismo extractor de la Biblioteca IA, con OCR de respaldo),
 * pide a la IA una nota y retroalimentación sugeridas, y — tras la revisión
 * del docente — escribe la nota en Moodle vía core_grades_update_grades.
 * (mod_assign_save_grade/mod_assign_save_grades quedaron descartadas: en esta
 * instalación aceptan la llamada sin error pero graban -1 internamente,
 * confirmado con una llamada manual directa a la API, fuera de este código.
 * core_grades_update_grades requiere el CMID de la tarea (moodleCmid) como
 * `activityid` — confirmado el 8-sep-2026 por el propio error de Moodle al
 * probar con el instance id: "ID de módulo de curso no válida".)
 */
import { prisma } from "@/lib/prisma";
import { moodle, moodleDownload, type MoodleSubmission } from "@/lib/moodle";
import { extractText } from "@/lib/library";
import { generateChatCompletion, extractJson, AIConfigError } from "@/lib/ai";
import { syncGrades, newReport } from "@/lib/moodle-sync";

export interface SubmissionView {
  moodleUserId: number;
  userId: string | null; // id local, si el estudiante ya está sincronizado
  name: string;
  email: string | null;
  status: string;
  gradingStatus: string;
  submittedAt: Date | null;
  fileNames: string[];
  hasText: boolean; // hay algo que la IA pueda leer (archivo o texto en línea)
}

/** Lista las entregas de una tarea, cruzadas con los usuarios ya conocidos localmente. */
export async function listSubmissions(assignmentId: string): Promise<{ assignment: any; submissions: SubmissionView[] }> {
  const assignment = await prisma.assignment.findUnique({ where: { id: assignmentId }, include: { course: true } });
  if (!assignment) throw new Error("Tarea no encontrada");

  const raw = await moodle.assignmentSubmissions(assignment.moodleAssignId);
  const submitted = raw.filter((s) => s.status === "submitted");

  const moodleIds = submitted.map((s) => s.userid);
  const localUsers = await prisma.user.findMany({ where: { moodleUserId: { in: moodleIds } }, select: { id: true, name: true, email: true, moodleUserId: true } });
  const byMoodleId = new Map(localUsers.map((u) => [u.moodleUserId, u]));

  const submissions: SubmissionView[] = submitted.map((s) => {
    const local = byMoodleId.get(s.userid);
    const fileNames = (s.plugins || [])
      .filter((p) => p.type === "file")
      .flatMap((p) => (p.fileareas || []).flatMap((a) => (a.files || []).map((f) => f.filename)));
    const hasOnlineText = (s.plugins || []).some((p) => p.type === "onlinetext" && p.editorfields?.some((f) => f.text?.trim()));
    return {
      moodleUserId: s.userid,
      userId: local?.id ?? null,
      name: local?.name ?? `Usuario Moodle #${s.userid}`,
      email: local?.email ?? null,
      status: s.status,
      gradingStatus: s.gradingstatus,
      submittedAt: s.timemodified ? new Date(s.timemodified * 1000) : null,
      fileNames,
      hasText: fileNames.length > 0 || hasOnlineText
    };
  });

  return { assignment, submissions };
}

/** Extrae el texto entregado por un estudiante (archivo u online-text) para dárselo a la IA. */
async function extractSubmissionText(moodleAssignId: number, moodleUserId: number): Promise<{ text: string; source: string }> {
  const raw = await moodle.assignmentSubmissions(moodleAssignId);
  const sub = raw.find((s: MoodleSubmission) => s.userid === moodleUserId);
  if (!sub) throw new Error("No se encontró la entrega de este estudiante.");

  for (const plugin of sub.plugins || []) {
    if (plugin.type === "onlinetext") {
      const field = plugin.editorfields?.find((f) => f.text?.trim());
      if (field) return { text: field.text.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim(), source: "Texto en línea" };
    }
  }
  for (const plugin of sub.plugins || []) {
    if (plugin.type === "file") {
      for (const area of plugin.fileareas || []) {
        for (const file of area.files || []) {
          const { buffer, contentType } = await moodleDownload(file.fileurl);
          const { text } = await extractText(buffer, file.filename, contentType);
          if (text.trim()) return { text: text.trim(), source: file.filename };
        }
      }
    }
  }
  throw new Error("La entrega no tiene texto legible (¿imagen sin OCR o formato no soportado?).");
}

export interface GradeSuggestion {
  grade: number; // 0-100
  feedback: string;
  strengths: string[];
  improvements: string[];
  excerpt: string; // fragmento del texto leído, para que el docente confirme que es correcto
}

/** Genera nota y retroalimentación sugeridas para una entrega, opcionalmente contra una rúbrica dada por el docente. */
export async function suggestGrade(opts: {
  assignmentId: string;
  moodleUserId: number;
  rubricText?: string;
}): Promise<GradeSuggestion> {
  const assignment = await prisma.assignment.findUnique({ where: { id: opts.assignmentId }, include: { course: true } });
  if (!assignment) throw new Error("Tarea no encontrada");

  const { text, source } = await extractSubmissionText(assignment.moodleAssignId, opts.moodleUserId);

  const prompt = `Eres un asistente de calificación para un docente de UDELAS. Evalúa la siguiente entrega de un estudiante para la tarea "${assignment.name}"${assignment.intro ? ` (enunciado: ${assignment.intro.replace(/<[^>]+>/g, " ").slice(0, 600)})` : ""} del curso "${assignment.course.name}".

${opts.rubricText ? `Rúbrica de evaluación proporcionada por el docente:\n${opts.rubricText}\n` : "El docente no proporcionó una rúbrica; evalúa con criterio académico general: comprensión del tema, exactitud, estructura y claridad."}

Entrega del estudiante (fuente: ${source}):
"""
${text.slice(0, 12000)}
"""

Da una calificación de 0 a 100 y retroalimentación constructiva. Sé justo pero exigente; no regales puntos. Responde ÚNICAMENTE con JSON válido, sin texto adicional, con esta forma exacta:
{
  "grade": 85,
  "feedback": "retroalimentación de 2-4 oraciones dirigida al estudiante, en español",
  "strengths": ["punto fuerte 1", "punto fuerte 2"],
  "improvements": ["qué mejorar 1", "qué mejorar 2"]
}`;

  try {
    const raw = await generateChatCompletion(
      [
        { role: "system", content: "Eres un asistente de calificación académica para docentes de UDELAS. Respondes exclusivamente en JSON válido. Nunca inventas contenido que no esté en la entrega." },
        { role: "user", content: prompt }
      ],
      { maxTokens: 900, temperature: 0.3 }
    );
    const parsed = extractJson<{ grade: number; feedback: string; strengths: string[]; improvements: string[] }>(raw);
    return {
      grade: Math.max(0, Math.min(100, Math.round(Number(parsed.grade)))),
      feedback: parsed.feedback || "",
      strengths: parsed.strengths || [],
      improvements: parsed.improvements || [],
      excerpt: text.slice(0, 400)
    };
  } catch (err) {
    if (err instanceof AIConfigError) throw err;
    console.error(err);
    throw new Error("No se pudo generar la sugerencia. Intenta de nuevo.");
  }
}

export async function saveGradeToMoodle(opts: {
  assignmentId: string;
  moodleUserId: number;
  grade: number;
  feedback: string;
}): Promise<{ warning: string | null }> {
  const assignment = await prisma.assignment.findUnique({ where: { id: opts.assignmentId }, include: { course: true } });
  if (!assignment) throw new Error("Tarea no encontrada");
  if (!assignment.moodleCmid) {
    throw new Error('Falta el CMID (identificador de módulo de curso) de esta tarea. Ve al Panel de administración y pulsa "Sincronizar todo Moodle" una vez, luego vuelve a intentarlo.');
  }
  if (!assignment.course.moodleCourseId) {
    throw new Error("Este curso no tiene un id de Moodle asociado.");
  }
  console.log(`[grading] moodleCourseId=${assignment.course.moodleCourseId} moodleAssignId(instance)=${assignment.moodleAssignId} moodleCmid(activityid real)=${assignment.moodleCmid} url=${assignment.url} moodleUserId=${opts.moodleUserId} grade=${opts.grade}`);

  const { warnings } = await moodle.saveGrade({
    moodleCourseId: assignment.course.moodleCourseId,
    moodleCmid: assignment.moodleCmid,
    moodleUserId: opts.moodleUserId,
    grade: opts.grade,
    feedback: opts.feedback
  });
  console.log(`[grading] core_grades_update_grades respondió. warnings=${JSON.stringify(warnings)}`);

  // Verificación: leer de vuelta el grade tanto desde el módulo de tareas
  // (assign_grades) como desde el libro de calificaciones centralizado.
  const rawGrades = await moodle.assignmentGrades(assignment.moodleAssignId).catch((e) => { console.warn("[grading] assignmentGrades falló:", e.message); return []; });
  const rawGrade = rawGrades.find((g) => g.userid === opts.moodleUserId);
  console.log(`[grading] Valor en assign_grades tras guardar (mod_assign_get_grades): ${JSON.stringify(rawGrade)}`);

  // Refresca la nota localmente de inmediato (sin esperar al próximo ciclo de sincronización)
  const user = await prisma.user.findUnique({ where: { moodleUserId: opts.moodleUserId } });
  if (user) {
    const enrollment = await prisma.enrollment.findUnique({ where: { userId_courseId: { userId: user.id, courseId: assignment.courseId } } });
    if (enrollment) {
      const items = await moodle.gradeItems(assignment.course.moodleCourseId, opts.moodleUserId).catch((e) => { console.warn("[grading] gradeItems falló:", e.message); return []; });
      console.log(`[grading] gradeItems tras guardar: ${JSON.stringify(items.map((i: any) => ({ id: i.id, itemname: i.itemname, graderaw: i.graderaw })))}`);
      if (items.length) await syncGrades(enrollment.id, items, newReport());
    } else {
      console.warn(`[grading] No se encontró Enrollment local para userId=${user.id} courseId=${assignment.courseId}`);
    }
  } else {
    console.warn(`[grading] No se encontró User local con moodleUserId=${opts.moodleUserId}`);
  }

  if (warnings.length > 0) {
    console.warn("core_grades_update_grades devolvió warnings:", warnings);
    const msg = warnings.map((w: any) => w.message || JSON.stringify(w)).join(" ");
    return { warning: `Moodle indicó: "${msg}". Verifica la nota directamente en Moodle.` };
  }
  return { warning: null };
}
