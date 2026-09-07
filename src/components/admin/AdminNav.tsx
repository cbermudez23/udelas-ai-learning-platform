"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";

const tabs = [
  { href: "/admin",           label: "Resumen",       short: "Resumen" },
  { href: "/admin/usuarios",  label: "Usuarios",      short: "Usuarios" },
  { href: "/admin/cursos",    label: "Cursos",        short: "Cursos" },
  { href: "/admin/analitica", label: "Analítica",     short: "Analítica" },
  { href: "/admin/biblioteca",label: "Biblioteca",    short: "Bib." },
  { href: "/admin/ia",        label: "Configuración", short: "Config." }
];

export default function AdminNav() {
  const pathname = usePathname();
  return (
    <div className="flex bg-white border border-[var(--border-tertiary)] rounded-md p-0.5 overflow-x-auto max-w-full">
      {tabs.map((t) => {
        const active = t.href === "/admin" ? pathname === "/admin" : pathname?.startsWith(t.href);
        return (
          <Link
            key={t.href}
            href={t.href}
            className={`shrink-0 rounded px-2 py-1 whitespace-nowrap
              text-[10px] sm:text-[11px]
              ${active ? "bg-[var(--clr-brand2)] text-white" : "text-[var(--text-secondary)] hover:bg-[#EEF3FF]"}`}
          >
            {/* En pantallas muy pequeñas (< sm) usar etiqueta corta */}
            <span className="sm:hidden">{t.short}</span>
            <span className="hidden sm:inline">{t.label}</span>
          </Link>
        );
      })}
    </div>
  );
}
