/**
 * Cambia el rol de una cuenta. Uso:
 *   npx tsx prisma/set-role.ts correo@udelas.ac.pa ADMIN   (STUDENT | PROFESSOR | ADMIN)
 */
import { PrismaClient, Role } from "@prisma/client";
const prisma = new PrismaClient();
async function main() {
  const [email, role] = process.argv.slice(2);
  if (!email || !["STUDENT", "PROFESSOR", "ADMIN"].includes(role || "")) {
    console.error("Uso: npx tsx prisma/set-role.ts <correo> <STUDENT|PROFESSOR|ADMIN>"); process.exit(1);
  }
  const user = await prisma.user.update({ where: { email: email.toLowerCase().trim() }, data: { role: role as Role } });
  console.log(`${user.name} (${user.email}) ahora es ${user.role}`);
}
main().finally(() => prisma.$disconnect());
