import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import ChatPanel from "@/components/ChatPanel";
import { notFound } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

// Las sugerencias se construyen con el primer curso real del usuario (Moodle)
function buildPrompts(slug: string, course?: { name: string; sections: string[]; assignments: string[] }): string[] {
  const c = course?.name;
  const sec = course?.sections[0];
  const task = course?.assignments[0];
  switch (slug) {
    case "PROFESSOR_QUESTION_BANK":
      return c
        ? [`Genera 5 preguntas de opción múltiple sobre ${sec ? `"${sec}" de ` : ""}${c}`, `Genera 3 preguntas de desarrollo sobre los contenidos de ${c}`]
        : ["Genera 5 preguntas de opción múltiple sobre el tema que indique"];
    case "PROFESSOR_RUBRIC":
      return c ? [`Crea una rúbrica para ${task ? `"${task}"` : `una actividad de ${c}`}`] : ["Crea una rúbrica para un ensayo"];
    case "PROFESSOR_STUDY_GUIDE":
      return c ? [`Prepara una guía de estudio sobre ${sec ? `"${sec}" de ` : ""}${c}`, `Guía para prepararse para ${task || "la próxima tarea"}`] : ["Crea una guía de estudio sobre un tema"];
    case "PROFESSOR_FEEDBACK":
      return c ? [`¿Qué mensaje envío a los estudiantes en riesgo de ${c}?`] : [];
    case "ADVISOR":
      return c ? ["¿Qué me falta para aprobar este período?", `¿Cómo voy en ${c}?`] : ["¿Qué me falta para aprobar este período?"];
    default:
      return [];
  }
}

const AGENTS: Record<string, { name: string; greeting: string; prompts: string[] }> = {
  PROFESSOR_QUESTION_BANK: {
    name: "Agente de Banco de Preguntas",
    greeting:
      "Indícame el tema, el curso y cuántas preguntas necesitas, y generaré un banco de preguntas para tu evaluación.",
    prompts: [
      "Genera 5 preguntas de opción múltiple sobre redes neuronales",
      "Genera 3 preguntas de desarrollo sobre ética en IA"
    ]
  },
  PROFESSOR_RUBRIC: {
    name: "Agente de Rúbricas",
    greeting: "Cuéntame qué actividad vas a evaluar y diseñaré una rúbrica clara con criterios y niveles.",
    prompts: ["Crea una rúbrica para un ensayo de psicología educativa"]
  },
  PROFESSOR_STUDY_GUIDE: {
    name: "Agente de Guías de Estudio",
    greeting: "Dime el tema o curso y prepararé una guía de estudio estructurada.",
    prompts: ["Crea una guía de estudio sobre rehabilitación cognitiva"]
  },
  PROFESSOR_FEEDBACK: {
    name: "Agente de Retroalimentación",
    greeting: "Pega el texto o resumen del trabajo del estudiante y te daré retroalimentación constructiva.",
    prompts: []
  },
  ADVISOR: {
    name: "Agente Asesor Académico",
    greeting: "Puedo ayudarte a entender tu trayectoria académica y qué necesitas para avanzar. ¿Qué te gustaría saber?",
    prompts: ["¿Qué me falta para aprobar este período?"]
  }
};

export default async function AgentDetailPage({ params }: { params: { slug: string } }) {
  const agent = AGENTS[params.slug];
  if (!agent) notFound();

  const session = await getServerSession(authOptions);
  const enr = await prisma.enrollment.findFirst({
    where: { userId: session!.user.id },
    orderBy: [{ roleInCourse: "desc" }, { createdAt: "asc" }], // docente primero
    include: {
      course: {
        include: {
          contents: { where: { modName: { notIn: ["label", "forum", "lti"] } }, orderBy: [{ sectionOrder: "asc" }, { order: "asc" }], take: 5 },
          assignments: { orderBy: { dueDate: "asc" }, take: 3 }
        }
      }
    }
  });
  const course = enr
    ? {
        name: enr.course.name,
        sections: Array.from(new Set<string>(enr.course.contents.map((c: { sectionName: string }) => c.sectionName).filter((n: string) => !/^(General|Nueva sección)$/i.test(n)))).concat(enr.course.contents.map((c: { name: string }) => c.name as string)),
        assignments: enr.course.assignments.map((a) => a.name)
      }
    : undefined;
  const prompts = buildPrompts(params.slug, course);

  return (
    <div className="space-y-3">
      <Link
        href="/agentes"
        className="inline-flex items-center gap-1 text-[12px] text-[var(--text-secondary)] hover:text-[var(--clr-brand2)]"
      >
        <ArrowLeft className="w-3.5 h-3.5" /> Volver a Agentes docentes
      </Link>
      <ChatPanel
        agentType={params.slug}
        agentLabel={agent.name}
        greeting={agent.greeting}
        quickPrompts={prompts}
      />
    </div>
  );
}
