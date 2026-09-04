"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { RefreshCw } from "lucide-react";

interface Props {
  scope?: "me" | "all";
  label?: string;
}

export default function MoodleSyncButton({ scope = "me", label = "Actualizar desde Moodle" }: Props) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  async function run() {
    setLoading(true);
    setMsg(null);
    try {
      const res = await fetch("/api/moodle/sync", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ scope })
      });
      const data = await res.json();
      if (!res.ok) {
        setMsg(data.error || "Error al sincronizar");
      } else {
        const r = data.report;
        const base = `${r.courses} curso(s), ${r.enrollments} matrícula(s), ${r.grades} nota(s)`;
        setMsg(r.errors?.length ? `${base} · ${r.errors[0]}` : `Sincronizado: ${base}`);
        router.refresh();
      }
    } catch (e: any) {
      setMsg(e.message || "Error de red");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex items-center gap-2">
      <button
        onClick={run}
        disabled={loading}
        className="inline-flex items-center gap-1.5 text-[11px] font-medium px-2.5 py-1.5 rounded-md border border-[var(--clr-brand2)] text-[var(--clr-brand2)] hover:bg-[#EEF3FF] disabled:opacity-50"
      >
        <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} />
        {loading ? "Sincronizando…" : label}
      </button>
      {msg && <span className="text-[11px] text-[var(--text-tertiary)]">{msg}</span>}
    </div>
  );
}
