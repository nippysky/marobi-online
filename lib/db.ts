// lib/db.ts
import "server-only";
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
        console.log("[db] Loaded DO CA from DO_DB_CA_CERT_BASE64");
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
    // handle "\n" escaped style
    const pem = pemRaw.includes("\\n") ? pemRaw.replace(/\\n/g, "\n") : pemRaw;
    if (pem.includes("BEGIN CERTIFICATE")) {
      console.log("[db] Loaded DO CA from DO_DB_CA_CERT");
      return pem;
    }
    console.warn(
      "[db] DO_DB_CA_CERT is set but does not look like a PEM certificate."
    );
  }

  return undefined;
}

function createClient(): PrismaClient {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error(
      "[prisma] DATABASE_URL is not set. " +
        "Check your DigitalOcean connection string and environment variables."
    );
  }

  const ca = getDoCaFromEnv();

  // If CA present → strict TLS. Otherwise fallback to relaxed TLS
  // (same effect as your previous rejectUnauthorized:false in prod).
  const sslConfig =
    ca != null
      ? {
          rejectUnauthorized: true,
          ca,
        }
      : {
          rejectUnauthorized: false,
        };

  if (ca) {
    console.log(
      "[db] Using custom CA for TLS (rejectUnauthorized=true, DigitalOcean managed DB)."
    );
  } else {
    console.warn(
      "[db] DO_DB_CA_CERT[_BASE64] not set. Falling back to rejectUnauthorized=false. " +
        "This is fine for now but less secure; consider wiring the CA env."
    );
  }

  const pool = new Pool({
    connectionString,
    ssl: sslConfig,
  });

  const client = new PrismaClient({
    adapter: new PrismaPg(pool),
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
