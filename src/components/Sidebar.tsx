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
  ShieldCheck,
  FolderDown,
  PlusCircle,
  GraduationCap
} from "lucide-react";

type NavItem = { href: string; icon: any; label: string; badge?: string };
type NavGroup = { label: string; items: NavItem[]; tone?: "student" | "teacher" | "admin" };

const learning: NavGroup = {
  label: "Aprendizaje",
  tone: "student",
  items: [
    { href: "/dashboard", icon: LayoutDashboard, label: "Dashboard" },
    { href: "/cursos", icon: BookOpen, label: "Mis cursos" },
    { href: "/calendario", icon: Calendar, label: "Calendario" },
    { href: "/calificaciones", icon: BarChart3, label: "Calificaciones" }
  ]
};

const aiTools: NavGroup = {
  label: "Aprendizaje con IA",
  tone: "student",
  items: [
    { href: "/tutor", icon: Sparkles, label: "Tutor IA", badge: "IA" },
    { href: "/examenes", icon: FileCheck, label: "Exámenes IA" },
    { href: "/biblioteca", icon: Library, label: "Biblioteca IA" }
  ]
};

const journey: NavGroup = {
  label: "Mi trayectoria",
  tone: "student",
  items: [
    { href: "/microcredenciales", icon: Award, label: "Microcredenciales" },
    { href: "/portafolio", icon: Briefcase, label: "Portafolio" },
    { href: "/badges", icon: BadgeCheck, label: "Credenciales digitales" },
    { href: "/archivos", icon: FolderDown, label: "Mis archivos" }
  ]
};

const teaching: NavGroup = {
  label: "Docencia",
  tone: "teacher",
  items: [
    { href: "/cursos", icon: GraduationCap, label: "Mis cursos como docente" },
    { href: "/cursos/crear", icon: PlusCircle, label: "Crear curso" },
    { href: "/agentes", icon: Users, label: "Agentes docentes" },
    { href: "/analiticas", icon: LineChart, label: "Analíticas de mis cursos" }
  ]
};

const admin: NavGroup = {
  label: "Administración",
  tone: "admin",
  items: [
    { href: "/admin", icon: ShieldCheck, label: "Panel de administración" },
    { href: "/analiticas", icon: LineChart, label: "Analíticas institucionales" }
  ]
};

const toneClasses: Record<string, { activeBg: string; activeText: string; bar: string }> = {
  student: { activeBg: "bg-[var(--role-student-bg)]", activeText: "text-[var(--role-student)]", bar: "bg-[var(--role-student)]" },
  teacher: { activeBg: "bg-[var(--role-teacher-bg)]", activeText: "text-[var(--role-teacher)]", bar: "bg-[var(--role-teacher)]" },
  admin: { activeBg: "bg-[var(--role-admin-bg)]", activeText: "text-[var(--role-admin)]", bar: "bg-[var(--role-admin)]" }
};

const roleChip: Record<string, { label: string; bg: string; text: string }> = {
  STUDENT: { label: "Estudiante", bg: "var(--role-student-bg)", text: "var(--role-student)" },
  PROFESSOR: { label: "Docente", bg: "var(--role-teacher-bg)", text: "var(--role-teacher)" },
  ADMIN: { label: "Administrador", bg: "var(--role-admin-bg)", text: "var(--role-admin)" }
};

export default function Sidebar({
  userName,
  progress,
  role,
  open = false,
  onNavigate
}: {
  userName: string;
  progress: number;
  role?: string;
  open?: boolean;
  onNavigate?: () => void;
}) {
  const pathname = usePathname();

  let groups: NavGroup[];
  if (role === "ADMIN") {
    groups = [admin, learning, aiTools, teaching, journey];
  } else if (role === "PROFESSOR") {
    groups = [teaching, learning, aiTools, journey];
  } else {
    groups = [learning, aiTools, journey];
  }

  const chip = roleChip[role ?? "STUDENT"] ?? roleChip.STUDENT;

  return (
    <aside
      className={`fixed inset-y-0 left-0 z-40 w-[240px] sm:w-[220px] shrink-0 bg-white border-r border-[var(--border-tertiary)] flex flex-col overflow-y-auto transition-transform duration-200 ease-out
        lg:static lg:translate-x-0 lg:z-auto
        ${open ? "translate-x-0 shadow-xl" : "-translate-x-full"}`}
    >
      <div className="h-[52px] shrink-0 lg:hidden" aria-hidden="true" />
      <div className="px-3 pt-3 pb-2">
        <div className="text-xs text-[var(--text-secondary)]">Bienvenido,</div>
        <div className="text-sm font-medium">{userName}</div>
        <span
          className="inline-block mt-1.5 text-[10px] font-medium px-2 py-0.5 rounded-full"
          style={{ background: chip.bg, color: chip.text }}
        >
          {chip.label}
        </span>
        {role !== "ADMIN" && (
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
        )}
      </div>

      {groups.map((group) => {
        const tone = toneClasses[group.tone ?? "student"];
        return (
          <div key={group.label} className="mt-1">
            <div className="px-3 pt-2 pb-1 flex items-center gap-1.5">
              <span className={`w-1 h-3 rounded-full ${tone.bar}`} aria-hidden="true" />
              <span className="text-[10.5px] font-medium text-[var(--text-tertiary)]">
                {group.label}
              </span>
            </div>
            {group.items.map((item) => {
              const active = pathname === item.href || (item.href !== "/dashboard" && pathname?.startsWith(item.href));
              const Icon = item.icon;
              return (
                <Link
                  key={`${group.label}-${item.href}`}
                  href={item.href}
                  onClick={onNavigate}
                  className={`mx-1.5 my-0.5 flex items-center gap-2 px-3 py-2 rounded-lg text-[13px] transition-colors ${
                    active
                      ? `${tone.activeBg} ${tone.activeText} font-medium`
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
        );
      })}
      <div className="mt-auto p-3 text-[10px] text-[var(--text-tertiary)]">
        UDELAS AI Learning Platform · MVP v1.0
      </div>
    </aside>
  );
}
