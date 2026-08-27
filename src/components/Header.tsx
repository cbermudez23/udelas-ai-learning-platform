"use client";

import { signOut } from "next-auth/react";
import { Brain, Bell, LogOut } from "lucide-react";

export default function Header({
  avatarInitials
}: {
  avatarInitials: string;
}) {
  return (
    <header className="h-[52px] shrink-0 bg-brand text-white flex items-center gap-3 px-4">
      <div className="w-8 h-8 rounded-lg bg-accent flex items-center justify-center text-sm font-medium">
        U
      </div>
      <div>
        <div className="text-[15px] font-medium leading-none">
          UDELAS <span className="text-accent">AI</span> Learning Platform
        </div>
        <div className="text-[11px] opacity-70 mt-0.5">
          Universidad Especializada de las Américas · MVP v1.0
        </div>
      </div>
      <div className="ml-auto flex items-center gap-3">
        <span className="flex items-center gap-1 bg-accent text-white text-[10px] px-2 py-1 rounded-full font-medium">
          <Brain className="w-2.5 h-2.5" /> IA Activa
        </span>
        <Bell className="w-[18px] h-[18px] opacity-70 cursor-pointer" />
        <button
          onClick={() => signOut({ callbackUrl: "/login" })}
          title="Cerrar sesión"
          className="w-[30px] h-[30px] rounded-full bg-white/20 border border-white/35 flex items-center justify-center text-xs font-medium hover:bg-white/30 transition-colors"
        >
          {avatarInitials || <LogOut className="w-3.5 h-3.5" />}
        </button>
      </div>
    </header>
  );
}
