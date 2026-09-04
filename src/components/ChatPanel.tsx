"use client";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

import { useEffect, useRef, useState } from "react";
import { Sparkles, Send, Loader2 } from "lucide-react";

interface Msg {
  role: "user" | "assistant";
  content: string;
}

export default function ChatPanel({
  agentType,
  agentLabel,
  greeting,
  quickPrompts = []
}: {
  agentType: string;
  agentLabel: string;
  greeting: string;
  quickPrompts?: string[];
}) {
  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loaded, setLoaded] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    fetch(`/api/chat?agentType=${agentType}`)
      .then((r) => r.json())
      .then((data) => {
        if (data.history) {
          setMessages(
            data.history.map((h: any) => ({ role: h.role, content: h.content }))
          );
        }
      })
      .finally(() => setLoaded(true));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [agentType]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, loading]);

  async function send(text?: string) {
    const content = (text ?? input).trim();
    if (!content || loading) return;
    setError(null);
    setMessages((m) => [...m, { role: "user", content }]);
    setInput("");
    setLoading(true);
    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: content, agentType })
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Error desconocido");
      } else {
        setMessages((m) => [...m, { role: "assistant", content: data.reply }]);
      }
    } catch (e) {
      setError("No se pudo conectar con el servidor.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="card">
      <div className="flex items-center gap-2.5 mb-3 pb-2.5 border-b border-[var(--border-tertiary)]">
        <div className="w-10 h-10 rounded-lg bg-[#EEF3FF] flex items-center justify-center">
          <Sparkles className="w-5 h-5 text-[var(--clr-brand2)]" />
        </div>
        <div>
          <div className="text-[13px] font-medium">{agentLabel}</div>
          <div className="text-[11px] text-[var(--text-tertiary)]">
            Conectado a IA · Contexto académico activado
          </div>
        </div>
        <span className="ml-auto chip chip-green">En línea</span>
      </div>

      <div
        ref={scrollRef}
        className="h-[280px] overflow-y-auto p-2.5 flex flex-col gap-2 bg-[var(--bg-secondary)] rounded-lg mb-2.5"
      >
        {loaded && messages.length === 0 && (
          <div className="max-w-[88%] px-3 py-2 rounded-lg text-[12px] leading-relaxed bg-white border border-[var(--border-tertiary)] self-start rounded-bl-sm">
            {greeting}
          </div>
        )}
        {messages.map((m, i) => (
          <div
            key={i}
            className={`max-w-[88%] px-3 py-2 rounded-lg text-[12px] leading-relaxed ${
              m.role === "user"
                ? "bg-[var(--clr-brand2)] text-white self-end rounded-br-sm whitespace-pre-wrap"
                : "bg-white border border-[var(--border-tertiary)] self-start rounded-bl-sm chat-md"
            }`}
          >
            {m.role === "user" ? m.content : <ReactMarkdown remarkPlugins={[remarkGfm]}>{m.content}</ReactMarkdown>}
          </div>
        ))}
        {loading && (
          <div className="self-start flex items-center gap-1.5 text-[11px] text-[var(--text-tertiary)] px-1">
            <Loader2 className="w-3 h-3 animate-spin" /> {agentLabel} está escribiendo…
          </div>
        )}
      </div>

      {error && <div className="text-[11px] text-red-600 mb-2">{error}</div>}

      {quickPrompts.length > 0 && (
        <div className="flex gap-1.5 flex-wrap mb-2">
          {quickPrompts.map((p) => (
            <button
              key={p}
              onClick={() => send(p)}
              className="text-[11px] px-2.5 py-1 rounded-lg border border-[var(--border-secondary)] hover:bg-[var(--bg-secondary)] transition-colors"
            >
              {p}
            </button>
          ))}
        </div>
      )}

      <div className="flex gap-2">
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && send()}
          placeholder="Escribe tu mensaje..."
          className="flex-1 text-[13px] px-3 py-2 rounded-lg border border-[var(--border-secondary)] outline-none focus:border-[var(--clr-brand2)]"
        />
        <button
          onClick={() => send()}
          disabled={loading}
          className="bg-[var(--clr-brand2)] hover:bg-brand text-white rounded-lg px-3.5 py-2 disabled:opacity-60"
        >
          <Send className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}
