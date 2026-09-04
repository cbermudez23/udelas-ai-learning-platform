import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/admin";

export const dynamic = "force-dynamic";
const ROLES = ["STUDENT", "PROFESSOR", "ADMIN"] as const;

/** PATCH { id, role? , password?, name? } */
export async function PATCH(req: NextRequest) {
  const session = await requireAdmin();
  if (!session) return NextResponse.json({ error: "Solo administradores" }, { status: 403 });
  const body = await req.json().catch(() => ({}));
  const { id, role, password, name } = body;
  if (!id) return NextResponse.json({ error: "Falta id" }, { status: 400 });

  const data: any = {};
  if (role) {
    if (!ROLES.includes(role)) return NextResponse.json({ error: "Rol inválido" }, { status: 400 });
    if (id === session.user.id && role !== "ADMIN") {
      return NextResponse.json({ error: "No puedes quitarte tu propio rol de administrador." }, { status: 400 });
    }
    data.role = role;
  }
  if (typeof name === "string" && name.trim()) data.name = name.trim();
  if (typeof password === "string") {
    if (password.length < 8) return NextResponse.json({ error: "La contraseña debe tener al menos 8 caracteres." }, { status: 400 });
    data.passwordHash = await bcrypt.hash(password, 10);
  }
  if (Object.keys(data).length === 0) return NextResponse.json({ error: "Nada que actualizar" }, { status: 400 });

  const user = await prisma.user.update({ where: { id }, data, select: { id: true, name: true, email: true, role: true } });
  return NextResponse.json({ ok: true, user });
}

/** DELETE { id } */
export async function DELETE(req: NextRequest) {
  const session = await requireAdmin();
  if (!session) return NextResponse.json({ error: "Solo administradores" }, { status: 403 });
  const { id } = await req.json().catch(() => ({}));
  if (!id) return NextResponse.json({ error: "Falta id" }, { status: 400 });
  if (id === session.user.id) return NextResponse.json({ error: "No puedes eliminar tu propia cuenta." }, { status: 400 });
  await prisma.user.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
