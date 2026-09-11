import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin";
import { scrapeUdelasWebsite } from "@/lib/knowledge-ingestion";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

/** POST → dispara la ingesta del sitio web de UDELAS a la base de conocimiento (solo administradores). */
export async function POST() {
  const session = await requireAdmin();
  if (!session) return NextResponse.json({ error: "Solo administradores" }, { status: 403 });

  try {
    const result = await scrapeUdelasWebsite();
    return NextResponse.json({ ok: true, ...result });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || "Error al ingerir el sitio de UDELAS" }, { status: 500 });
  }
}
