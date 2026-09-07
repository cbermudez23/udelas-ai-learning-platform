import { Award, BadgeCheck, FileCheck2, GraduationCap } from "lucide-react";

interface Props {
  microcredentials: { id: string; name: string; courseName: string | null; earnedAt: string }[];
  badges: { id: string; name: string; courseName: string | null; issuer: string | null; earnedAt: string }[];
  certificates: { id: string; title: string; createdAt: string }[];
}

function fmt(iso: string) {
  return new Date(iso).toLocaleDateString("es-PA", { year: "numeric", month: "long", day: "numeric" });
}

export default function AchievementsPanel({ microcredentials, badges, certificates }: Props) {
  const total = microcredentials.length + badges.length + certificates.length;
  if (total === 0) {
    return (
      <div className="card">
        <div className="flex items-center gap-2 text-[13px] font-medium mb-1">
          <GraduationCap className="w-4 h-4 text-[var(--clr-brand2)]" /> Logros académicos
        </div>
        <div className="text-[11px] text-[var(--text-tertiary)]">
          Aquí aparecerán automáticamente las microcredenciales, insignias y certificados que obtengas en tus cursos de Moodle.
        </div>
      </div>
    );
  }

  return (
    <div className="card">
      <div className="flex items-center gap-2 text-[13px] font-medium mb-3">
        <GraduationCap className="w-4 h-4 text-[var(--clr-brand2)]" /> Logros académicos
        <span className="text-[10px] font-normal text-[var(--text-tertiary)]">Sincronizados desde Moodle</span>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div>
          <div className="text-[11px] font-medium text-[var(--text-secondary)] mb-1.5 flex items-center gap-1"><Award className="w-3.5 h-3.5" /> Microcredenciales ({microcredentials.length})</div>
          {microcredentials.length === 0 && <div className="text-[10px] text-[var(--text-tertiary)]">Ninguna obtenida aún.</div>}
          <ul className="space-y-1.5">
            {microcredentials.map((m) => (
              <li key={m.id} className="text-[11px]">
                <div className="font-medium">{m.name}</div>
                <div className="text-[10px] text-[var(--text-tertiary)]">{m.courseName ? `${m.courseName} · ` : ""}{fmt(m.earnedAt)}</div>
              </li>
            ))}
          </ul>
        </div>
        <div>
          <div className="text-[11px] font-medium text-[var(--text-secondary)] mb-1.5 flex items-center gap-1"><BadgeCheck className="w-3.5 h-3.5" /> Insignias ({badges.length})</div>
          {badges.length === 0 && <div className="text-[10px] text-[var(--text-tertiary)]">Ninguna obtenida aún.</div>}
          <ul className="space-y-1.5">
            {badges.map((b) => (
              <li key={b.id} className="text-[11px]">
                <div className="font-medium">{b.name}</div>
                <div className="text-[10px] text-[var(--text-tertiary)]">{b.courseName ? `${b.courseName} · ` : ""}{fmt(b.earnedAt)}</div>
              </li>
            ))}
          </ul>
        </div>
        <div>
          <div className="text-[11px] font-medium text-[var(--text-secondary)] mb-1.5 flex items-center gap-1"><FileCheck2 className="w-3.5 h-3.5" /> Certificados ({certificates.length})</div>
          {certificates.length === 0 && <div className="text-[10px] text-[var(--text-tertiary)]">Ninguno generado aún.</div>}
          <ul className="space-y-1.5">
            {certificates.map((c) => (
              <li key={c.id} className="text-[11px]">
                <a href={`/api/exports/${c.id}`} target="_blank" rel="noreferrer" className="font-medium text-[var(--clr-brand2)] hover:underline">{c.title}</a>
                <div className="text-[10px] text-[var(--text-tertiary)]">{fmt(c.createdAt)}</div>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
}
