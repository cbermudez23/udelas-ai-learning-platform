import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "No autenticado" }, { status: 401 });

  const items = await prisma.portfolioItem.findMany({
    where: { userId: session.user.id },
    orderBy: { createdAt: "desc" }
  });
  return NextResponse.json({ items });
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "No autenticado" }, { status: 401 });

  const { title, type, description } = await req.json();
  if (!title || !description) {
    return NextResponse.json({ error: "Título y descripción son obligatorios." }, { status: 400 });
  }

  const item = await prisma.portfolioItem.create({
    data: {
      userId: session.user.id,
      title,
      type: type || "evidencia",
      description
    }
  });
  return NextResponse.json({ item });
}
