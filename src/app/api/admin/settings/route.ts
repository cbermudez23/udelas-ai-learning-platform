import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin";
import { getSettings, saveSettings } from "@/lib/settings";

export const dynamic = "force-dynamic";

export async function GET() {
  const session = await requireAdmin();
  if (!session) return NextResponse.json({ error: "Solo administradores" }, { status: 403 });
  return NextResponse.json(await getSettings());
}

export async function PUT(req: NextRequest) {
  const session = await requireAdmin();
  if (!session) return NextResponse.json({ error: "Solo administradores" }, { status: 403 });
  const body = await req.json().catch(() => ({}));

  const patch: any = {};
  if (typeof body.aiEnabled === "boolean") patch.aiEnabled = body.aiEnabled;
  if (["auto", "anthropic", "openai"].includes(body.aiProvider)) patch.aiProvider = body.aiProvider;
  if (typeof body.anthropicModel === "string" && body.anthropicModel.trim()) patch.anthropicModel = body.anthropicModel.trim();
  if (typeof body.openaiModel === "string" && body.openaiModel.trim()) patch.openaiModel = body.openaiModel.trim();
  if (Number.isFinite(Number(body.maxTokens))) patch.maxTokens = Math.min(4096, Math.max(100, Number(body.maxTokens)));
  if (Number.isFinite(Number(body.temperature))) patch.temperature = Math.min(1, Math.max(0, Number(body.temperature)));
  if (Number.isFinite(Number(body.dailyMessageLimit))) patch.dailyMessageLimit = Math.max(0, Math.floor(Number(body.dailyMessageLimit)));
  if (typeof body.disabledMessage === "string") patch.disabledMessage = body.disabledMessage.slice(0, 300);

  const settings = await saveSettings(patch);
  return NextResponse.json({ ok: true, settings });
}
