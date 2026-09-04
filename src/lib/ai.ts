/**
 * Adaptador de IA — UDELAS AI Learning Platform
 *
 * Permite conectar el Tutor IA (UALE) y los Agentes Docentes a un proveedor
 * real de IA sin acoplar el resto de la aplicación a un SDK específico.
 *
 * Prioridad de proveedor:
 *   1. ANTHROPIC_API_KEY  -> Claude (api.anthropic.com)
 *   2. OPENAI_API_KEY     -> OpenAI (api.openai.com)
 *
 * Si ninguna está configurada, se lanza AIConfigError para que la ruta API
 * pueda responder con un mensaje claro en lugar de fallar de forma opaca.
 */

export type ChatRole = "system" | "user" | "assistant";

export interface ChatTurn {
  role: ChatRole;
  content: string;
}

export class AIConfigError extends Error {}

import { getSettings, type AppSettings } from "@/lib/settings";

function getProvider(settings: AppSettings): "anthropic" | "openai" {
  const pref = settings.aiProvider;
  if (pref === "anthropic" && process.env.ANTHROPIC_API_KEY) return "anthropic";
  if (pref === "openai" && process.env.OPENAI_API_KEY) return "openai";
  if (process.env.ANTHROPIC_API_KEY) return "anthropic";
  if (process.env.OPENAI_API_KEY) return "openai";
  throw new AIConfigError(
    "No hay ninguna API key de IA configurada. Define ANTHROPIC_API_KEY u OPENAI_API_KEY en las variables de entorno."
  );
}

export async function generateChatCompletion(
  turns: ChatTurn[],
  opts: { maxTokens?: number; temperature?: number } = {}
): Promise<string> {
  const settings = await getSettings();
  const provider = getProvider(settings);
  const maxTokens = opts.maxTokens ?? settings.maxTokens ?? 1024;
  const temperature = opts.temperature ?? settings.temperature ?? 0.4;
  const ANTHROPIC_MODEL = settings.anthropicModel;
  const OPENAI_MODEL = settings.openaiModel;

  if (provider === "anthropic") {
    const system = turns.find((t) => t.role === "system")?.content;
    const messages = turns
      .filter((t) => t.role !== "system")
      .map((t) => ({ role: t.role, content: t.content }));

    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": process.env.ANTHROPIC_API_KEY as string,
        "anthropic-version": "2023-06-01"
      },
      body: JSON.stringify({
        model: ANTHROPIC_MODEL,
        max_tokens: maxTokens,
        temperature,
        system,
        messages
      })
    });

    if (!res.ok) {
      const errText = await res.text();
      throw new Error(`Error de Anthropic API (${res.status}): ${errText}`);
    }

    const data = await res.json();
    const textBlock = data.content?.find((b: any) => b.type === "text");
    return textBlock?.text ?? "";
  }

  // OpenAI
  const res = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${process.env.OPENAI_API_KEY}`
    },
    body: JSON.stringify({
      model: OPENAI_MODEL,
      max_tokens: maxTokens,
      temperature,
      messages: turns
    })
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`Error de OpenAI API (${res.status}): ${errText}`);
  }

  const data = await res.json();
  return data.choices?.[0]?.message?.content ?? "";
}

/** Intenta parsear un bloque JSON devuelto por el modelo, tolerando fences ```json ... ``` */
export function extractJson<T = unknown>(raw: string): T {
  const cleaned = raw.replace(/```json/gi, "").replace(/```/g, "").trim();
  return JSON.parse(cleaned) as T;
}
