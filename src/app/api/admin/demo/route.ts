import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/admin";

export const dynamic = "force-dynamic";

/**
 * DELETE /api/admin/demo
 * Elimina toda la información de demostración, conservando solo lo que viene
 * de Moodle (usuarios con moodleUserId o vínculo LTI, cursos MOODLE) y a los administradores.
 */
export async function DELETE() {
  const session = await requireAdmin();
  if (!session) return NextResponse.json({ error: "Solo administradores" }, { status: 403 });

  const courses = await prisma.course.deleteMany({ where: { source: { not: "MOODLE" } } });
  const users = await prisma.user.deleteMany({
    where: { role: { not: "ADMIN" }, moodleUserId: null, ltiLink: { is: null }, id: { not: session.user.id } }
  });
  const events = await prisma.calendarEvent.deleteMany({ where: { moodleKey: null } });
  const portfolio = await prisma.portfolioItem.deleteMany({});
  const library = await prisma.libraryDocument.deleteMany({ where: { moodleModuleId: null } });
  const badges = await prisma.badge.deleteMany({ where: { source: "LOCAL" } });
  const micro = await prisma.microcredential.deleteMany({ where: { source: "LOCAL" } });

  return NextResponse.json({
    ok: true,
    deleted: {
      cursos: courses.count, usuarios: users.count, eventos: events.count,
      portafolio: portfolio.count, biblioteca: library.count, insignias: badges.count, microcredenciales: micro.count
    }
  });
}
