import Link from "next/link";
import { Users, HelpCircle, ClipboardList, BookOpenCheck, MessageSquareText, Compass } from "lucide-react";

const AGENTS = [
  {
    slug: "PROFESSOR_QUESTION_BANK",
    icon: HelpCircle,
    name: "Agente de Banco de Preguntas",
    desc: "Genera preguntas de opción múltiple, verdadero/falso y desarrollo sobre cualquier tema.",
    color: "#1A4DB0",
    bg: "#EEF3FF"
  },
  {
    slug: "PROFESSOR_RUBRIC",
    icon: ClipboardList,
    name: "Agente de Rúbricas",
    desc: "Diseña rúbricas de evaluación con criterios y niveles de desempeño.",
    color: "#8A5A10",
    bg: "#FDF3E3"
  },
  {
    slug: "PROFESSOR_STUDY_GUIDE",
    icon: BookOpenCheck,
    name: "Agente de Guías de Estudio",
    desc: "Crea guías de estudio estructuradas con objetivos y actividades sugeridas.",
    color: "#1A7A45",
    bg: "#E4F5EC"
  },
  {
    slug: "PROFESSOR_FEEDBACK",
    icon: MessageSquareText,
    name: "Agente de Retroalimentación",
    desc: "Ofrece retroalimentación constructiva y accionable sobre trabajos académicos.",
    color: "#5530A0",
    bg: "#F0EAFF"
  },
  {
    slug: "ADVISOR",
    icon: Compass,
    name: "Agente Asesor Académico",
    desc: "Orienta sobre trayectoria académica y qué se necesita para aprobar los cursos.",
    color: "#A03030",
    bg: "#FDEAEA"
  }
];

export default function AgentesPage() {
  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2 text-[13px] font-medium">
        <Users className="w-4 h-4 text-[var(--clr-brand2)]" /> Agentes docentes
      </div>
      <div className="grid grid-cols-2 gap-3">
        {AGENTS.map((a) => {
          const Icon = a.icon;
          return (
            <Link
              key={a.slug}
              href={`/agentes/${a.slug}`}
              className="border border-[var(--border-tertiary)] rounded-lg p-3 flex items-start gap-2.5 hover:border-[var(--clr-brand2)] transition-colors bg-white"
            >
              <div
                className="w-[38px] h-[38px] rounded-lg flex items-center justify-center shrink-0"
                style={{ background: a.bg, color: a.color }}
              >
                <Icon className="w-[18px] h-[18px]" />
              </div>
              <div>
                <div className="text-[12px] font-medium mb-0.5">{a.name}</div>
                <div className="text-[11px] text-[var(--text-secondary)] leading-snug">
                  {a.desc}
                </div>
              </div>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
