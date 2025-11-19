// scripts/add-category.cjs
const { PrismaClient } = require("../lib/generated/prisma-client");
const db = new PrismaClient();

const [,, slug, name] = process.argv;
if (!slug || !name) {
  console.error("Usage: node scripts/add-category.cjs <slug> <name>");
  process.exit(1);
}

(async () => {
  await db.category.upsert({
    where: { slug },
    update: { name, isActive: true },
    create: { slug, name, isActive: true },
  });
  console.log(`✅ Category upserted: ${slug} (${name})`);
  await db.$disconnect();
})();
