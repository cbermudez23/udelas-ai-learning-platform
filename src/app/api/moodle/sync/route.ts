import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { syncAll, syncUser } from "@/lib/moodle-sync";

export const dynamic = "force-dynamic";
export const maxDuration = 120;

/**
 * POST /api/moodle/sync
 *   body: { scope: "me" }   → sincroniza solo al usuario con sesión (cualquier rol)
 *   body: { scope: "all" }  → sincroniza todo Moodle (solo ADMIN, o cabecera x-sync-secret)
 *
 * La cabecera x-sync-secret (= MOODLE_SYNC_SECRET) permite lanzar "all" desde
 * una tarea programada (cron externo) sin sesión de usuario.
 */
export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  const scope = body.scope === "all" ? "all" : "me";

  const secret = (process.env.MOODLE_SYNC_SECRET || "").trim();
  const headerSecret = (req.headers.get("x-sync-secret") || "").trim();
  const viaSecret = Boolean(secret) && headerSecret === secret;

  const session = await getServerSession(authOptions);

  try {
    if (scope === "all") {
      const isAdmin = session?.user?.role === "ADMIN";
      if (!isAdmin && !viaSecret) {
        return NextResponse.json({ error: "Solo un administrador puede sincronizar todo Moodle." }, { status: 403 });
      }
      const report = await syncAll();
      await logRun("all", session?.user?.email || "cron", report);
      return NextResponse.json({ ok: report.errors.length === 0, scope, report });
    }

    if (!session?.user?.id) {
      return NextResponse.json({ error: "No autenticado" }, { status: 401 });
    }
    const report = await syncUser(session.user.id);
    await logRun("me", session.user.email || session.user.id, report);
    return NextResponse.json({ ok: report.errors.length === 0, scope, report });
  } catch (e: any) {
    console.error("Error en sincronización Moodle:", e);
    return NextResponse.json({ error: e.message || "Error al sincronizar con Moodle" }, { status: 500 });
  }
}

async function logRun(scope: string, triggeredBy: string, r: Awaited<ReturnType<typeof syncAll>>) {
  try {
    const { prisma } = await import("@/lib/prisma");
    await prisma.syncRun.create({
      data: {
        scope,
        triggeredBy,
        startedAt: new Date(r.startedAt),
        finishedAt: r.finishedAt ? new Date(r.finishedAt) : new Date(),
        ok: r.errors.length === 0,
        summary: `${r.courses} curso(s), ${r.enrollments} matrícula(s), ${r.contents} contenido(s), ${r.assignments} tarea(s), ${r.grades} nota(s), ${r.users} usuario(s) nuevo(s)`,
        errors: r.errors.length ? r.errors.join("\n") : null
      }
    });
  } catch (e) {
    console.warn("No se pudo registrar la sincronización:", e);
  }
}

/** GET /api/moodle/sync → estado de la conexión (sin sincronizar). */
export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({ error: "No autenticado" }, { status: 401 });

  const { moodle, moodleConfigured } = await import("@/lib/moodle");
  if (!moodleConfigured()) return NextResponse.json({ configured: false });

  try {
    const info = await moodle.siteInfo();
    return NextResponse.json({
      configured: true,
      reachable: true,
      sitename: info.sitename,
      release: info.release,
      functions: (info.functions || []).length
    });
  } catch (e: any) {
    return NextResponse.json({ configured: true, reachable: false, error: e.message });
  }
}
