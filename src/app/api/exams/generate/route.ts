import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { generateChatCompletion, extractJson, AIConfigError } from "@/lib/ai";
import { searchChunks, materialsContextText, type ChunkHit } from "@/lib/library";

interface GeneratedQuestion {
  question: string;
  options: string[];
  correctIndex: number;
  explanation: string;
}

/** Cuando no se indica tema, toma una muestra representativa de los materiales del curso. */
async function sampleCourseMaterials(courseId: string, take = 12): Promise<ChunkHit[]> {
  const rows = await prisma.libraryChunk.findMany({
    where: { document: { courseId, status: "indexed" } },
    include: { document: { include: { course: { select: { name: true } } } } },
    orderBy: [{ documentId: "asc" }, { order: "asc" }],
    take
  });
  // Un par de fragmentos por documento, no todos del mismo archivo
  const perDoc = new Map<string, number>();
  const sample = rows.filter((r) => {
    const n = perDoc.get(r.documentId) || 0;
    if (n >= 3) return false;
    perDoc.set(r.documentId, n + 1);
    return true;
  });
  return sample.map((c) => ({
    chunkId: c.id, documentId: c.documentId, title: c.document.title, type: c.document.type,
    courseId: c.document.courseId, courseName: c.document.course?.name || null, moodleUrl: c.document.moodleUrl,
    order: c.order, text: c.text, rank: 0
  }));
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "No autenticado" }, { status: 401 });

  const { topic, numQuestions = 5, courseId } = await req.json();
  const cleanTopic = typeof topic === "string" ? topic.trim() : "";
  if (!cleanTopic && !courseId) {
    return NextResponse.json({ error: "Indica un tema, o elige un curso para generar sobre todo su contenido." }, { status: 400 });
  }
  const n = Math.min(Math.max(Number(numQuestions) || 5, 3), 10);

  // Si el examen es de un curso, se verifica que el usuario tenga acceso a él (matrícula o admin)
  let courseName: string | null = null;
  if (courseId) {
    if (session.user.role !== "ADMIN") {
      const enr = await prisma.enrollment.findUnique({ where: { userId_courseId: { userId: session.user.id, courseId } } });
      if (!enr) return NextResponse.json({ error: "No tienes acceso a ese curso." }, { status: 403 });
    }
    const course = await prisma.course.findUnique({ where: { id: courseId }, select: { name: true } });
    courseName = course?.name || null;
  }

  // Materiales reales del curso (Biblioteca IA): por tema si se dio, o una muestra general del curso
  let hits: ChunkHit[] = [];
  if (courseId) {
    hits = cleanTopic ? await searchChunks(cleanTopic, [courseId], 10) : await sampleCourseMaterials(courseId);
  }
  const materials = materialsContextText(hits);
  const effectiveTopic = cleanTopic || (courseName ? `contenidos de ${courseName}` : "conocimiento general");

  const prompt = materials
    ? `Genera un examen de opción múltiple sobre "${effectiveTopic}", basándote ÚNICAMENTE en los materiales del curso listados abajo. No inventes datos que no estén en ellos; si un material no alcanza para ${n} preguntas de calidad, genera menos preguntas antes que inventar contenido.
Crea preguntas variadas (recordar, aplicar, analizar), en español, de nivel universitario. Para cada pregunta, la explicación debe citar la fuente entre corchetes, ej. "[Material 2]".

Materiales del curso:
${materials}

Responde ÚNICAMENTE con un JSON válido (sin texto adicional, sin markdown), con esta forma exacta:
{
  "questions": [
    { "question": "texto de la pregunta", "options": ["opción A", "opción B", "opción C", "opción D"], "correctIndex": 0, "explanation": "breve explicación, citando la fuente" }
  ]
}`
    : `Genera un examen de opción múltiple sobre el tema: "${effectiveTopic}".
Crea exactamente ${n} preguntas variadas y de calidad universitaria, en español.
Responde ÚNICAMENTE con un JSON válido (sin texto adicional, sin markdown), con esta forma exacta:
{
  "questions": [
    { "question": "texto de la pregunta", "options": ["opción A", "opción B", "opción C", "opción D"], "correctIndex": 0, "explanation": "breve explicación de por qué es correcta" }
  ]
}`;

  try {
    const raw = await generateChatCompletion(
      [
        {
          role: "system",
          content:
            "Eres un generador de exámenes universitarios para UDELAS. Respondes exclusivamente en JSON válido, sin explicaciones fuera del JSON. Nunca inventas datos que contradigan los materiales proporcionados."
        },
        { role: "user", content: prompt }
      ],
      { maxTokens: 2500, temperature: 0.5 }
    );

    const parsed = extractJson<{ questions: GeneratedQuestion[] }>(raw);
    if (!parsed.questions || parsed.questions.length === 0) {
      throw new Error("La IA no devolvió preguntas válidas.");
    }

    const exam = await prisma.exam.create({
      data: {
        title: `Examen IA: ${effectiveTopic}`,
        topic: effectiveTopic,
        courseId: courseId || undefined,
        createdById: session.user.id,
        createdByAI: true,
        materialsUsed: hits.length,
        questions: {
          create: parsed.questions.map((q) => ({
            questionText: q.question,
            options: q.options,
            correctOption: q.correctIndex,
            explanation: q.explanation
          }))
        }
      },
      include: { questions: true }
    });

    return NextResponse.json({ exam, materialsUsed: hits.length });
  } catch (err) {
    if (err instanceof AIConfigError) {
      return NextResponse.json(
        {
          error:
            "La generación de exámenes con IA requiere ANTHROPIC_API_KEY u OPENAI_API_KEY configurada en el servidor."
        },
        { status: 503 }
      );
    }
    console.error(err);
    return NextResponse.json(
      { error: "No se pudo generar el examen. Intenta de nuevo." },
      { status: 500 }
    );
  }
}

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "No autenticado" }, { status: 401 });

  let where: any = {};
  if (session.user.role !== "ADMIN") {
    const enr = await prisma.enrollment.findMany({ where: { userId: session.user.id }, select: { courseId: true } });
    const courseIds = enr.map((e) => e.courseId);
    where = { OR: [{ courseId: { in: courseIds } }, { createdById: session.user.id, courseId: null }] };
  }

  const exams = await prisma.exam.findMany({
    where,
    orderBy: { createdAt: "desc" },
    include: { questions: true, course: true },
    take: 20
  });
  return NextResponse.json({ exams });
}
