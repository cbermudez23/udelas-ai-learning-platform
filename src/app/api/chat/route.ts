import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { generateChatCompletion, AIConfigError, type ChatTurn } from "@/lib/ai";
import { AgentType } from "@prisma/client";

const AGENT_SYSTEM_PROMPTS: Record<AgentType, string> = {
  TUTOR: `Eres UALE, el Tutor de IA institucional de la Universidad Especializada de las Américas (UDELAS).
Ayudas a estudiantes a comprender temas de sus cursos, resumir contenidos, generar ejemplos prácticos
y orientarlos sobre su progreso académico. Responde en español, de forma clara, cercana y pedagógica.
Basa tus respuestas en el contexto académico del estudiante que se te proporciona a continuación.
Si no tienes información suficiente, dilo honestamente en vez de inventar datos.`,
  PROFESSOR_QUESTION_BANK: `Eres un Agente Docente de UDELAS especializado en generar bancos de preguntas
de evaluación (opción múltiple, verdadero/falso y desarrollo) a partir del tema que indique el docente.
Responde en español, con preguntas claras, de distintos niveles de dificultad (taxonomía de Bloom) y con
sus respuestas correctas indicadas al final de cada pregunta.`,
  PROFESSOR_RUBRIC: `Eres un Agente Docente de UDELAS especializado en diseñar rúbricas de evaluación claras,
con criterios, niveles de desempeño (excelente/bueno/aceptable/insuficiente) y puntajes, en formato de tabla
en texto plano. Responde en español.`,
  PROFESSOR_STUDY_GUIDE: `Eres un Agente Docente de UDELAS especializado en generar guías de estudio
estructuradas (objetivos, temas clave, actividades sugeridas y preguntas de autoevaluación) a partir
del tema que indique el docente o estudiante. Responde en español.`,
  PROFESSOR_FEEDBACK: `Eres un Agente Docente de UDELAS especializado en dar retroalimentación constructiva
sobre trabajos académicos. Señala fortalezas, áreas de mejora concretas y una recomendación accionable.
Responde en español y con tono profesional y alentador.`,
  ADVISOR: `Eres el Agente Asesor Académico de UDELAS. Ayudas a estudiantes a entender su trayectoria
académica, qué necesitan para aprobar sus cursos y qué pasos siguen en su plan de estudios, usando el
contexto académico proporcionado. Responde en español, de forma clara y orientadora.`
};

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json({ error: "No autenticado" }, { status: 401 });
  }

  const body = await req.json();
  const message: string = (body.message || "").toString().trim();
  const agentType: AgentType = (body.agentType as AgentType) || "TUTOR";

  if (!message) {
    return NextResponse.json({ error: "Mensaje vacío" }, { status: 400 });
  }

  const userId = session.user.id;

  // Contexto académico del estudiante (RAG básico institucional: datos propios del usuario)
  const enrollments = await prisma.enrollment.findMany({
    where: { userId },
    include: {
      course: {
        include: {
          contents: { orderBy: [{ sectionOrder: "asc" }, { order: "asc" }] },
          assignments: { orderBy: { dueDate: "asc" } }
        }
      },
      grades: true
    }
  });

  const now = new Date();
  const contextLines = enrollments.map((e) => {
    const grades =
      e.grades.map((g) => `${g.label}: ${g.score}%${g.maxScore ? ` (${g.rawScore}/${g.maxScore})` : ""}`).join(", ") ||
      "sin notas aún";
    const topics = e.course.contents
      .filter((c) => !["label", "forum"].includes(c.modName))
      .map((c) => `${c.name} [${c.modName}]`)
      .slice(0, 40)
      .join("; ");
    const pending = e.course.assignments
      .filter((a) => a.dueDate && a.dueDate > now)
      .map((a) => `${a.name} (vence ${a.dueDate!.toLocaleDateString("es-PA")})`)
      .join(", ");
    const src = e.course.source === "MOODLE" ? "Moodle" : "Plataforma";
    return [
      `- ${e.course.name} (${e.course.professorName}) [${src}]: ${e.progressPercent}% completado. Notas: ${grades}`,
      topics ? `  Contenidos: ${topics}` : "",
      pending ? `  Tareas pendientes: ${pending}` : ""
    ]
      .filter(Boolean)
      .join("\n");
  });

  const academicContext =
    contextLines.length > 0
      ? `Contexto académico de ${session.user.name} (fecha actual: ${now.toLocaleDateString("es-PA")}):\n${contextLines.join("\n")}`
      : `El estudiante ${session.user.name} aún no tiene cursos matriculados en el sistema.`;

  // Historial reciente de la conversación (por tipo de agente)
  const history = await prisma.chatMessage.findMany({
    where: { userId, agentType },
    orderBy: { createdAt: "asc" },
    take: 20
  });

  const turns: ChatTurn[] = [
    { role: "system", content: `${AGENT_SYSTEM_PROMPTS[agentType]}\n\n${academicContext}` },
    ...history.map((h) => ({ role: h.role as "user" | "assistant", content: h.content })),
    { role: "user", content: message }
  ];

  try {
    const reply = await generateChatCompletion(turns, { maxTokens: 800 });

    await prisma.chatMessage.createMany({
      data: [
        { userId, role: "user", content: message, agentType },
        { userId, role: "assistant", content: reply, agentType }
      ]
    });

    return NextResponse.json({ reply });
  } catch (err) {
    if (err instanceof AIConfigError) {
      return NextResponse.json(
        {
          error:
            "El Tutor IA no está conectado a un proveedor de inteligencia artificial. Configura ANTHROPIC_API_KEY u OPENAI_API_KEY en las variables de entorno del servidor."
        },
        { status: 503 }
      );
    }
    console.error(err);
    return NextResponse.json(
      { error: "Ocurrió un error al generar la respuesta de IA." },
      { status: 500 }
    );
  }
}

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "No autenticado" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const agentType = (searchParams.get("agentType") as AgentType) || "TUTOR";

  const history = await prisma.chatMessage.findMany({
    where: { userId: session.user.id, agentType },
    orderBy: { createdAt: "asc" }
  });

  return NextResponse.json({ history });
}
