/**
 * Exportaciones: construyen el documento (bloques), lo generan en PDF/Word, lo suben a Spaces y lo registran.
 */
import { prisma } from "@/lib/prisma";
import { blocksToPdf, blocksToDocx, markdownToBlocks, type Block, type DocMeta } from "@/lib/documents";
import { uploadFile, slugify, storageConfigured } from "@/lib/storage";
import { buildCourseTeacherSummary } from "@/lib/teacher";

export type ExportFormat = "pdf" | "docx";
export type ExportKind = "course_report" | "agent_output" | "exam" | "certificate";

export async function createExport(opts: { userId: string; kind: ExportKind; format: ExportFormat; meta: DocMeta; blocks: Block[]; courseId?: string | null }) {
  if (!storageConfigured()) throw new Error("El almacenamiento de archivos no está configurado (variables SPACES_* en Render).");
  const buffer = opts.format === "pdf" ? await blocksToPdf(opts.meta, opts.blocks) : await blocksToDocx(opts.meta, opts.blocks);
  const contentType = opts.format === "pdf" ? "application/pdf" : "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
  const stamp = new Date().toISOString().slice(0, 19).replace(/[:T]/g, "-");
  const key = `exports/${opts.userId}/${stamp}-${slugify(opts.meta.title)}.${opts.format}`;
  await uploadFile(key, buffer, contentType);
  return prisma.exportFile.create({
    data: { userId: opts.userId, kind: opts.kind, title: opts.meta.title, storageKey: key, contentType, size: buffer.length, courseId: opts.courseId || null }
  });
}

export function filenameOf(f: { title: string; storageKey: string }) {
  const ext = f.storageKey.split(".").pop();
  return `${slugify(f.title)}.${ext}`;
}

// ---------------------------------------------------------------------------
// 1. Reporte de seguimiento del curso (docente)
// ---------------------------------------------------------------------------
export async function courseReportBlocks(courseId: string): Promise<{ meta: Omit<DocMeta, "author">; blocks: Block[] }> {
  const s = await buildCourseTeacherSummary(courseId);
  if (!s) throw new Error("Curso no encontrado");
  const course = await prisma.course.findUnique({ where: { id: courseId } });
  const now = new Date();
  const overdue = s.assignmentsDue.filter((a) => a.dueDate && a.dueDate < now).length;
  const blocks: Block[] = [
    { type: "h1", text: "Resumen del curso" },
    { type: "kv", items: [
      { label: "Estudiantes", value: String(s.studentCount) },
      { label: "Promedio del curso", value: s.averageTotal !== null ? `${s.averageTotal} %` : "Sin notas" },
      { label: "Estudiantes en riesgo", value: String(s.atRiskCount) },
      { label: "Tareas", value: `${s.assignmentsDue.length} (${overdue} vencidas)` },
      { label: "Docente", value: course?.professorName || "" },
      { label: "Programa", value: course?.categoryPath || course?.category || "" }
    ] },
    { type: "h1", text: "Seguimiento de estudiantes" },
    { type: "table", headers: ["Estudiante", "Correo", "Progreso", "Nota total", "Ítems", "Estado"],
      rows: s.students.map((st) => [st.name, st.email, `${st.progressPercent} %`, st.total !== null ? `${st.total} %` : "—", String(st.gradedCount), st.atRisk ? `En riesgo: ${st.riskReasons.join("; ")}` : "Al día"]) }
  ];
  const risk = s.students.filter((st) => st.atRisk);
  if (risk.length) {
    blocks.push({ type: "h2", text: "Estudiantes que requieren atención" });
    blocks.push({ type: "ul", items: risk.map((st) => `**${st.name}** — ${st.riskReasons.join("; ")}${st.overdueUngraded.length ? ` (pendientes: ${st.overdueUngraded.join(", ")})` : ""}`) });
  }
  blocks.push({ type: "h1", text: "Estado de las tareas" });
  blocks.push({ type: "table", headers: ["Tarea", "Fecha de entrega", "Calificados"],
    rows: s.assignmentsDue.map((a) => [a.name, a.dueDate ? a.dueDate.toLocaleDateString("es-PA") : "Sin fecha", `${a.gradedCount} / ${s.studentCount}`]) });
  blocks.push({ type: "h2", text: "Notas por estudiante" });
  const labels = Array.from(new Set(s.students.flatMap((st) => st.grades.map((g) => g.label))));
  if (labels.length) {
    blocks.push({ type: "table", headers: ["Estudiante", ...labels, "Total"],
      rows: s.students.map((st) => [st.name, ...labels.map((l) => { const g = st.grades.find((x) => x.label === l); return g ? (g.maxScore ? `${g.rawScore}/${g.maxScore}` : `${g.score}`) : "—"; }), st.total !== null ? `${st.total} %` : "—"]) });
  } else {
    blocks.push({ type: "p", text: "Aún no hay calificaciones registradas en Moodle para este curso." });
  }
  blocks.push({ type: "hr" });
  blocks.push({ type: "p", text: "Datos sincronizados desde Moodle. Los criterios de riesgo (nota mínima, tareas vencidas y progreso) se configuran en el panel de administración de la Plataforma." });
  return { meta: { title: `Reporte de seguimiento — ${s.courseName}`, subtitle: "Seguimiento académico del curso", course: s.courseName }, blocks };
}

