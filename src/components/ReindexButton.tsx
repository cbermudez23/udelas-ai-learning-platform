"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { RefreshCw } from "lucide-react";

export default function ReindexButton({ retryErrors = false }: { retryErrors?: boolean }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  async function run() {
    setLoading(true); setMsg(null);
    try {
      const res = await fetch("/api/library/reindex", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ retryErrors }) });
      const d = await res.json();
      setMsg(res.ok ? `${d.indexed} indexado(s), ${d.failed} con error, ${d.pending} pendiente(s)` : d.error || "Error");
      router.refresh();
    } catch (e: any) { setMsg(e.message); } finally { setLoading(false); }
  }
  return (
    <div className="flex items-center gap-2">
      <button onClick={run} disabled={loading} className="inline-flex items-center gap-1.5 text-[11px] font-medium px-2.5 py-1.5 rounded-md border border-[var(--clr-brand2)] text-[var(--clr-brand2)] hover:bg-[#EEF3FF] disabled:opacity-50">
        <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} /> {loading ? "Indexando…" : "Indexar pendientes"}
      </button>
      {msg && <span className="text-[11px] text-[var(--text-tertiary)]">{msg}</span>}
    </div>
  );
}
