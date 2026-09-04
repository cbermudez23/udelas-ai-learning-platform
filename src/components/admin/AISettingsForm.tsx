"use client";
import { useState } from "react";

type S = {
  aiEnabled: boolean; aiProvider: "auto" | "anthropic" | "openai"; anthropicModel: string; openaiModel: string;
  maxTokens: number; temperature: number; dailyMessageLimit: number; disabledMessage: string;
};

const ANTHROPIC_MODELS = ["claude-sonnet-4-5", "claude-haiku-4-5", "claude-opus-4-1"];
const OPENAI_MODELS = ["gpt-4o-mini", "gpt-4o", "gpt-4.1-mini"];

export default function AISettingsForm({ initial, keys }: { initial: S; keys: { anthropic: boolean; openai: boolean } }) {
  const [s, setS] = useState<S>(initial);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  function set<K extends keyof S>(k: K, v: S[K]) { setS((p) => ({ ...p, [k]: v })); }

  async function save() {
    setSaving(true); setMsg(null);
    try {
      const res = await fetch("/api/admin/settings", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(s) });
      const data = await res.json();
      if (!res.ok) setMsg(data.error || "Error al guardar"); else { setS(data.settings); setMsg("Configuración guardada. Aplica en menos de 30 segundos."); }
    } catch (e: any) { setMsg(e.message); } finally { setSaving(false); }
  }

  const label = "block text-[11px] font-medium mb-1";
  const input = "w-full text-[11px] border border-[var(--border-tertiary)] rounded-md px-2.5 py-1.5 bg-white";
  const help = "text-[10px] text-[var(--text-tertiary)] mt-1";

  return (
    <div className="grid grid-cols-2 gap-3">
      <div className="card space-y-3">
        <div className="text-[12px] font-medium">Proveedor y modelo</div>
        <label className="flex items-center gap-2 text-[11px]">
          <input type="checkbox" checked={s.aiEnabled} onChange={(e) => set("aiEnabled", e.target.checked)} />
          IA activa para estudiantes y docentes
        </label>
        <div>
          <span className={label}>Proveedor</span>
          <select value={s.aiProvider} onChange={(e) => set("aiProvider", e.target.value as S["aiProvider"])} className={input}>
            <option value="auto">Automático (Claude si hay clave; si no, OpenAI)</option>
            <option value="anthropic" disabled={!keys.anthropic}>Anthropic Claude {keys.anthropic ? "" : "(sin ANTHROPIC_API_KEY)"}</option>
            <option value="openai" disabled={!keys.openai}>OpenAI {keys.openai ? "" : "(sin OPENAI_API_KEY)"}</option>
          </select>
          <div className={help}>Las claves de API se gestionan en las variables de entorno de Render, no aquí.</div>
        </div>
        <div>
          <span className={label}>Modelo Claude</span>
          <input list="anthropic-models" value={s.anthropicModel} onChange={(e) => set("anthropicModel", e.target.value)} className={input} />
          <datalist id="anthropic-models">{ANTHROPIC_MODELS.map((m) => <option key={m} value={m} />)}</datalist>
        </div>
        <div>
          <span className={label}>Modelo OpenAI</span>
          <input list="openai-models" value={s.openaiModel} onChange={(e) => set("openaiModel", e.target.value)} className={input} />
          <datalist id="openai-models">{OPENAI_MODELS.map((m) => <option key={m} value={m} />)}</datalist>
        </div>
      </div>

      <div className="card space-y-3">
        <div className="text-[12px] font-medium">Límites y comportamiento</div>
        <div>
          <span className={label}>Límite de mensajes por usuario y día</span>
          <input type="number" min={0} value={s.dailyMessageLimit} onChange={(e) => set("dailyMessageLimit", Number(e.target.value))} className={input} />
          <div className={help}>0 = sin límite. Controla el costo de la API por estudiante.</div>
        </div>
        <div>
          <span className={label}>Longitud máxima de respuesta (tokens)</span>
          <input type="number" min={100} max={4096} value={s.maxTokens} onChange={(e) => set("maxTokens", Number(e.target.value))} className={input} />
          <div className={help}>≈ 800 tokens son unas 500 palabras. Más tokens = respuestas más largas y mayor costo.</div>
        </div>
        <div>
          <span className={label}>Creatividad (temperatura): {s.temperature}</span>
          <input type="range" min={0} max={1} step={0.1} value={s.temperature} onChange={(e) => set("temperature", Number(e.target.value))} className="w-full" />
          <div className={help}>0 = respuestas más precisas y repetibles · 1 = más variadas. Para tutoría se recomienda 0.3–0.5.</div>
        </div>
        <div>
          <span className={label}>Mensaje cuando la IA está apagada</span>
          <textarea value={s.disabledMessage} onChange={(e) => set("disabledMessage", e.target.value)} rows={2} className={input} />
        </div>
        <div className="flex items-center gap-3 pt-1">
          <button onClick={save} disabled={saving} className="text-[11px] font-medium px-3 py-1.5 rounded-md bg-[var(--clr-brand2)] text-white hover:opacity-90 disabled:opacity-50">
            {saving ? "Guardando…" : "Guardar configuración"}
          </button>
          {msg && <span className="text-[11px] text-[var(--text-tertiary)]">{msg}</span>}
        </div>
      </div>
    </div>
  );
}
