import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { generateChatCompletion, extractJson, AIConfigError } from "@/lib/ai";

interface GeneratedQuestion {
  question: string;
  options: string[];
  correctIndex: number;
  explanation: string;
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "No autenticado" }, { status: 401 });

  const { topic, numQuestions = 5, courseId } = await req.json();
  if (!topic || typeof topic !== "string") {
    return NextResponse.json({ error: "Debes indicar un tema." }, { status: 400 });
  }
  const n = Math.min(Math.max(Number(numQuestions) || 5, 3), 10);

  const prompt = `Genera un examen de opción múltiple sobre el tema: "${topic}".
Crea exactamente ${n} preguntas variadas y de calidad universitaria, en español.
Responde ÚNICAMENTE con un JSON válido (sin texto adicional, sin markdown), con esta forma exacta:
{
  "questions": [
    {
      "question": "texto de la pregunta",
      "options": ["opción A", "opción B", "opción C", "opción D"],
      "correctIndex": 0,
      "explanation": "breve explicación de por qué es correcta"
    }
  ]
}`;

  try {
    const raw = await generateChatCompletion(
      [
        {
          role: "system",
          content:
            "Eres un generador de exámenes universitarios para UDELAS. Respondes exclusivamente en JSON válido, sin explicaciones fuera del JSON."
        },
        { role: "user", content: prompt }
      ],
      { maxTokens: 2000, temperature: 0.5 }
    );

    const parsed = extractJson<{ questions: GeneratedQuestion[] }>(raw);
    if (!parsed.questions || parsed.questions.length === 0) {
      throw new Error("La IA no devolvió preguntas válidas.");
    }

    const exam = await prisma.exam.create({
      data: {
        title: `Examen IA: ${topic}`,
        topic,
        courseId: courseId || undefined,
        createdByAI: true,
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

    return NextResponse.json({ exam });
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

  const exams = await prisma.exam.findMany({
    orderBy: { createdAt: "desc" },
    include: { questions: true, course: true },
    take: 20
  });
  return NextResponse.json({ exams });
}
