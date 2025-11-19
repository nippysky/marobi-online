// next-auth.d.ts
import NextAuth, { DefaultSession, DefaultUser } from "next-auth";

declare module "next-auth" {
  interface Session {
    user: {
      id:       string;
      role:     string;
      jobRoles: string[];
      name?:    string | null;
      email?:   string | null;
    } & DefaultSession["user"];
  }
  interface User {
    id:       string;
    role:     string;
    jobRoles: string[];
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    id:       string;
    role:     string;
    jobRoles: string[];
    name?:    string;
    email?:   string;
  }
}
