import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { FlaskConical } from "lucide-react";
import TestCreateActivityForm from "@/components/TestCreateActivityForm";

export const dynamic = "force-dynamic";

export default async function ProbarActividadPage() {
  const session = await getServerSession(authOptions);
  if (!session) redirect("/login");
  if (session.user.role !== "ADMIN") redirect("/cursos");

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2 text-[13px] font-medium">
        <FlaskConical className="w-4 h-4 text-[var(--clr-brand2)]" /> Probar creación de actividad (plugin local_udelascreator)
      </div>
      <div className="text-[11px] text-[var(--text-tertiary)] max-w-lg">
        Página de prueba temporal, solo para administradores — sirve para confirmar que el plugin instalado en Moodle
        funciona antes de conectarlo a la interfaz normal del docente.
      </div>
      <TestCreateActivityForm />
    </div>
  );
}
