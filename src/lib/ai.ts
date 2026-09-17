/**
 * Adaptador de IA — UDELAS AI Learning Platform
 *
 * Permite conectar el Tutor IA (UALE) y los Agentes Docentes a un proveedor
 * real de IA sin acoplar el resto de la aplicación a un SDK específico.
 *
 * Prioridad de proveedor (con fallback automático si el principal falla):
 *   1. ANTHROPIC_API_KEY              -> Claude (api.anthropic.com)
 *   2. OPENAI_API_KEY                 -> OpenAI (api.openai.com)
 *   3. OLLAMA_BASE_URL / OLLAMA_MODEL -> Ollama local (interfaz OpenAI-compatible)
 *
 * Si el proveedor principal falla, se intenta automáticamente con el
 * siguiente disponible en la cadena. Si todos fallan, se lanza AIConfigError
 * para que la ruta API pueda responder con un mensaje claro en lugar de
 * fallar de forma opaca.
 */

export type ChatRole = "system" | "user" | "assistant";

export interface ChatTurn {
  role: ChatRole;
  content: string;
}

export class AIConfigError extends Error {}

import { getSettings, type AppSettings } from "@/lib/settings";

export type AIProvider = "anthropic" | "openai" | "ollama";

export interface CompletionResult {
  content: string;
  provider: AIProvider;
  model: string;
}

function getProvider(settings: AppSettings): AIProvider {
  const pref = settings.aiProvider;
  if (pref === "anthropic" && process.env.ANTHROPIC_API_KEY) return "anthropic";
  if (pref === "openai" && process.env.OPENAI_API_KEY) return "openai";
  if (pref === "ollama") return "ollama";
  if (process.env.ANTHROPIC_API_KEY) return "anthropic";
  if (process.env.OPENAI_API_KEY) return "openai";
  return "ollama";
}

/** Orden de intento para el fallback automático: principal primero, luego el resto por prioridad. */
function getProviderChain(settings: AppSettings): AIProvider[] {
  const primary = getProvider(settings);
  const priorityOrder: AIProvider[] = ["anthropic", "openai", "ollama"];
  const candidates = priorityOrder.filter((p) => {
    if (p === "anthropic") return !!process.env.ANTHROPIC_API_KEY;
    if (p === "openai") return !!process.env.OPENAI_API_KEY;
    return true; // Ollama no requiere API key, siempre se intenta como última opción
  });
  return [primary, ...candidates.filter((p) => p !== primary)];
}

function modelFor(provider: AIProvider, settings: AppSettings): string {
  if (provider === "anthropic") return settings.anthropicModel;
  if (provider === "openai") return settings.openaiModel;
  return settings.ollamaModel;
}

async function callAnthropic(
  turns: ChatTurn[],
  model: string,
  maxTokens: number,
  temperature: number
): Promise<{ content: string; model: string }> {
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
      model,
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
  return { content: textBlock?.text ?? "", model };
}

async function callOpenAI(
  turns: ChatTurn[],
  model: string,
  maxTokens: number,
  temperature: number
): Promise<{ content: string; model: string }> {
  const res = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${process.env.OPENAI_API_KEY}`
    },
    body: JSON.stringify({
      model,
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
  return { content: data.choices?.[0]?.message?.content ?? "", model };
}

/** Ollama expone una interfaz OpenAI-compatible en /v1/chat/completions. */
async function callOllama(
  turns: ChatTurn[],
  model: string,
  maxTokens: number,
  temperature: number,
  baseUrl: string
): Promise<{ content: string; model: string }> {
  const res = await fetch(`${baseUrl}/v1/chat/completions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      model,
      max_tokens: maxTokens,
      temperature,
      messages: turns
    })
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`Error de Ollama API (${res.status}): ${errText}`);
  }

  const data = await res.json();
  return { content: data.choices?.[0]?.message?.content ?? "", model };
}

async function callProvider(
  provider: AIProvider,
  turns: ChatTurn[],
  model: string,
  maxTokens: number,
  temperature: number,
  settings: AppSettings
): Promise<{ content: string; model: string }> {
  if (provider === "anthropic") return callAnthropic(turns, model, maxTokens, temperature);
  if (provider === "openai") return callOpenAI(turns, model, maxTokens, temperature);
  return callOllama(turns, model, maxTokens, temperature, settings.ollamaBaseUrl);
}

/**
 * Igual que generateChatCompletion, pero retorna también el proveedor y el
 * modelo efectivamente usados (útil para logging/depuración/UI).
 * Incluye fallback automático: si el proveedor principal falla, se intenta
 * con el siguiente disponible en la cadena de prioridad.
 */
export async function generateChatCompletionDetailed(
  turns: ChatTurn[],
  opts: { maxTokens?: number; temperature?: number } = {}
): Promise<CompletionResult> {
  const settings = await getSettings();
  const chain = getProviderChain(settings);
  const maxTokens = opts.maxTokens ?? settings.maxTokens ?? 1024;
  const temperature = opts.temperature ?? settings.temperature ?? 0.4;

  let lastError: unknown;

  for (const provider of chain) {
    const model = modelFor(provider, settings);
    const start = Date.now();
    try {
      const { content } = await callProvider(provider, turns, model, maxTokens, temperature, settings);
      const latencyMs = Date.now() - start;
      console.log(
        `[ai] provider=${provider} model=${model} maxTokens=${maxTokens} latencyMs=${latencyMs}`
      );
      return { content, provider, model };
    } catch (err) {
      const latencyMs = Date.now() - start;
      const msg = err instanceof Error ? err.message : String(err);
      console.log(
        `[ai] provider=${provider} model=${model} FAILED latencyMs=${latencyMs}: ${msg}`
      );
      lastError = err;
    }
  }

  const lastMsg = lastError instanceof Error ? lastError.message : String(lastError);
  throw new AIConfigError(
    `No fue posible obtener respuesta de ningún proveedor de IA (Anthropic, OpenAI, Ollama). Último error: ${lastMsg}`
  );
}

/**
 * Mantiene la firma original (retorna solo el texto) para no romper a los
 * consumidores existentes. Internamente usa generateChatCompletionDetailed,
 * que ya incluye fallback automático y logging.
 */
export async function generateChatCompletion(
  turns: ChatTurn[],
  opts: { maxTokens?: number; temperature?: number } = {}
): Promise<string> {
  const result = await generateChatCompletionDetailed(turns, opts);
  return result.content;
}

/** Intenta parsear un bloque JSON devuelto por el modelo, tolerando fences ```json ... ``` */
export function extractJson<T = unknown>(raw: string): T {
  const cleaned = raw.replace(/```json/gi, "").replace(/```/g, "").trim();
  return JSON.parse(cleaned) as T;
}
