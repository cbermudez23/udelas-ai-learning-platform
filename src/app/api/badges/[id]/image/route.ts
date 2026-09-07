import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { moodleDownload } from "@/lib/moodle";

export const dynamic = "force-dynamic";

/**
 * GET /api/badges/[id]/image
 * Sirve la imagen de una insignia de Moodle, descargándola con el token del
 * servicio (la URL de Moodle exige autenticación y el navegador no puede
 * cargarla directamente). Solo para insignias que el usuario tiene, o admin.
 */
export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({ error: "No autenticado" }, { status: 401 });

  const badge = await prisma.badge.findUnique({ where: { id: params.id } });
  if (!badge || !badge.imageUrl) return NextResponse.json({ error: "No encontrada" }, { status: 404 });

  if (session.user.role !== "ADMIN") {
    const owns = await prisma.userBadge.findUnique({ where: { userId_badgeId: { userId: session.user.id, badgeId: badge.id } } });
    if (!owns) return NextResponse.json({ error: "No encontrada" }, { status: 404 });
  }

  try {
    const { buffer, contentType } = await moodleDownload(badge.imageUrl);
    return new NextResponse(buffer, {
      headers: {
        "Content-Type": contentType || "image/png",
        "Cache-Control": "private, max-age=86400" // las imágenes de insignias no cambian
      }
    });
  } catch (e: any) {
    console.error("No se pudo descargar la imagen de la insignia:", e);
    return NextResponse.json({ error: "No se pudo obtener la imagen" }, { status: 502 });
  }
}
