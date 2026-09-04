import { prisma } from "@/lib/prisma";
import { moodle, moodleConfigured } from "@/lib/moodle";
import MoodleSyncButton from "@/components/MoodleSyncButton";

export const dynamic = "force-dynamic";

function Stat({ label, value, sub }: { label: string; value: string | number; sub?: string }) {
  return (
    <div className="card">
      <div className="text-[11px] text-[var(--text-tertiary)]">{label}</div>
      <div className="text-[20px] font-semibold mt-0.5">{value}</div>
      {sub && <div className="text-[10px] text-[var(--text-tertiary)]">{sub}</div>}
    </div>
  );
}

export default async function AdminHome() {
  const since7 = new Date(Date.now() - 7 * 86400_000);
  const [students, professors, admins, coursesMoodle, coursesLocal, enrollments, msgs7, users7, attempts, lastRuns] =
    await Promise.all([
      prisma.user.count({ where: { role: "STUDENT" } }),
      prisma.user.count({ where: { role: "PROFESSOR" } }),
      prisma.user.count({ where: { role: "ADMIN" } }),
      prisma.course.count({ where: { source: "MOODLE" } }),
      prisma.course.count({ where: { source: { not: "MOODLE" } } }),
      prisma.enrollment.count(),
      prisma.chatMessage.count({ where: { role: "user", createdAt: { gte: since7 } } }),
      prisma.chatMessage.groupBy({ by: ["userId"], where: { role: "user", createdAt: { gte: since7 } } }),
      prisma.examAttempt.count(),
      prisma.syncRun.findMany({ orderBy: { startedAt: "desc" }, take: 8 })
    ]);

  let moodleStatus: { ok: boolean; text: string } = { ok: false, text: "No configurado (faltan MOODLE_WS_URL / MOODLE_WS_TOKEN)" };
  if (moodleConfigured()) {
    try {
      const info = await moodle.siteInfo();
      moodleStatus = { ok: true, text: `${info.sitename} · Moodle ${info.release} · ${(info.functions || []).length} funciones` };
    } catch (e: any) {
      moodleStatus = { ok: false, text: `Sin respuesta: ${e.message}` };
    }
  }

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-4 gap-3">
        <Stat label="Estudiantes" value={students} />
        <Stat label="Docentes" value={professors} sub={`${admins} administrador(es)`} />
        <Stat label="Cursos" value={coursesMoodle + coursesLocal} sub={`${coursesMoodle} de Moodle · ${coursesLocal} locales/demo`} />
        <Stat label="Matrículas" value={enrollments} />
        <Stat label="Mensajes al Tutor IA (7 días)" value={msgs7} sub={`${users7.length} usuario(s) activo(s)`} />
        <Stat label="Intentos de examen IA" value={attempts} />
      </div>

      <div className="card">
        <div className="flex items-center justify-between gap-3">
          <div>
            <div className="text-[12px] font-medium">Conexión con Moodle</div>
            <div className={`text-[11px] mt-0.5 ${moodleStatus.ok ? "text-[#166534]" : "text-[#B91C1C]"}`}>
              {moodleStatus.ok ? "● " : "○ "}{moodleStatus.text}
            </div>
          </div>
          {moodleStatus.ok && <MoodleSyncButton scope="all" label="Sincronizar todo Moodle" />}
        </div>
        <div className="text-[10px] text-[var(--text-tertiary)] mt-2">
          "Sincronizar todo" recorre todos los cursos de Moodle, crea las cuentas de sus participantes (docentes y estudiantes) y actualiza contenidos, tareas y notas. Los usuarios individuales se sincronizan solos al entrar por LTI.
        </div>
      </div>

      <div className="card">
        <div className="text-[12px] font-medium mb-2">Últimas sincronizaciones</div>
        {lastRuns.length === 0 && <div className="text-[11px] text-[var(--text-tertiary)]">Aún no hay sincronizaciones registradas.</div>}
        <table className="w-full text-[11px]">
          <tbody>
            {lastRuns.map((r) => (
              <tr key={r.id} className="border-t border-[var(--border-tertiary)]">
                <td className="py-1.5 pr-2 whitespace-nowrap text-[var(--text-tertiary)]">{r.startedAt.toLocaleString("es-PA")}</td>
                <td className="py-1.5 pr-2">{r.scope === "all" ? "Todo Moodle" : "Usuario"}</td>
                <td className="py-1.5 pr-2 text-[var(--text-tertiary)]">{r.triggeredBy}</td>
                <td className="py-1.5 pr-2">{r.summary}</td>
                <td className={`py-1.5 ${r.ok ? "text-[#166534]" : "text-[#B45309]"}`} title={r.errors || ""}>{r.ok ? "OK" : "Con avisos"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
