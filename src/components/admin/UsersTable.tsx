"use client";
import { useMemo, useState } from "react";
import { KeyRound, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";

type Row = {
  id: string; name: string; email: string; role: string; moodleUserId: number | null;
  viaLti: boolean; enrollments: number; messages: number; createdAt: string;
};
const ROLE_LABEL: Record<string, string> = { STUDENT: "Estudiante", PROFESSOR: "Docente", ADMIN: "Administrador" };

export default function UsersTable({ users, currentUserId }: { users: Row[]; currentUserId: string }) {
  const router = useRouter();
  const [q, setQ] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);

  const list = useMemo(() => {
    const t = q.toLowerCase().trim();
    return t ? users.filter((u) => u.name.toLowerCase().includes(t) || u.email.toLowerCase().includes(t)) : users;
  }, [q, users]);

  async function call(method: "PATCH" | "DELETE", body: any, okMsg: string) {
    setBusy(body.id); setMsg(null);
    try {
      const res = await fetch("/api/admin/users", { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      const data = await res.json();
      if (!res.ok) setMsg(data.error || "Error"); else { setMsg(okMsg); router.refresh(); }
    } catch (e: any) { setMsg(e.message); } finally { setBusy(null); }
  }

  function changeRole(u: Row, role: string) {
    if (role === u.role) return;
    if (!confirm(`¿Cambiar el rol de ${u.name} a ${ROLE_LABEL[role]}?`)) return;
    call("PATCH", { id: u.id, role }, `Rol de ${u.name} actualizado.`);
  }
  function resetPassword(u: Row) {
    const p = prompt(`Nueva contraseña para ${u.name} (mínimo 8 caracteres):`);
    if (!p) return;
    call("PATCH", { id: u.id, password: p }, `Contraseña de ${u.name} actualizada.`);
  }
  function remove(u: Row) {
    if (!confirm(`¿Eliminar la cuenta de ${u.name} (${u.email})? Se borrarán sus matrículas, notas y conversaciones en esta plataforma. Moodle no se toca.`)) return;
    call("DELETE", { id: u.id }, `Cuenta de ${u.name} eliminada.`);
  }

  return (
    <div className="space-y-2">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
        <input
          value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar por nombre o correo…"
          className="text-[11px] border border-[var(--border-tertiary)] rounded-md px-2.5 py-1.5 w-full sm:w-[280px] bg-white"
        />
        <div className="text-[11px] text-[var(--text-tertiary)]">{list.length} de {users.length} usuario(s) {msg && `· ${msg}`}</div>
      </div>
      <div className="card overflow-x-auto p-0">
        <table className="w-full text-[11px]">
          <thead className="text-left text-[10px] uppercase tracking-wide text-[var(--text-tertiary)]">
            <tr>
              <th className="px-3 py-2">Nombre</th>
              <th className="px-3 py-2 hidden sm:table-cell">Correo</th>
              <th className="px-3 py-2">Rol</th>
              <th className="px-3 py-2 hidden md:table-cell">Origen</th>
              <th className="px-3 py-2 text-right hidden md:table-cell">Cursos</th>
              <th className="px-3 py-2 text-right hidden lg:table-cell">Mens. IA</th>
              <th className="px-3 py-2 text-right">Acciones</th>
            </tr>
          </thead>
          <tbody>
            {list.map((u) => (
              <tr key={u.id} className="border-t border-[var(--border-tertiary)]">
                <td className="px-3 py-2 font-medium max-w-[100px] sm:max-w-[180px]">
                  <div className="truncate">{u.name}{u.id === currentUserId && <span className="text-[var(--text-tertiary)]"> (tú)</span>}</div>
                  {/* Subtexto con todos los datos extra, visible solo en móvil */}
                  <div className="sm:hidden text-[10px] text-[var(--text-tertiary)] space-y-0.5 mt-0.5">
                    <div className="truncate">{u.email}</div>
                    <div className="flex flex-wrap gap-x-2">
                      <span>{u.moodleUserId ? `Moodle #${u.moodleUserId}` : u.viaLti ? "LTI" : "Local"}</span>
                      <span>{u.enrollments} curso(s)</span>
                      <span>{u.messages} msj.</span>
                    </div>
                  </div>
                </td>
                <td className="px-3 py-2 text-[var(--text-secondary)] hidden sm:table-cell max-w-[160px]"><div className="truncate">{u.email}</div></td>
                <td className="px-3 py-2">
                  <select
                    value={u.role} disabled={busy === u.id || u.id === currentUserId}
                    onChange={(e) => changeRole(u, e.target.value)}
                    className="border border-[var(--border-tertiary)] rounded px-1 py-0.5 bg-white text-[10px] sm:text-[11px] w-[88px] sm:w-[110px]"
                  >
                    {Object.entries(ROLE_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                  </select>
                </td>
                <td className="px-3 py-2 hidden md:table-cell">
                  {u.moodleUserId ? <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-[#FDF3E3] text-[#B45309]">Moodle #{u.moodleUserId}</span>
                    : u.viaLti ? <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-[#FDF3E3] text-[#B45309]">LTI</span>
                    : <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-[#EEF3FF] text-[var(--clr-brand2)]">Local</span>}
                </td>
                <td className="px-3 py-2 text-right hidden md:table-cell">{u.enrollments}</td>
                <td className="px-3 py-2 text-right hidden lg:table-cell">{u.messages}</td>
                <td className="px-3 py-2 text-right whitespace-nowrap">
                  <button onClick={() => resetPassword(u)} disabled={busy === u.id} title="Restablecer contraseña" className="text-[var(--clr-brand2)] hover:underline mr-1.5 sm:mr-2 inline-flex items-center">
                    <KeyRound className="w-3.5 h-3.5 sm:hidden" />
                    <span className="hidden sm:inline">Contraseña</span>
                  </button>
                  <button onClick={() => remove(u)} disabled={busy === u.id || u.id === currentUserId} title="Eliminar" className="text-[#B91C1C] hover:underline disabled:opacity-40 inline-flex items-center">
                    <Trash2 className="w-3.5 h-3.5 sm:hidden" />
                    <span className="hidden sm:inline">Eliminar</span>
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
