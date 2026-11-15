import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import { skuToBarcode } from "../src/lib/barcode.ts";
import { PrismaClient } from "../src/generated/prisma/client.ts";

// One-off: assign a deterministic EAN-13 barcode to every product that lacks
// one. Idempotent — codes are a pure function of the SKU, and rows that already
// have a barcode are left untouched. Run with: pnpm tsx prisma/backfill-barcodes.ts

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL! }),
});

async function main() {
  const products = await prisma.product.findMany({
    where: { barcode: null },
    select: { id: true, sku: true },
  });

  let updated = 0;
  for (const p of products) {
    await prisma.product.update({
      where: { id: p.id },
      data: { barcode: skuToBarcode(p.sku) },
    });
    updated += 1;
  }

  console.log(
    `Backfilled ${updated} product barcode(s)` +
      (updated === 0 ? " (all products already had one)." : "."),
  );
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (err) => {
    console.error(err);
    await prisma.$disconnect();
    process.exit(1);
  });
