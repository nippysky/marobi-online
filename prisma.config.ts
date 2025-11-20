// prisma.config.ts
import "dotenv/config";
import { defineConfig, env } from "prisma/config";

export default defineConfig({
  // where your schema lives
  schema: "prisma/schema.prisma",

  // migrate / seed config
  migrations: {
    seed: "node scripts/seed.cjs",
  },

  // Prisma 7: datasource URL now lives here, not in schema.prisma
  datasource: {
    // DigitalOcean managed Postgres connection string
    url: env("DATABASE_URL"),
    // If you ever use a shadow DB for migrations, you can add:
    shadowDatabaseUrl: env("DIRECT_URL"),
  },
});
