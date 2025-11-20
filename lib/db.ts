// lib/db.ts
import "server-only";
import { Pool } from "pg";
import { PrismaClient } from "@/lib/generated/prisma-client/client";
import { PrismaPg } from "@prisma/adapter-pg";

/**
 * In production, relax Node's TLS certificate verification.
 * This avoids "self-signed certificate in certificate chain" errors
 * for all outbound TLS connections (DB, SMTP, etc).
 *
 * Traffic is still encrypted, but certificates are not verified.
 * Treat this as a pragmatic workaround; harden later if needed.
 */
if (process.env.NODE_ENV === "production") {
  process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";
}

/**
 * Avoid multiple Prisma engines during Next.js dev HMR.
 */
declare global {
  // eslint-disable-next-line no-var
  var __PRISMA__: PrismaClient | undefined;
  // eslint-disable-next-line no-var
  var __PRISMA_READY__: Promise<void> | undefined;
}

function createClient(): PrismaClient {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error(
      "[prisma] DATABASE_URL is not set. " +
        "Check your DigitalOcean connection string and environment variables."
    );
  }

  const isProd = process.env.NODE_ENV === "production";

  // In prod, enforce TLS but relax certificate verification to avoid P1011
  const pool = new Pool({
    connectionString,
    ssl: isProd
      ? {
          rejectUnauthorized: false,
        }
      : undefined,
  });

  const adapter = new PrismaPg(pool);

  const client = new PrismaClient({
    adapter,
    log: process.env.NODE_ENV === "development" ? ["warn", "error"] : ["error"],
  });

  // Graceful shutdown when Node process ends (where applicable)
  try {
    process.once("beforeExit", async () => {
      try {
        await client.$disconnect();
      } catch {
        /* noop */
      }
    });
  } catch {
    // Some runtimes may not have `process`; safe to ignore.
  }

  return client;
}

/** Singleton client instance (survives module reloads in dev). */
export const prisma: PrismaClient = globalThis.__PRISMA__ ?? createClient();
if (!globalThis.__PRISMA__) globalThis.__PRISMA__ = prisma;

/** One-time connect promise you can await wherever you need DB ready. */
export const prismaReady: Promise<void> =
  globalThis.__PRISMA_READY__ ??
  prisma.$connect().catch((err) => {
    console.error("[prisma] $connect failed:", err);
    throw err;
  });

if (!globalThis.__PRISMA_READY__) globalThis.__PRISMA_READY__ = prismaReady;

export default prisma;
