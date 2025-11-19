// prisma/seed.cjs
/* eslint-disable @typescript-eslint/no-var-requires */
const { PrismaClient } = require("../lib/generated/prisma-client");
const db = new PrismaClient();

async function seedCategories() {
  const initialCategories = [
    {
      slug: "corporate-wears",
      name: "Corporate Wears",
      description: "Professional outfits for the workplace.",
      sortOrder: 1,
      isActive: true,
    },
    {
      slug: "african-prints",
      name: "African Prints",
      description: "Traditional and modern African print styles.",
      sortOrder: 2,
      isActive: true,
    },
    {
      slug: "casual-looks",
      name: "Casual Looks",
      description: "Everyday outfits for comfort and style.",
      sortOrder: 3,
      isActive: true,
    },
    {
      slug: "i-have-an-event",
      name: "I Have an Event",
      description: "Dress to impress for any occasion.",
      sortOrder: 4,
      isActive: true,
    },
  ];

  for (const cat of initialCategories) {
    await db.category.upsert({
      where: { slug: cat.slug },
      update: {
        name: cat.name,
        description: cat.description,
        isActive: cat.isActive,
        sortOrder: cat.sortOrder,
      },
      create: cat,
    });
  }

  console.log("✅ Seeded initial categories");
}

async function seedDeliveryOptions() {
  // Single EXTERNAL (dynamic) option via Shipbubble.
  // Keep this minimal—checkout pulls live quotes and stores details on the order.
  const shipbubble = {
    id: "shipbubble",
    name: "Shipbubble (Dynamic Rates)",
    provider: "Shipbubble",
    pricingMode: "EXTERNAL", // <- key: quotes fetched at checkout
    baseFee: null,
    baseCurrency: null,
    active: true,
    metadata: {
      note: "Quotes fetched from Shipbubble at checkout",
      // You can stash provider flags here later if needed
    },
  };

  await db.deliveryOption.upsert({
    where: { id: shipbubble.id },
    update: {
      name: shipbubble.name,
      provider: shipbubble.provider,
      pricingMode: shipbubble.pricingMode,
      baseFee: shipbubble.baseFee,
      baseCurrency: shipbubble.baseCurrency,
      active: shipbubble.active,
      metadata: shipbubble.metadata,
    },
    create: shipbubble,
  });

  console.log("✅ Seeded delivery option: Shipbubble (EXTERNAL)");
}

async function main() {
  await seedCategories();
  await seedDeliveryOptions();

  // If you later want a Nigerian flat-rate fallback:
  // await db.deliveryOption.upsert({ ...localCourier });
}

main()
  .then(async () => {
    console.log("🎉 Seed complete");
    await db.$disconnect();
  })
  .catch(async (e) => {
    console.error("❌ Seeding failed:", e);
    await db.$disconnect();
    process.exit(1);
  });
