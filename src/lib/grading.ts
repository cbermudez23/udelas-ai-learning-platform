/**
 * Calificación asistida por IA: lee las entregas de una tarea desde Moodle
 * (mod_assign_get_submissions), extrae el texto del archivo entregado
 * (reutilizando el mismo extractor de la Biblioteca IA, con OCR de respaldo),
 * pide a la IA una nota y retroalimentación sugeridas, y — tras la revisión
 * del docente — escribe el resultado final en Moodle (mod_assign_save_grade).
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

  const { warnings } = await moodle.saveGrade({
    moodleAssignId: assignment.moodleAssignId,
    moodleUserId: opts.moodleUserId,
    grade: opts.grade,
    feedback: opts.feedback
  });

  // Refresca la nota localmente de inmediato (sin esperar al próximo ciclo de sincronización)
  const user = await prisma.user.findUnique({ where: { moodleUserId: opts.moodleUserId } });
  if (user) {
    const enrollment = await prisma.enrollment.findUnique({ where: { userId_courseId: { userId: user.id, courseId: assignment.courseId } } });
    if (enrollment) {
      const items = await moodle.gradeItems(assignment.course.moodleCourseId!, opts.moodleUserId).catch(() => []);
      if (items.length) await syncGrades(enrollment.id, items, newReport());
    }
  }

  if (warnings.length > 0) {
    console.warn("mod_assign_save_grade devolvió warnings:", warnings);
    const msg = warnings.map((w) => w.message).join(" ");
    return { warning: `Moodle indicó: "${msg}". Es posible que esta tarea tenga activada una "calificación avanzada" (rúbrica o guía dentro de Moodle) que impide fijar la nota directamente; el comentario sí se guarda, pero verifica la nota en Moodle.` };
  }
  return { warning: null };
}
