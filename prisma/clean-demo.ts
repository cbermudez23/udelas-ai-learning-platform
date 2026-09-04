/**
 * Elimina los datos de demostración (cursos LOCAL, notas, eventos, etc.) de un usuario,
 * conservando todo lo sincronizado desde Moodle.
 * Uso:  npx tsx prisma/clean-demo.ts carlos@udelas.ac.pa
 */
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const email = (process.argv[2] || "").toLowerCase().trim();
  if (!email) { console.error("Uso: npx tsx prisma/clean-demo.ts <correo>"); process.exit(1); }

  const user = await prisma.user.findUnique({ where: { email } });
  if (!user) { console.error(`No existe la cuenta ${email}`); process.exit(1); }

  // Matrículas (y sus notas, en cascada) en cursos que NO vienen de Moodle
  const enr = await prisma.enrollment.deleteMany({ where: { userId: user.id, course: { source: { not: "MOODLE" } } } });
  // Eventos de calendario que no vienen de Moodle
  const ev = await prisma.calendarEvent.deleteMany({ where: { userId: user.id, moodleKey: null } });
  // Progreso demo de microcredenciales, insignias y portafolio
  const mc = await prisma.userMicrocredentialProgress.deleteMany({ where: { userId: user.id } });
  const bd = await prisma.userBadge.deleteMany({ where: { userId: user.id } });
  const pf = await prisma.portfolioItem.deleteMany({ where: { userId: user.id } });
  const ex = await prisma.examAttempt.deleteMany({ where: { userId: user.id } });

  console.log(`Limpieza de ${user.name} (${email}):`);
  console.log(`  ${enr.count} matrícula(s) demo, ${ev.count} evento(s), ${mc.count} microcredencial(es), ${bd.count} insignia(s), ${pf.count} ítem(s) de portafolio, ${ex.count} intento(s) de examen.`);
  console.log("  Los datos sincronizados desde Moodle se conservaron.");
}

main().finally(() => prisma.$disconnect());
