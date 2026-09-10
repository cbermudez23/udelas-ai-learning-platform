import { prisma } from "@/lib/prisma";
import { moodle, moodleConfigured } from "@/lib/moodle";
import MoodleSyncButton from "@/components/MoodleSyncButton";

export const dynamic = "force-dynamic";

/** Funciones que el servicio "UDELAS IA" debe tener habilitadas en Moodle. */
const EXPECTED_FUNCTIONS = [
  "core_webservice_get_site_info", "core_course_get_courses", "core_course_get_courses_by_field", "core_course_get_categories",
  "core_course_get_contents", "core_enrol_get_users_courses", "core_enrol_get_enrolled_users", "core_user_get_users_by_field",
  "gradereport_user_get_grade_items", "mod_assign_get_assignments", "mod_forum_get_forums_by_courses",
  "core_completion_get_activities_completion_status", "core_calendar_get_action_events_by_course",
  "core_badges_get_user_badges", "core_completion_get_course_completion_status",
  "core_competency_list_course_competencies", "tool_lp_data_for_user_competency_summary_in_course",
  "mod_assign_get_submissions", "mod_assign_get_grades", "core_grades_update_grades", "mod_assign_save_grades", "core_course_create_courses", "enrol_manual_enrol_users", "core_course_update_courses", "core_courseformat_update_course", "core_courseformat_new_module", "core_update_inplace_editable", "local_udelascreator_create_activity"
];

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

  let missing: string[] = [];
  let downloadFiles = true;
  let moodleStatus: { ok: boolean; text: string } = { ok: false, text: "No configurado (faltan MOODLE_WS_URL / MOODLE_WS_TOKEN)" };
  if (moodleConfigured()) {
    try {
      const info = await moodle.siteInfo();
      const have = new Set<string>((info.functions || []).map((f: any) => f.name));
      missing = EXPECTED_FUNCTIONS.filter((f) => !have.has(f));
      downloadFiles = info.downloadfiles === 1;
      moodleStatus = { ok: true, text: `${info.sitename} · Moodle ${info.release} · ${have.size} funciones${missing.length ? "" : " · todas las funciones requeridas están habilitadas"}` };
    } catch (e: any) {
      moodleStatus = { ok: false, text: `Sin respuesta: ${e.message}` };
    }
  }

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
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
        {moodleStatus.ok && (missing.length > 0 || !downloadFiles) && (
          <div className="mt-2 text-[11px] text-[#B45309] bg-[#FDF3E3] rounded-md px-3 py-2">
            <div className="font-medium">Configuración incompleta en el servicio web "UDELAS IA" de Moodle:</div>
            {missing.length > 0 && <div>Faltan funciones: {missing.join(", ")}</div>}
            {!downloadFiles && <div>Falta marcar "Puede descargar archivos" (la Biblioteca IA no podrá indexar los archivos).</div>}
          </div>
        )}
        <div className="text-[10px] text-[var(--text-tertiary)] mt-2">
          "Sincronizar todo" recorre todos los cursos de Moodle, crea las cuentas de sus participantes (docentes y estudiantes) y actualiza contenidos, tareas y notas. Los usuarios individuales se sincronizan solos al entrar por LTI.
        </div>
      </div>

      <div className="card overflow-x-auto">
        <div className="text-[12px] font-medium mb-2">Últimas sincronizaciones</div>
        {lastRuns.length === 0 && <div className="text-[11px] text-[var(--text-tertiary)]">Aún no hay sincronizaciones registradas.</div>}
        <table className="w-full text-[11px]">
          <tbody>
            {lastRuns.map((r) => (
              <tr key={r.id} className="border-t border-[var(--border-tertiary)]">
                <td className="py-1.5 pr-2 max-w-[200px]">
                  <div className="text-[10px] text-[var(--text-tertiary)] whitespace-nowrap">{r.startedAt.toLocaleString("es-PA")}</div>
                  <div className="sm:hidden text-[10px] text-[var(--text-tertiary)] mt-0.5">
                    <div>{r.scope === "all" ? "Todo Moodle" : "Usuario"} · {r.triggeredBy}</div>
                    <div className="truncate">{r.summary}</div>
                  </div>
                </td>
                <td className="py-1.5 pr-2 hidden sm:table-cell">{r.scope === "all" ? "Todo Moodle" : "Usuario"}</td>
                <td className="py-1.5 pr-2 text-[var(--text-tertiary)] hidden sm:table-cell max-w-[120px]"><div className="truncate">{r.triggeredBy}</div></td>
                <td className="py-1.5 pr-2 hidden sm:table-cell max-w-[180px]"><div className="truncate">{r.summary}</div></td>
                <td className={`py-1.5 ${r.ok ? "text-[#166534]" : "text-[#B45309]"}`} title={r.errors || ""}>{r.ok ? "OK" : "Con avisos"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
