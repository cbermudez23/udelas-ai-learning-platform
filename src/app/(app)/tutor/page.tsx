import { Bot } from "lucide-react";
import ChatPanel from "@/components/ChatPanel";

export default function TutorPage() {
  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2 text-[13px] font-medium">
        <Bot className="w-4 h-4 text-[var(--clr-brand2)]" /> Tutor IA personalizado
      </div>
      <ChatPanel
        agentType="TUTOR"
        agentLabel="UALE — Asistente de Aprendizaje UDELAS"
        greeting="¡Hola! Soy UALE, tu tutor de IA personalizado. Puedo explicarte temas de tus cursos, resumir documentos, generar ejemplos o decirte qué necesitas reforzar. ¿Cómo te puedo ayudar hoy?"
        quickPrompts={[
          "¿Qué temas debo reforzar?",
          "Resume los conceptos clave de mi curso más avanzado",
          "¿Qué me falta para aprobar?",
          "Genera 3 ejemplos prácticos de lo que estoy estudiando"
        ]}
      />
    </div>
  );
}
