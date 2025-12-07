// middleware.ts
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { getToken } from "next-auth/jwt";

/* ---------------- Public paths & auth gates ---------------- */

const PUBLIC_PATHS = [
  "/(USER-END)/auth/login",
  "/(USER-END)/auth/register",
  "/(USER-END)/auth/forgot-password",
  "/(USER-END)/auth/reset-password",
  "/admin-login",
  "/favicon.ico",
  // allow NextAuth built-ins
  "/api/auth",
  "/api/auth/",
];

const CUSTOMER_ONLY = ["/(USER-END)/account", "/account"];
const ADMIN_ONLY    = ["/admin", "/admin/log-sale", "/admin/settings"];

function normalize(p: string) {
  return p.replace(/\/+$/, "");
}
function isFrameworkAsset(path: string) {
  return (
    path.startsWith("/_next") ||
    path.startsWith("/static") ||
    path.startsWith("/favicon")
  );
}
function isPublic(path: string) {
  const p = normalize(path);
  if (isFrameworkAsset(p)) return true;
  return PUBLIC_PATHS.some((pub) => {
    const norm = normalize(pub);
    return p === norm || p.startsWith(norm + "/");
  });
}

/* ---------------- Currency detection helpers ---------------- */

type Currency = "NGN" | "USD" | "EUR" | "GBP";

const COOKIE_NAME  = "CURRENCY";
const COOKIE_SRC   = "CURRENCY_SOURCE"; // "auto" | "manual"
const COOKIE_AGE   = 60 * 60 * 24 * 180; // 180 days
const EUROPE = new Set([
  "AT","BE","BG","HR","CY","CZ","DK","EE","FI","FR","DE","GR","HU","IE","IT",
  "LV","LT","LU","MT","NL","PL","PT","RO","SK","SI","ES","SE"
]);

const mapCountryToCurrency = (cc?: string): Currency | undefined => {
  if (!cc) return undefined;
  const c = cc.toUpperCase();
  if (c === "NG") return "NGN";
  if (c === "GB") return "GBP";
  if (EUROPE.has(c)) return "EUR";
  return "USD";
};

/**
 * Try to detect the country quickly via headers, then Accept-Language,
 * and only then do a one-shot external lookup (200ms budget).
 */
async function detectCurrency(req: NextRequest): Promise<{
  currency?: Currency;
  heuristic: "geo" | "accept-language" | "external" | "none";
  headerCountry?: string;
}> {
  const headerCountry =
    req.headers.get("x-vercel-ip-country") || // Vercel
    req.headers.get("cf-ipcountry") ||        // Cloudflare proxy (if any)
    undefined;

  // Fast path: platform geo header
  const geoCur = mapCountryToCurrency(headerCountry);
  if (geoCur) return { currency: geoCur, heuristic: "geo", headerCountry };

  // Next best: first Accept-Language tag's region (e.g. en-GB → GB)
  const al = req.headers.get("accept-language") || "";
  const first = al.split(",")[0]?.trim();
  const region = first?.split("-")[1]?.toUpperCase();
  const alCur = mapCountryToCurrency(region);
  if (alCur) return { currency: alCur, heuristic: "accept-language", headerCountry };

  // External fallback (tiny, once): ask a simple geo endpoint; 200ms budget
  try {
    const controller = new AbortController();
    const id = setTimeout(() => controller.abort(), 200);
    // ipapi.co returns the 2-letter code as plain text
    const resp = await fetch("https://ipapi.co/country/", {
      signal: controller.signal,
      cache: "no-store",
    });
    clearTimeout(id);
    if (resp.ok) {
      const cc = (await resp.text()).trim(); // e.g. "NG"
      if (/^[A-Z]{2}$/.test(cc)) {
        const exCur = mapCountryToCurrency(cc);
        if (exCur) return { currency: exCur, heuristic: "external", headerCountry };
      }
    }
  } catch {
    /* ignore and fall through */
  }

  return { currency: undefined, heuristic: "none", headerCountry };
}

/* ---------------- Middleware ---------------- */

export async function proxy(req: NextRequest) {
  const url = req.nextUrl.clone();
  const path = normalize(url.pathname);
  const callback = encodeURIComponent(url.pathname + url.search);

  // Always start with a next() response so we can set cookies/headers even on public pages.
  const res = NextResponse.next();

  // Respect a manual choice if present.
  const existingCurrency = req.cookies.get(COOKIE_NAME)?.value as Currency | undefined;
  const existingSource   = (req.cookies.get(COOKIE_SRC)?.value || "auto") as "manual" | "auto";

  // For static assets, we skip detection entirely (but still return res to serve them).
  if (!isFrameworkAsset(path)) {
    // Only auto-apply if user hasn't chosen manually.
    if (!existingCurrency || existingSource !== "manual") {
      const { currency: detected, heuristic, headerCountry } = await detectCurrency(req);

      // Brand default if still unknown: NGN
      const finalCurrency: Currency = detected ?? "NGN";

      res.cookies.set(COOKIE_NAME, finalCurrency, {
        httpOnly: false,
        sameSite: "lax",
        secure: true,
        path: "/",
        maxAge: COOKIE_AGE,
      });
      res.cookies.set(COOKIE_SRC, "auto", {
        httpOnly: false,
        sameSite: "lax",
        secure: true,
        path: "/",
        maxAge: COOKIE_AGE,
      });

      // Debug headers (handy while testing)
      res.headers.set("x-debug-country", String(headerCountry || "unknown"));
      res.headers.set("x-debug-currency-cookie", String(existingCurrency || "unset"));
      res.headers.set("x-debug-currency-source", String(existingSource || "unset"));
      res.headers.set("x-debug-auto-applied", finalCurrency);
      res.headers.set("x-debug-auto-heuristic", heuristic);
    } else {
      // If user chose manually, surface that for debugging too.
      res.headers.set("x-debug-currency-cookie", String(existingCurrency || "unset"));
      res.headers.set("x-debug-currency-source", existingSource);
    }
  }

  // ---- PUBLIC ASSETS / AUTH ROUTES ALWAYS ALLOWED ----
  if (isPublic(path)) return res;

  // If NEXTAUTH_SECRET missing, don't break navigation (allow through).
  const secret = process.env.NEXTAUTH_SECRET;
  if (!secret) return res;

  // ---------------- Admin section ----------------
  if (ADMIN_ONLY.some((p) => path === p || path.startsWith(p + "/"))) {
    const token = await getToken({ req, secret, cookieName: "marobi_session" });
    if (!token || token.role === "customer") {
      url.pathname = "/admin-login";
      url.searchParams.set("callbackUrl", callback);
      return NextResponse.redirect(url);
    }
    return res;
  }

  // ---------------- Customer section ----------------
  if (CUSTOMER_ONLY.some((p) => path === p || path.startsWith(p + "/"))) {
    const token = await getToken({ req, secret, cookieName: "marobi_session" });
    if (!token || token.role !== "customer") {
      url.pathname = "/(USER-END)/auth/login";
      url.searchParams.set("callbackUrl", callback);
      return NextResponse.redirect(url);
    }
    return res;
  }

  // Everything else public
  return res;
}

/**
 * Run on ALL routes so currency is set on public pages too.
 * We still skip framework assets inside the middleware for efficiency.
 */
export const config = {
  matcher: ["/:path*"],
};
