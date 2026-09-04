import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { indexPendingDocuments } from "@/lib/library";

export const dynamic = "force-dynamic";
export const maxDuration = 120;

/** POST { retryErrors?: boolean } → procesa documentos pendientes (docentes y administradores). */
export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "No autenticado" }, { status: 401 });
  if (!["ADMIN", "PROFESSOR"].includes(session.user.role)) {
    return NextResponse.json({ error: "Solo docentes y administradores" }, { status: 403 });
  }
  const body = await req.json().catch(() => ({}));
  if (body.retryErrors) {
    await prisma.libraryDocument.updateMany({ where: { status: "error" }, data: { status: "pending", error: null } });
  }
  const r = await indexPendingDocuments(25);
  const pending = await prisma.libraryDocument.count({ where: { status: "pending" } });
  return NextResponse.json({ ok: true, ...r, pending });
}
