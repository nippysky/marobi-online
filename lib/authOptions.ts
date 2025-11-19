import { type NextAuthOptions } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import { prisma } from "@/lib/db";
import bcrypt from "bcrypt";
import { z } from "zod";
import { rateLimit } from "@/lib/rateLimiter";

const CredsSchema = z.object({
  email:    z.string().email("Invalid email address"),
  password: z.string().min(8, "Password must be 8+ characters"),
  role:     z.enum(["customer", "staff"]),
});

export const authOptions: NextAuthOptions = {
  secret: process.env.NEXTAUTH_SECRET,
  session: { strategy: "jwt" },
  cookies: {
    sessionToken: {
      name: "marobi_session",
      options: {
        httpOnly: true,
        sameSite: "lax",
        path: "/",
        secure: process.env.NODE_ENV === "production",
      },
    },
  },

  providers: [
    CredentialsProvider({
      name: "Email & Password",
      credentials: {
        email:    { label: "Email",    type: "email" },
        password: { label: "Password", type: "password" },
        role:     { label: "Role",     type: "text" },
      },
      async authorize(credentials, req) {
        // Rate-limit by IP
        const ip =
          req && typeof (req as any).headers?.get === "function"
            ? (req as any).headers.get("x-forwarded-for") ?? "unknown"
            : "unknown";
        const { ok, reset } = rateLimit(ip);
        if (!ok) {
          const wait = Math.ceil((reset - Date.now()) / 1000);
          throw new Error(`Too many login attempts. Try again in ${wait}s.`);
        }

        // Validate shape
        const parsed = CredsSchema.safeParse(credentials);
        if (!parsed.success) {
          throw new Error(parsed.error.issues.map(i => i.message).join("; "));
        }

        let { email, password, role } = parsed.data;
        email = email.trim().toLowerCase();

        if (role === "customer") {
          const user = await prisma.customer.findUnique({ where: { email } });
          if (!user) throw new Error("No account found with that email.");
          if (!user.emailVerified) throw new Error("Please verify your email first.");
          if (!user.passwordHash) throw new Error("Password not set. Reset first.");
          if (!(await bcrypt.compare(password, user.passwordHash))) {
            throw new Error("Incorrect password.");
          }
          return {
            id:       user.id,
            name:     `${user.firstName} ${user.lastName}`,
            email:    user.email,
            role:     "customer",
            jobRoles: [] as string[],
          };
        }

        // staff flow
        const staff = await prisma.staff.findUnique({ where: { email } });
        if (!staff)             throw new Error("Staff account not found.");
        if (!staff.emailVerified) throw new Error("Staff email not verified.");
        if (!staff.passwordHash)  throw new Error("Password not set. Contact admin.");
        if (!(await bcrypt.compare(password, staff.passwordHash))) {
          throw new Error("Incorrect password.");
        }
        return {
          id:       staff.id,
          name:     `${staff.firstName} ${staff.lastName}`,
          email:    staff.email,
          role:     staff.access,
          jobRoles: staff.jobRoles,
        };
      },
    }),
  ],

  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.id       = (user as any).id;
        token.role     = (user as any).role;
        token.jobRoles = (user as any).jobRoles;
        token.name     = (user as any).name;
        token.email    = (user as any).email;
      }
      return token;
    },
    async session({ session, token }) {
      session.user = {
        ...session.user!,
        id:       token.id as string,
        role:     token.role as string,
        jobRoles: (token.jobRoles as string[]) || [],
        name:     token.name as string | undefined,
        email:    token.email as string | undefined,
      };
      return session;
    },
    // ◀️ Here’s the fix: if the URL starts with “/”, prefix baseUrl,
    // otherwise if it’s already an absolute URL on your origin, just use it.
    async redirect({ url, baseUrl }) {
      if (url.startsWith("/")) {
        return `${baseUrl}${url}`;
      }
      try {
        const dest = new URL(url);
        if (dest.origin === baseUrl) return url;
      } catch {
        /* fall through */
      }
      return baseUrl;
    },
  },

  events: {
    async signIn({ user }) {
      if (!user.email) return;
      if ((user as any).role === "customer") {
        await prisma.customer.update({
          where: { email: user.email },
          data:  { lastLogin: new Date() },
        });
      } else {
        await prisma.staff.update({
          where: { email: user.email },
          data:  { lastLogin: new Date() },
        });
      }
    },
  },

  pages: {
    signIn: "/auth/login",
    error:  "/",
  },
};
