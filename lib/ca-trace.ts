// lib/ca-trace.ts
import fs from "node:fs";
import path from "node:path";

const relPath = "certs/digitalocean-db-ca.crt";
const absPath = path.join(process.cwd(), relPath);

try {
  // This read is enough for Next/Vercel file-tracing to keep the file
  fs.readFileSync(absPath);
  console.log("[cert] CA file present:", relPath);
} catch (err) {
  console.warn("[cert] CA file missing at runtime:", relPath, err);
}

export {};
