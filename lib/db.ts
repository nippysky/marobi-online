// lib/db.ts
import "server-only";
import { PrismaClient } from "@/lib/generated/prisma-client";

/**
 * Avoid multiple Prisma engines during Next.js dev HMR.
 * We keep the client on the global object between reloads.
 */
declare global {
  // eslint-disable-next-line no-var
  var __PRISMA__: PrismaClient | undefined;
  // eslint-disable-next-line no-var
  var __PRISMA_READY__: Promise<void> | undefined;
}

/** Create a new PrismaClient with sane logging defaults. */
function createClient(): PrismaClient {
  const client = new PrismaClient({
    log: process.env.NODE_ENV === "development" ? ["warn", "error"] : ["error"],
  });

  // Helpful warning in dev for tiny pools (e.g., Neon with ?connection_limit=1)
  if (process.env.NODE_ENV !== "production") {
    const url = process.env.DATABASE_URL || "";
    if (/\bconnection_limit=1\b/i.test(url)) {
      console.warn(
        "[prisma] DATABASE_URL has connection_limit=1 — consider 5–10 in dev to avoid pool timeouts."
      );
    }
  }

  // Graceful shutdown when the Node process ends (Node.js runtime only).
  // (Has no effect on Vercel Edge where Prisma isn't supported.)
  try {
    process.once("beforeExit", async () => {
      try {
        await client.$disconnect();
      } catch {
        /* noop */
      }
    });
  } catch {
    // process may be undefined in some runtimes; safe to ignore.
  }

  return client;
}

/** Singleton client instance (survives module reloads in dev). */
export const prisma: PrismaClient = globalThis.__PRISMA__ ?? createClient();
if (!globalThis.__PRISMA__) globalThis.__PRISMA__ = prisma;

/**
 * A one-time connect promise you can `await` wherever you need to be sure
 * the connection is established before issuing queries:
 *
 *   await prismaReady;
 *   const rows = await prisma.user.findMany();
 */
export const prismaReady: Promise<void> =
  globalThis.__PRISMA_READY__ ??
  prisma.$connect().catch((err) => {
    console.error("[prisma] $connect failed:", err);
    throw err;
  });

if (!globalThis.__PRISMA_READY__) globalThis.__PRISMA_READY__ = prismaReady;

export default prisma;
