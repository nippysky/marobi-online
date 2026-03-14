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

function mustGetEnv(name: string): string {
  const v = process.env[name];
  if (!v) {
    throw new Error(`[db] Missing required env var: ${name}`);
  }
  return v;
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
      if (pem.includes("BEGIN CERTIFICATE")) return pem;
      console.warn("[db] DO_DB_CA_CERT_BASE64 decoded but did not look like PEM.");
    } catch (err) {
      console.warn("[db] Failed to decode DO_DB_CA_CERT_BASE64:", err);
    }
  }

  if (pemRaw) {
    const pem = pemRaw.includes("\\n") ? pemRaw.replace(/\\n/g, "\n") : pemRaw;
    if (pem.includes("BEGIN CERTIFICATE")) return pem;
    console.warn("[db] DO_DB_CA_CERT is set but does not look like PEM.");
  }

  return undefined;
}

/**
 * Validate/parse the connection string as a URL early.
 * Prisma's adapter layer can crash with "searchParams of undefined"
 * if the URL is malformed (often due to unescaped characters in password).
 */
function parseDatabaseUrl(raw: string): URL {
  try {
    return new URL(raw);
  } catch (err) {
    throw new Error(
      `[db] DATABASE_URL is not a valid URL. ` +
        `If your password contains special characters (e.g. # ? @ / %), URL-encode it. ` +
        `Original error: ${(err as Error).message}`
    );
  }
}

/**
 * Some connection strings have `?sslmode=require` etc.
 * We let the "pg" driver handle TLS via Pool.ssl,
 * so we strip only the `sslmode` query param (and keep the rest).
 */
function sanitizeConnectionString(raw: string): string {
  const u = parseDatabaseUrl(raw);
  u.searchParams.delete("sslmode");
  return u.toString();
}

/**
 * Build SSL config based on hostname:
 * - DO managed host (*.db.ondigitalocean.com): use DO CA if present (strict).
 * - Non-DO host (your droplet ops.panth.art with Let's Encrypt): use system trust (strict) in prod.
 * - Local dev: allow relaxed TLS to avoid self-signed chain pain.
 */
function buildSslConfig(dbUrl: URL): PoolConfig["ssl"] {
  const nodeEnv = process.env.NODE_ENV ?? "development";
  const isProdLike = nodeEnv === "production" || process.env.VERCEL === "1";

  const host = dbUrl.hostname;
  const isDoManaged = host.endsWith(".db.ondigitalocean.com");
  const ca = getDoCaFromEnv();

  if (isDoManaged) {
    if (isProdLike) {
      if (!ca) {
        throw new Error(
          "[db] Connecting to DigitalOcean Managed Postgres but DO_DB_CA_CERT(_BASE64) is missing. " +
            "Set the CA cert env var or use a non-DO host."
        );
      }
      console.log("[db] Using strict TLS with DigitalOcean CA (DO managed DB).");
      return { ca, rejectUnauthorized: true };
    }

    // Dev-ish environment: allow you to work even if CA isn't set.
    console.warn("[db] Using RELAXED TLS for DO managed DB (dev).");
    return ca ? { ca, rejectUnauthorized: true } : { rejectUnauthorized: false };
  }

  // Non-DO host: use normal public PKI trust (Let's Encrypt, etc.)
  if (isProdLike) {
    console.log("[db] Using strict TLS with system trust store (non-DO host).");
    return { rejectUnauthorized: true };
  }

  console.warn(
    "[db] Using RELAXED TLS for Postgres in local dev (rejectUnauthorized=false)."
  );
  return { rejectUnauthorized: false };
}

function createClient(): PrismaClient {
  const raw = mustGetEnv("DATABASE_URL");

  // Validate early (prevents Prisma "searchParams undefined" crashes)
  const dbUrl = parseDatabaseUrl(raw);

  const sanitized = sanitizeConnectionString(raw);
  const ssl = buildSslConfig(dbUrl);

  const pool = new Pool({
    connectionString: sanitized,
    ssl,
  });

  const client = new PrismaClient({
    adapter: new PrismaPg(pool),
    log: process.env.NODE_ENV === "development" ? ["warn", "error"] : ["error"],
  });

  try {
    process.once("beforeExit", async () => {
      try {
        await client.$disconnect();
      } catch {
        /* noop */
      }
    });
  } catch {
    /* noop */
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