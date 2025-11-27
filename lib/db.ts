// lib/db.ts
import "server-only";
import { Pool } from "pg";
import type { PoolConfig } from "pg";
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

/**
 * Read the DigitalOcean CA from env, if present.
 *
 * Supports:
 * - DO_DB_CA_CERT_BASE64: base64 of full PEM (recommended)
 * - DO_DB_CA_CERT: PEM string (with literal `\n` or actual newlines)
 */
function getDoCaFromEnv(): string | undefined {
  const base64 = process.env.DO_DB_CA_CERT_BASE64;
  const pemRaw = process.env.DO_DB_CA_CERT;

  if (base64) {
    try {
      const pem = Buffer.from(base64, "base64").toString("utf8");
      if (pem.includes("BEGIN CERTIFICATE")) {
        return pem;
      }
      console.warn(
        "[db] DO_DB_CA_CERT_BASE64 decoded, but did not look like a PEM certificate."
      );
    } catch (err) {
      console.warn("[db] Failed to decode DO_DB_CA_CERT_BASE64:", err);
    }
  }

  if (pemRaw) {
    const pem = pemRaw.includes("\\n") ? pemRaw.replace(/\\n/g, "\n") : pemRaw;
    if (pem.includes("BEGIN CERTIFICATE")) {
      return pem;
    }
    console.warn(
      "[db] DO_DB_CA_CERT is set but does not look like a PEM certificate."
    );
  }

  return undefined;
}

/**
 * Decide SSL config:
 * - In **production-like** envs (NODE_ENV=production or VERCEL set) AND a CA is present
 *   → use strict TLS with that CA.
 * - In **local dev** (default) or if CA looks sketchy
 *   → fall back to `rejectUnauthorized:false` to avoid TLS “self-signed” hell.
 */
function buildSslConfig(): PoolConfig["ssl"] {
  const ca = getDoCaFromEnv();
  const nodeEnv = process.env.NODE_ENV ?? "development";
  const isProdLike =
    nodeEnv === "production" || process.env.VERCEL === "1";

  if (isProdLike && ca) {
    console.log(
      "[db] Using strict TLS with DigitalOcean CA (production-like environment)."
    );
    return {
      ca,
      rejectUnauthorized: true,
    };
  }

  console.warn(
    "[db] Using RELAXED TLS for Postgres (rejectUnauthorized=false). " +
      "This is expected in local dev, and avoids 'self-signed certificate in certificate chain' errors."
  );

  return {
    rejectUnauthorized: false,
  };
}

/**
 * Some connection strings have `?sslmode=require` etc.
 * That’s fine, but we don’t want it fighting with our `ssl` config,
 * so we strip only the `sslmode` query param and keep the rest.
 */
function sanitizeConnectionString(raw: string): string {
  try {
    const u = new URL(raw);
    u.searchParams.delete("sslmode");
    return u.toString();
  } catch {
    return raw;
  }
}

function createClient(): PrismaClient {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error(
      "[prisma] DATABASE_URL is not set. " +
        "Check your DigitalOcean connection string and environment variables."
    );
  }

  const sanitized = sanitizeConnectionString(connectionString);
  const ssl = buildSslConfig();

  const pool = new Pool({
    connectionString: sanitized,
    ssl,
  });

  const client = new PrismaClient({
    adapter: new PrismaPg(pool),
    log:
      process.env.NODE_ENV === "development"
        ? ["warn", "error"]
        : ["error"],
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
