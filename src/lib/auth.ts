import { type NextAuthOptions } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";

export const authOptions: NextAuthOptions = {
  session: { strategy: "jwt" },
  pages: {
    signIn: "/login"
  },
  providers: [
    CredentialsProvider({
      name: "Credenciales UDELAS",
      credentials: {
        email: { label: "Correo institucional", type: "email" },
        password: { label: "Contraseña", type: "password" }
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) return null;

        let user = await prisma.user.findUnique({
          where: { email: credentials.email.toLowerCase().trim() }
        });
        if (!user) return null;

        const valid = await bcrypt.compare(credentials.password, user.passwordHash);
        if (!valid) return null;

        // Promoción automática a ADMIN si el correo está en ADMIN_EMAILS
        const { adminEmails } = await import("@/lib/settings");
        if (user.role !== "ADMIN" && adminEmails().includes(user.email.toLowerCase())) {
          user = await prisma.user.update({ where: { id: user.id }, data: { role: "ADMIN" } });
        }

        return {
          id: user.id,
          name: user.name,
          email: user.email,
          role: user.role,
          avatarInitials: user.avatarInitials
        } as any;
      }
    })
  ],
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.id = (user as any).id;
        token.role = (user as any).role;
        token.avatarInitials = (user as any).avatarInitials;
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        (session.user as any).id = token.id;
        (session.user as any).role = token.role;
        (session.user as any).avatarInitials = token.avatarInitials;
      }
      return session;
    }
  },
  secret: process.env.NEXTAUTH_SECRET
};
