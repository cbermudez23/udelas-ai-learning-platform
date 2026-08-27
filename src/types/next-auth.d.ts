import { Role } from "@prisma/client";
import "next-auth";

declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      role: Role;
      avatarInitials: string;
      name?: string | null;
      email?: string | null;
    };
  }

  interface User {
    id: string;
    role: Role;
    avatarInitials: string;
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    id: string;
    role: Role;
    avatarInitials: string;
  }
}