// ---------------------------------------------------------------------------
// 2. Salida de un Agente docente (Markdown)
// ---------------------------------------------------------------------------
export function agentOutputBlocks(title: string, markdown: string, courseName?: string): { meta: Omit<DocMeta, "author">; blocks: Block[] } {
  return { meta: { title, subtitle: "Generado con los Agentes docentes de la Plataforma UDELAS", course: courseName }, blocks: markdownToBlocks(markdown) };
}

// ---------------------------------------------------------------------------
// 3. Examen IA
// ---------------------------------------------------------------------------
export async function examBlocks(examId: string, withAnswers: boolean): Promise<{ meta: Omit<DocMeta, "author">; blocks: Block[]; courseId: string | null }> {
  const exam = await prisma.exam.findUnique({ where: { id: examId }, include: { questions: true, course: { select: { name: true } } } });
  if (!exam) throw new Error("Examen no encontrado");
  const letters = "ABCDEFGH";
  const blocks: Block[] = [
    { type: "kv", items: [{ label: "Tema", value: exam.topic }, { label: "Preguntas", value: String(exam.questions.length) }, { label: "Nombre del estudiante", value: withAnswers ? "—" : "______________________________" }] },
    { type: "hr" }
  ];
  exam.questions.forEach((q, i) => {
    const opts = (q.options as string[]) || [];
    blocks.push({ type: "h3", text: `${i + 1}. ${q.questionText}` });
    blocks.push({ type: "ul", items: opts.map((o, j) => `${letters[j]}) ${o}${withAnswers && j === q.correctOption ? "  ✔" : ""}`) });
    if (withAnswers && q.explanation) blocks.push({ type: "p", text: `**Explicación:** ${q.explanation}` });
  });
  if (withAnswers) {
    blocks.push({ type: "hr" });
    blocks.push({ type: "h2", text: "Clave de respuestas" });
    blocks.push({ type: "p", text: exam.questions.map((q, i) => `${i + 1}${letters[q.correctOption] || "?"}`).join("   ") });
  }
  return { meta: { title: `${exam.title}${withAnswers ? " — Clave del docente" : ""}`, subtitle: withAnswers ? "Versión con respuestas y explicaciones" : "Versión para el estudiante", course: exam.course?.name }, blocks, courseId: exam.courseId };
}

// ---------------------------------------------------------------------------
// 4. Certificado de microcredencial
// ---------------------------------------------------------------------------
export async function certificateBlocks(userId: string, microcredentialId: string): Promise<{ meta: Omit<DocMeta, "author">; blocks: Block[]; courseId: string | null }> {
  const prog = await prisma.userMicrocredentialProgress.findUnique({
    where: { userId_microcredentialId: { userId, microcredentialId } },
    include: { microcredential: { include: { course: { select: { name: true, professorName: true } } } }, user: { select: { name: true, email: true } } }
  });
  if (!prog || !prog.earnedAt) throw new Error("La microcredencial aún no ha sido obtenida.");
  const mc = prog.microcredential;
  const steps = (mc.steps as { label: string }[]) || [];
  const blocks: Block[] = [
    { type: "p", text: "La Universidad Especializada de las Américas, a través de la Plataforma UDELAS AI Learning, certifica que" },
    { type: "h1", text: prog.user.name },
    { type: "p", text: `ha obtenido la **${mc.name}**${mc.course ? `, correspondiente al curso **${mc.course.name}**` : ""}, al cumplir la totalidad de los requisitos establecidos.` },
    { type: "h3", text: "Requisitos acreditados" },
    { type: "ul", items: steps.map((s) => s.label) },
    { type: "kv", items: [
      { label: "Fecha de obtención", value: prog.earnedAt.toLocaleDateString("es-PA", { year: "numeric", month: "long", day: "numeric" }) },
      { label: "Docente", value: mc.course?.professorName || "—" },
      { label: "Código de verificación", value: prog.id.toUpperCase() }
    ] },
    { type: "hr" },
    { type: "p", text: "Este documento se genera automáticamente a partir de los registros de Moodle y de la Plataforma UDELAS AI Learning. Su validez oficial está sujeta a las políticas de certificación de la Universidad." }
  ];
  return { meta: { title: "Certificado de microcredencial", subtitle: mc.name, course: mc.course?.name }, blocks, courseId: mc.courseId };
}
