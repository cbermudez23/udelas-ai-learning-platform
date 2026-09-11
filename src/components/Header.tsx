"use client";

import { signOut } from "next-auth/react";
import Image from "next/image";
import { Brain, Bell, LogOut, Menu } from "lucide-react";

export default function Header({
  avatarInitials,
  onToggleMenu
}: {
  avatarInitials: string;
  onToggleMenu?: () => void;
}) {
  return (
    <header className="h-[52px] shrink-0 bg-brand text-white flex items-center gap-2 sm:gap-3 px-2 sm:px-4">
      <button
        onClick={onToggleMenu}
        aria-label="Abrir menú"
        className="lg:hidden w-8 h-8 -ml-1 shrink-0 rounded-lg flex items-center justify-center hover:bg-white/15 active:bg-white/20"
      >
        <Menu className="w-5 h-5" />
      </button>
      <div className="h-8 px-1.5 rounded-lg bg-white flex items-center justify-center shrink-0">
        <Image src="/images/udelas-logo.png" alt="UDELAS" width={80} height={37} className="h-6 w-auto" priority />
      </div>
      <div className="min-w-0">
        <div className="text-[13px] sm:text-[15px] font-medium leading-none truncate">
          UDELAS <span className="text-accent">AI</span> Learning Platform
        </div>
        <div className="text-[10px] sm:text-[11px] opacity-70 mt-0.5 truncate hidden xs:block">
          Universidad Especializada de las Américas · MVP v1.0
        </div>
      </div>
      <div className="ml-auto flex items-center gap-2 sm:gap-3 shrink-0">
        <span className="hidden sm:flex items-center gap-1 bg-accent text-white text-[10px] px-2 py-1 rounded-full font-medium">
          <Brain className="w-2.5 h-2.5" /> IA Activa
        </span>
        <Bell className="w-[18px] h-[18px] opacity-70 cursor-pointer hidden sm:block" />
        <button
          onClick={() => signOut({ callbackUrl: "/login" })}
          title="Cerrar sesión"
          className="w-[30px] h-[30px] rounded-full bg-white/20 border border-white/35 flex items-center justify-center text-xs font-medium hover:bg-white/30 transition-colors shrink-0"
        >
          {avatarInitials || <LogOut className="w-3.5 h-3.5" />}
        </button>
      </div>
    </header>
  );
}
