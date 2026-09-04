"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  BookOpen,
  Calendar,
  BarChart3,
  Sparkles,
  Users,
  FileCheck,
  Library,
  Award,
  Briefcase,
  BadgeCheck,
  LineChart,
  ShieldCheck
} from "lucide-react";

const sections: {
  label: string;
  items: { href: string; icon: any; label: string; badge?: string }[];
}[] = [
  {
    label: "Campus",
    items: [
      { href: "/dashboard", icon: LayoutDashboard, label: "Dashboard" },
      { href: "/cursos", icon: BookOpen, label: "Mis cursos" },
      { href: "/calendario", icon: Calendar, label: "Calendario" },
      { href: "/calificaciones", icon: BarChart3, label: "Calificaciones" }
    ]
  },
  {
    label: "Aprendizaje IA",
    items: [
      { href: "/tutor", icon: Sparkles, label: "Tutor IA", badge: "IA" },
      { href: "/agentes", icon: Users, label: "Agentes docentes" },
      { href: "/examenes", icon: FileCheck, label: "Exámenes IA" },
      { href: "/biblioteca", icon: Library, label: "Biblioteca IA" }
    ]
  },
  {
    label: "Mi trayectoria",
    items: [
      { href: "/microcredenciales", icon: Award, label: "Microcredenciales" },
      { href: "/portafolio", icon: Briefcase, label: "Portafolio" },
      { href: "/badges", icon: BadgeCheck, label: "Credenciales digitales" },
      { href: "/analiticas", icon: LineChart, label: "Analíticas" }
    ]
  }
];

export default function Sidebar({
  userName,
  progress,
  role
}: {
  userName: string;
  progress: number;
  role?: string;
}) {
  const pathname = usePathname();
  const visibleSections =
    role === "ADMIN"
      ? [
          ...sections,
          {
            label: "Administración",
            items: [{ href: "/admin", icon: ShieldCheck, label: "Panel de administración" }]
          }
        ]
      : sections;

  return (
    <aside className="w-[220px] shrink-0 bg-white border-r border-[var(--border-tertiary)] flex flex-col overflow-y-auto">
      <div className="px-3 pt-3 pb-2">
        <div className="text-xs text-[var(--text-secondary)]">Bienvenido,</div>
        <div className="text-sm font-medium">{userName}</div>
        <div className="mt-2">
          <div className="text-[11px] text-[var(--text-tertiary)] mb-1">
            Progreso general
          </div>
          <div className="prog-bar">
            <div className="prog-fill" style={{ width: `${progress}%` }} />
          </div>
          <div className="text-[10px] text-[var(--text-tertiary)] mt-1">
            {progress}% completado
          </div>
        </div>
      </div>

      {visibleSections.map((section) => (
        <div key={section.label}>
          <div className="px-3 pt-3 pb-1 text-[10px] font-medium uppercase tracking-wide text-[var(--text-tertiary)]">
            {section.label}
          </div>
          {section.items.map((item) => {
            const active = pathname?.startsWith(item.href);
            const Icon = item.icon;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`mx-1.5 my-0.5 flex items-center gap-2 px-3 py-2 rounded-lg text-[13px] transition-colors ${
                  active
                    ? "bg-[#EEF3FF] text-[var(--clr-brand2)] font-medium"
                    : "text-[var(--text-secondary)] hover:bg-[var(--bg-secondary)]"
                }`}
              >
                <Icon className="w-4 h-4 shrink-0" />
                <span className="truncate">{item.label}</span>
                {item.badge && (
                  <span className="ml-auto text-[9px] bg-[var(--clr-accent)] text-white px-1.5 py-0.5 rounded-full font-medium">
                    {item.badge}
                  </span>
                )}
              </Link>
            );
          })}
        </div>
      ))}
      <div className="mt-auto p-3 text-[10px] text-[var(--text-tertiary)]">
        UDELAS AI Learning Platform · MVP v0.1
      </div>
    </aside>
  );
}
