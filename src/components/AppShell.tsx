"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import Header from "@/components/Header";
import Sidebar from "@/components/Sidebar";

export default function AppShell({
  avatarInitials,
  userName,
  progress,
  role,
  children
}: {
  avatarInitials: string;
  userName: string;
  progress: number;
  role?: string;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();

  // Cierra el drawer automáticamente al navegar a otra página.
  useEffect(() => {
    setOpen(false);
  }, [pathname]);

  return (
    <div className="h-screen flex flex-col overflow-hidden">
      <Header avatarInitials={avatarInitials} onToggleMenu={() => setOpen((v) => !v)} />
      <div className="flex flex-1 overflow-hidden relative">
        {/* Fondo oscuro tras el drawer en móvil/tablet; toca para cerrar */}
        {open && (
          <div
            className="fixed inset-0 z-30 bg-black/40 lg:hidden"
            onClick={() => setOpen(false)}
            aria-hidden="true"
          />
        )}
        <Sidebar userName={userName} progress={progress} role={role} open={open} onNavigate={() => setOpen(false)} />
        <main className="flex-1 min-w-0 overflow-y-auto overflow-x-clip p-3 sm:p-4 bg-[var(--bg-tertiary)]">
          {children}
        </main>
      </div>
    </div>
  );
}
