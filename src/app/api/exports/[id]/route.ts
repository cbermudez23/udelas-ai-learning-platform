import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { downloadUrl } from "@/lib/storage";
import { filenameOf } from "@/lib/exports";

export const dynamic = "force-dynamic";

/** GET /api/exports/[id] → redirige a una URL de descarga firmada (10 minutos). */
export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({ error: "No autenticado" }, { status: 401 });
  const f = await prisma.exportFile.findUnique({ where: { id: params.id } });
  if (!f || (f.userId !== session.user.id && session.user.role !== "ADMIN")) return NextResponse.json({ error: "No encontrado" }, { status: 404 });
  const url = await downloadUrl(f.storageKey, filenameOf(f));
  return NextResponse.redirect(url, 302);
}
