"use client";
import { useMemo, useState } from "react";
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
      <div className="flex items-center justify-between gap-3">
        <input
          value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar por nombre o correo…"
          className="text-[11px] border border-[var(--border-tertiary)] rounded-md px-2.5 py-1.5 w-[280px] bg-white"
        />
        <div className="text-[11px] text-[var(--text-tertiary)]">{list.length} de {users.length} usuario(s) {msg && `· ${msg}`}</div>
      </div>
      <div className="card overflow-x-auto p-0">
        <table className="w-full text-[11px]">
          <thead className="text-left text-[10px] uppercase tracking-wide text-[var(--text-tertiary)]">
            <tr>
              <th className="px-3 py-2">Nombre</th><th className="px-3 py-2">Correo</th><th className="px-3 py-2">Rol</th>
              <th className="px-3 py-2">Origen</th><th className="px-3 py-2 text-right">Cursos</th><th className="px-3 py-2 text-right">Mensajes IA</th>
              <th className="px-3 py-2 text-right">Acciones</th>
            </tr>
          </thead>
          <tbody>
            {list.map((u) => (
              <tr key={u.id} className="border-t border-[var(--border-tertiary)]">
                <td className="px-3 py-2 font-medium">{u.name}{u.id === currentUserId && <span className="text-[var(--text-tertiary)]"> (tú)</span>}</td>
                <td className="px-3 py-2 text-[var(--text-secondary)]">{u.email}</td>
                <td className="px-3 py-2">
                  <select
                    value={u.role} disabled={busy === u.id || u.id === currentUserId}
                    onChange={(e) => changeRole(u, e.target.value)}
                    className="border border-[var(--border-tertiary)] rounded px-1.5 py-0.5 bg-white text-[11px]"
                  >
                    {Object.entries(ROLE_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                  </select>
                </td>
                <td className="px-3 py-2">
                  {u.moodleUserId ? <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-[#FDF3E3] text-[#B45309]">Moodle #{u.moodleUserId}</span>
                    : u.viaLti ? <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-[#FDF3E3] text-[#B45309]">LTI</span>
                    : <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-[#EEF3FF] text-[var(--clr-brand2)]">Local</span>}
                </td>
                <td className="px-3 py-2 text-right">{u.enrollments}</td>
                <td className="px-3 py-2 text-right">{u.messages}</td>
                <td className="px-3 py-2 text-right whitespace-nowrap">
                  <button onClick={() => resetPassword(u)} disabled={busy === u.id} className="text-[var(--clr-brand2)] hover:underline mr-3">Contraseña</button>
                  <button onClick={() => remove(u)} disabled={busy === u.id || u.id === currentUserId} className="text-[#B91C1C] hover:underline disabled:opacity-40">Eliminar</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
