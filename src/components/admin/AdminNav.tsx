"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";

const tabs = [
  { href: "/admin", label: "Resumen" },
  { href: "/admin/usuarios", label: "Usuarios" },
  { href: "/admin/cursos", label: "Cursos" },
  { href: "/admin/ia", label: "Configuración IA" }
];

export default function AdminNav() {
  const pathname = usePathname();
  return (
    <div className="flex gap-1 bg-white border border-[var(--border-tertiary)] rounded-md p-0.5">
      {tabs.map((t) => {
        const active = t.href === "/admin" ? pathname === "/admin" : pathname?.startsWith(t.href);
        return (
          <Link
            key={t.href}
            href={t.href}
            className={`text-[11px] px-2.5 py-1 rounded ${active ? "bg-[var(--clr-brand2)] text-white" : "text-[var(--text-secondary)] hover:bg-[#EEF3FF]"}`}
          >
            {t.label}
          </Link>
        );
      })}
    </div>
  );
}
