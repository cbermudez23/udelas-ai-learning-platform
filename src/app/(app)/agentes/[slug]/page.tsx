import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import ChatPanel from "@/components/ChatPanel";
import { notFound } from "next/navigation";

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

export default function AgentDetailPage({ params }: { params: { slug: string } }) {
  const agent = AGENTS[params.slug];
  if (!agent) notFound();

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
        quickPrompts={agent.prompts}
      />
    </div>
  );
}
