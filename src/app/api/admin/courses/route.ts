import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/admin";

export const dynamic = "force-dynamic";

/** DELETE { id } | { source: "LOCAL" } (borra todos los cursos demo) */
export async function DELETE(req: NextRequest) {
  const session = await requireAdmin();
  if (!session) return NextResponse.json({ error: "Solo administradores" }, { status: 403 });
  const body = await req.json().catch(() => ({}));

  if (body.id) {
    await prisma.course.delete({ where: { id: body.id } });
    return NextResponse.json({ ok: true, deleted: 1 });
  }
  if (body.source === "LOCAL") {
    const r = await prisma.course.deleteMany({ where: { source: "LOCAL" } });
    return NextResponse.json({ ok: true, deleted: r.count });
  }
  return NextResponse.json({ error: "Indica id o source" }, { status: 400 });
}
