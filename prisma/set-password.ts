/**
 * Fija la contraseña de una cuenta de la Plataforma UDELAS.
 * Uso (desde la Shell de Render o en local):
 *   npx tsx prisma/set-password.ts correo@udelas.ac.pa 'NuevaContraseña'
 */
import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

async function main() {
  const [email, password] = process.argv.slice(2);
  if (!email || !password) {
    console.error("Uso: npx tsx prisma/set-password.ts <correo> <contraseña>");
    process.exit(1);
  }
  const user = await prisma.user.findUnique({ where: { email: email.toLowerCase().trim() } });
  if (!user) {
    console.error(`No existe una cuenta con el correo ${email}`);
    process.exit(1);
  }
  const passwordHash = await bcrypt.hash(password, 10);
  await prisma.user.update({ where: { id: user.id }, data: { passwordHash } });
  console.log(`Contraseña actualizada para ${user.name} (${user.email})`);
}

main().finally(() => prisma.$disconnect());
