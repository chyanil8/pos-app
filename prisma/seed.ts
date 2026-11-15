import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import {
  PaymentMethod,
  SaleStatus,
  StockMovementType,
  UserRole,
} from "../src/generated/prisma/enums";
import { PrismaClient } from "../src/generated/prisma/client";
import { skuToBarcode } from "../src/lib/barcode";

// Dev seed for exercising the dashboard. Wipes the domain tables and recreates a
// small single-store catalog with users, products (some intentionally low / out
// of stock), and sales spread across today and earlier this month so every KPI
// and both tables render with real numbers. Safe to re-run.

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL! }),
});

const TAX_RATE = 0.08;

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

function daysAgo(days: number, hour = 12): Date {
  const d = new Date();
  d.setDate(d.getDate() - days);
  d.setHours(hour, 0, 0, 0);
  return d;
}

async function main() {
  // Clear in FK-safe order.
  await prisma.stockMovement.deleteMany();
  await prisma.saleItem.deleteMany();
  await prisma.sale.deleteMany();
  await prisma.purchaseItem.deleteMany();
  await prisma.purchase.deleteMany();
  await prisma.product.deleteMany();
  await prisma.category.deleteMany();
  await prisma.supplier.deleteMany();
  await prisma.user.deleteMany();

  const [owner, manager, cashier] = await Promise.all([
    prisma.user.create({
      data: { name: "Ava Owner", email: "owner@pos.test", role: UserRole.OWNER },
    }),
    prisma.user.create({
      data: {
        name: "Max Manager",
        email: "manager@pos.test",
        role: UserRole.MANAGER,
      },
    }),
    prisma.user.create({
      data: {
        name: "Cleo Cashier",
        email: "cashier@pos.test",
        role: UserRole.CASHIER,
      },
    }),
  ]);

  const categoryNames = [
    "Beverages",
    "Snacks",
    "Household",
    "Personal Care",
    "Electronics",
  ];
  const categories = await Promise.all(
    categoryNames.map((name) => prisma.category.create({ data: { name } })),
  );
  const cat = Object.fromEntries(categories.map((c) => [c.name, c.id]));

  const supplierNames = [
    "Global Distributors",
    "FreshFoods Co.",
    "TechSupply Ltd.",
  ];
  const suppliers = await Promise.all(
    supplierNames.map((name) =>
      prisma.supplier.create({
        data: { name, email: `${name.split(" ")[0].toLowerCase()}@supply.test` },
      }),
    ),
  );

  // [name, sku, category, cost, price, quantity, reorderLevel]
  const productSpecs: [string, string, string, number, number, number, number][] =
    [
      ["Cola 330ml", "BEV-001", "Beverages", 0.4, 1.2, 180, 40],
      ["Sparkling Water 500ml", "BEV-002", "Beverages", 0.3, 0.99, 8, 30], // low
      ["Orange Juice 1L", "BEV-003", "Beverages", 1.1, 2.75, 0, 20], // out
      ["Potato Chips 150g", "SNK-001", "Snacks", 0.8, 2.49, 120, 25],
      ["Chocolate Bar", "SNK-002", "Snacks", 0.5, 1.5, 15, 20], // low
      ["Mixed Nuts 200g", "SNK-003", "Snacks", 1.6, 3.99, 60, 15],
      ["Dish Soap 750ml", "HSE-001", "Household", 1.2, 3.25, 44, 15],
      ["Paper Towels 6pk", "HSE-002", "Household", 2.8, 6.49, 5, 12], // low
      ["Trash Bags 30ct", "HSE-003", "Household", 2.1, 4.99, 70, 20],
      ["Shampoo 400ml", "PER-001", "Personal Care", 2.0, 5.49, 38, 10],
      ["Toothpaste 100ml", "PER-002", "Personal Care", 0.9, 2.99, 0, 15], // out
      ["Hand Soap 250ml", "PER-003", "Personal Care", 1.0, 2.79, 52, 12],
      ["USB-C Cable 1m", "ELC-001", "Electronics", 2.5, 9.99, 26, 10],
      ["AA Batteries 4pk", "ELC-002", "Electronics", 1.5, 4.49, 9, 20], // low
      ["Earbuds", "ELC-003", "Electronics", 8.0, 24.99, 18, 6],
    ];

  const products = await Promise.all(
    productSpecs.map(([name, sku, category, cost, price, qty, reorder], i) =>
      prisma.product.create({
        data: {
          name,
          sku,
          barcode: skuToBarcode(sku),
          costPrice: cost,
          sellingPrice: price,
          quantity: qty,
          reorderLevel: reorder,
          categoryId: cat[category],
          supplierId: suppliers[i % suppliers.length].id,
        },
      }),
    ),
  );

  // Track live stock so StockMovement.balanceAfter stays consistent as we sell.
  const stockById = new Map(products.map((p) => [p.id, p.quantity]));

  // Each sale: [daysAgo, cashierId, status, [ [productIndex, qty], ... ]]
  const saleSpecs: [number, string, SaleStatus, [number, number][]][] = [
    [0, cashier.id, SaleStatus.COMPLETED, [[0, 3], [3, 2], [5, 1]]],
    [0, cashier.id, SaleStatus.COMPLETED, [[12, 1], [8, 2]]],
    [0, manager.id, SaleStatus.COMPLETED, [[6, 1], [9, 1], [11, 2]]],
    [0, cashier.id, SaleStatus.VOIDED, [[14, 1]]],
    [2, cashier.id, SaleStatus.COMPLETED, [[0, 6], [3, 4]]],
    [5, manager.id, SaleStatus.COMPLETED, [[13, 2], [12, 1]]],
    [9, cashier.id, SaleStatus.COMPLETED, [[5, 3], [6, 2], [8, 1]]],
    [14, owner.id, SaleStatus.COMPLETED, [[9, 2], [11, 1]]],
  ];

  let saleSeq = 0;
  for (const [ago, userId, status, lines] of saleSpecs) {
    saleSeq += 1;
    const createdAt = daysAgo(ago, 10 + (saleSeq % 8));
    const saleNumber = `SALE-${String(saleSeq).padStart(4, "0")}`;

    const items = lines.map(([idx, qty]) => {
      const product = products[idx];
      const unitPrice = Number(product.sellingPrice);
      return {
        product,
        quantity: qty,
        unitPrice,
        subtotal: round2(unitPrice * qty),
      };
    });

    const subtotal = round2(items.reduce((s, it) => s + it.subtotal, 0));
    const tax = round2(subtotal * TAX_RATE);
    const total = round2(subtotal + tax);

    const sale = await prisma.sale.create({
      data: {
        saleNumber,
        status,
        paymentMethod: saleSeq % 2 ? PaymentMethod.CARD : PaymentMethod.CASH,
        createdById: userId,
        subtotal,
        tax,
        total,
        createdAt,
        updatedAt: createdAt,
        items: {
          create: items.map((it) => ({
            productId: it.product.id,
            productName: it.product.name,
            quantity: it.quantity,
            unitPrice: it.unitPrice,
            subtotal: it.subtotal,
          })),
        },
      },
    });

    // Voided sales never moved stock.
    if (status === SaleStatus.VOIDED) continue;

    for (const it of items) {
      const balanceAfter = (stockById.get(it.product.id) ?? 0) - it.quantity;
      stockById.set(it.product.id, balanceAfter);
      await prisma.stockMovement.create({
        data: {
          productId: it.product.id,
          type: StockMovementType.SALE,
          quantity: -it.quantity,
          balanceAfter,
          userId,
          saleId: sale.id,
          reason: `Sold on ${saleNumber}`,
          createdAt,
        },
      });
    }
  }

  // Persist the final on-hand quantities implied by the sales above.
  await Promise.all(
    [...stockById.entries()].map(([id, quantity]) =>
      prisma.product.update({ where: { id }, data: { quantity } }),
    ),
  );

  const completed = saleSpecs.filter(
    ([, , s]) => s === SaleStatus.COMPLETED,
  ).length;
  console.log(
    `Seeded: 3 users, ${categories.length} categories, ${suppliers.length} suppliers, ` +
      `${products.length} products, ${saleSpecs.length} sales (${completed} completed).`,
  );
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (err) => {
    console.error(err);
    await prisma.$disconnect();
    process.exit(1);
  });
