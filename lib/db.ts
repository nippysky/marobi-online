// lib/db.ts
import "server-only";
import fs from "node:fs";
import { Pool } from "pg";
import { PrismaClient } from "@/lib/generated/prisma-client/client";
import { PrismaPg } from "@prisma/adapter-pg";

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

  // ── TLS config for DigitalOcean Postgres ──────────────────────────────
  let ssl: any = undefined;

  if (process.env.NODE_ENV === "production") {
    const caPath = "certs/digitalocean-db-ca.crt"; // relative to project root / var/task
    try {
      // Literal string path so Vercel's file tracer includes the cert in the bundle
      const ca = fs.readFileSync(caPath, "utf8");
      console.log("[db] Loaded DO CA from", caPath);
      ssl = { ca };
    } catch (err) {
      console.warn(
        "[db] Failed to load DO CA, falling back to rejectUnauthorized=false:",
        err
      );
      // Last-resort fallback so your app still works even if the file is missing
      ssl = { rejectUnauthorized: false };
    }
  }

  // pg Pool with SSL, used by PrismaPg
  const pool = new Pool({
    connectionString,
    ssl,
  });

  const adapter = new PrismaPg(pool);

  const client = new PrismaClient({
    adapter,
    log: process.env.NODE_ENV === "development" ? ["warn", "error"] : ["error"],
  });

  // Graceful shutdown when the Node process ends (Node runtime only).
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

/** One-time connect promise */
export const prismaReady: Promise<void> =
  globalThis.__PRISMA_READY__ ??
  prisma.$connect().catch((err) => {
    console.error("[prisma] $connect failed:", err);
    throw err;
  });

if (!globalThis.__PRISMA_READY__) globalThis.__PRISMA_READY__ = prismaReady;

export default prisma;
