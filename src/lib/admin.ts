import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";

/** Devuelve la sesión si el usuario es ADMIN; si no, null. */
export async function requireAdmin() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id || session.user.role !== "ADMIN") return null;
  return session;
}
