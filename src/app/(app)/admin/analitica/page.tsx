import { prisma } from "@/lib/prisma";
import { buildCourseTeacherSummary } from "@/lib/teacher";

export const dynamic = "force-dynamic";

interface Agg {
  key: string; faculty: string; program: string;
  courses: number; students: Set<string>; teachers: Set<string>;
  totals: number[]; atRisk: number; messages: number; documents: number;
}

export default async function AdminAnalitica() {
  const since30 = new Date(Date.now() - 30 * 86400_000);
  const courses = await prisma.course.findMany({
    where: { source: "MOODLE" },
    include: {
      enrollments: { select: { userId: true, roleInCourse: true } },
      _count: { select: { documents: true } }
    },
    orderBy: [{ faculty: "asc" }, { program: "asc" }, { name: "asc" }]
  });

  // Mensajes al Tutor IA por usuario (últimos 30 días)
  const msgs = await prisma.chatMessage.groupBy({ by: ["userId"], where: { role: "user", createdAt: { gte: since30 } }, _count: { _all: true } });
  const msgByUser = new Map<string, number>(msgs.map((m: any) => [m.userId as string, Number(m._count._all)]));

  const groups = new Map<string, Agg>();
  const courseRows: { name: string; faculty: string; program: string; students: number; avg: number | null; atRisk: number; docs: number }[] = [];

  for (const c of courses) {
    const faculty = c.faculty || "Sin facultad";
    const program = c.program || "Sin programa";
    const key = `${faculty}||${program}`;
    if (!groups.has(key)) groups.set(key, { key, faculty, program, courses: 0, students: new Set(), teachers: new Set(), totals: [], atRisk: 0, messages: 0, documents: 0 });
    const g = groups.get(key)!;
    g.courses++;
    g.documents += c._count.documents;
    const summary = await buildCourseTeacherSummary(c.id);
    const students = c.enrollments.filter((e) => e.roleInCourse !== "teacher");
    students.forEach((e) => { g.students.add(e.userId); g.messages += msgByUser.get(e.userId) || 0; });
    c.enrollments.filter((e) => e.roleInCourse === "teacher").forEach((e) => g.teachers.add(e.userId));
    if (summary) {
      g.atRisk += summary.atRiskCount;
      if (summary.averageTotal !== null) g.totals.push(summary.averageTotal);
    }
    courseRows.push({ name: c.name, faculty, program, students: students.length, avg: summary?.averageTotal ?? null, atRisk: summary?.atRiskCount ?? 0, docs: c._count.documents });
  }

  const rows = [...groups.values()].map((g) => ({
    ...g,
    studentCount: g.students.size,
    teacherCount: g.teachers.size,
    avg: g.totals.length ? Math.round((g.totals.reduce((a, b) => a + b, 0) / g.totals.length) * 10) / 10 : null
  }));
  const faculties = Array.from(new Set(rows.map((r) => r.faculty)));
  const maxStudents = Math.max(1, ...rows.map((r) => r.studentCount));
  const totalStudents = new Set(rows.flatMap((r) => [...r.students])).size;
  const totalRisk = rows.reduce((a, r) => a + r.atRisk, 0);

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="card"><div className="text-[11px] text-[var(--text-tertiary)]">Facultades</div><div className="text-[20px] font-semibold">{faculties.length}</div></div>
        <div className="card"><div className="text-[11px] text-[var(--text-tertiary)]">Programas</div><div className="text-[20px] font-semibold">{rows.length}</div></div>
        <div className="card"><div className="text-[11px] text-[var(--text-tertiary)]">Estudiantes (Moodle)</div><div className="text-[20px] font-semibold">{totalStudents}</div></div>
        <div className="card"><div className="text-[11px] text-[var(--text-tertiary)]">En riesgo</div><div className={`text-[20px] font-semibold ${totalRisk ? "text-[#B91C1C]" : "text-[#166534]"}`}>{totalRisk}</div></div>
      </div>

      {rows.length === 0 && (
        <div className="card text-[11px] text-[var(--text-tertiary)]">
          No hay cursos de Moodle sincronizados. Organiza los cursos en Moodle como Facultad → Programa (categoría → subcategoría) y sincroniza.
        </div>
      )}

      {faculties.map((f) => (
        <div key={f} className="card overflow-x-auto">
          <div className="text-[12px] font-semibold mb-2">{f}</div>
          <table className="w-full text-[11px] min-w-[640px]">
            <thead className="text-left text-[10px] uppercase tracking-wide text-[var(--text-tertiary)]">
              <tr><th className="py-1.5 pr-2">Programa</th><th className="py-1.5 pr-2 text-right">Cursos</th><th className="py-1.5 pr-2 text-right">Docentes</th><th className="py-1.5 pr-2 w-[220px]">Estudiantes</th><th className="py-1.5 pr-2 text-right">Promedio</th><th className="py-1.5 pr-2 text-right">En riesgo</th><th className="py-1.5 pr-2 text-right">Mensajes IA (30 d)</th><th className="py-1.5 text-right">Materiales</th></tr>
            </thead>
            <tbody>
              {rows.filter((r) => r.faculty === f).map((r) => (
                <tr key={r.key} className="border-t border-[var(--border-tertiary)]">
                  <td className="py-1.5 pr-2 font-medium">{r.program}</td>
                  <td className="py-1.5 pr-2 text-right">{r.courses}</td>
                  <td className="py-1.5 pr-2 text-right">{r.teacherCount}</td>
                  <td className="py-1.5 pr-2"><div className="flex items-center gap-2"><div className="prog-bar flex-1"><div className="prog-fill" style={{ width: `${(r.studentCount / maxStudents) * 100}%` }} /></div><span className="w-8 text-right">{r.studentCount}</span></div></td>
                  <td className="py-1.5 pr-2 text-right">{r.avg !== null ? `${r.avg}%` : "—"}</td>
                  <td className={`py-1.5 pr-2 text-right ${r.atRisk ? "text-[#B91C1C] font-medium" : ""}`}>{r.atRisk}</td>
                  <td className="py-1.5 pr-2 text-right">{r.messages}</td>
                  <td className="py-1.5 text-right">{r.documents}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ))}

      {courseRows.length > 0 && (
        <div className="card p-0 overflow-x-auto">
          <div className="px-3 py-2 text-[12px] font-medium border-b border-[var(--border-tertiary)]">Detalle por curso</div>
          <table className="w-full text-[11px]">
            <thead className="text-left text-[10px] uppercase tracking-wide text-[var(--text-tertiary)]">
              <tr><th className="px-3 py-2">Curso</th><th className="px-3 py-2">Facultad / Programa</th><th className="px-3 py-2 text-right">Estudiantes</th><th className="px-3 py-2 text-right">Promedio</th><th className="px-3 py-2 text-right">En riesgo</th><th className="px-3 py-2 text-right">Materiales</th></tr>
            </thead>
            <tbody>
              {courseRows.map((c) => (
                <tr key={c.name} className="border-t border-[var(--border-tertiary)]">
                  <td className="px-3 py-2 font-medium">{c.name}</td>
                  <td className="px-3 py-2 text-[var(--text-secondary)]">{c.faculty} / {c.program}</td>
                  <td className="px-3 py-2 text-right">{c.students}</td>
                  <td className="px-3 py-2 text-right">{c.avg !== null ? `${c.avg}%` : "—"}</td>
                  <td className={`px-3 py-2 text-right ${c.atRisk ? "text-[#B91C1C] font-medium" : ""}`}>{c.atRisk}</td>
                  <td className="px-3 py-2 text-right">{c.docs}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
