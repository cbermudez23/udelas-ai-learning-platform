/**
 * Configuración de la plataforma editable desde /admin/ia.
 * Se guarda en la tabla AppSetting; si una clave no existe, se usa el valor
 * de la variable de entorno equivalente o el predeterminado.
 */
import { prisma } from "@/lib/prisma";

export interface AppSettings {
  aiEnabled: boolean;
  aiProvider: "auto" | "anthropic" | "openai";
  anthropicModel: string;
  openaiModel: string;
  maxTokens: number;
  temperature: number;
  dailyMessageLimit: number; // 0 = sin límite
  disabledMessage: string;
}

export const DEFAULT_SETTINGS: AppSettings = {
  aiEnabled: true,
  aiProvider: "auto",
  anthropicModel: process.env.ANTHROPIC_MODEL || "claude-sonnet-4-5",
  openaiModel: process.env.OPENAI_MODEL || "gpt-4o-mini",
  maxTokens: 800,
  temperature: 0.4,
  dailyMessageLimit: 0,
  disabledMessage: "El Tutor IA está temporalmente en mantenimiento. Intenta más tarde."
};

let cache: { at: number; value: AppSettings } | null = null;
const TTL_MS = 30_000;

export async function getSettings(): Promise<AppSettings> {
  if (cache && Date.now() - cache.at < TTL_MS) return cache.value;
  const rows = await prisma.appSetting.findMany();
  const map = new Map<string, string>(rows.map((r: { key: string; value: string }) => [r.key, r.value]));
  const s: AppSettings = { ...DEFAULT_SETTINGS };
  if (map.has("aiEnabled")) s.aiEnabled = map.get("aiEnabled") === "true";
  if (map.has("aiProvider")) s.aiProvider = map.get("aiProvider") as AppSettings["aiProvider"];
  if (map.has("anthropicModel")) s.anthropicModel = map.get("anthropicModel")!;
  if (map.has("openaiModel")) s.openaiModel = map.get("openaiModel")!;
  if (map.has("maxTokens")) s.maxTokens = Number(map.get("maxTokens")) || s.maxTokens;
  if (map.has("temperature")) s.temperature = Number(map.get("temperature"));
  if (map.has("dailyMessageLimit")) s.dailyMessageLimit = Number(map.get("dailyMessageLimit")) || 0;
  if (map.has("disabledMessage")) s.disabledMessage = map.get("disabledMessage")!;
  cache = { at: Date.now(), value: s };
  return s;
}

export async function saveSettings(patch: Partial<AppSettings>): Promise<AppSettings> {
  const entries = Object.entries(patch).filter(([k]) => k in DEFAULT_SETTINGS);
  for (const [key, value] of entries) {
    await prisma.appSetting.upsert({
      where: { key },
      update: { value: String(value) },
      create: { key, value: String(value) }
    });
  }
  cache = null;
  return getSettings();
}

/** Correos con acceso de administrador (variable ADMIN_EMAILS, separados por coma). */
export function adminEmails(): string[] {
  return (process.env.ADMIN_EMAILS || "")
    .split(",")
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);
}
