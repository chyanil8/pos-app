import { connection } from "next/server";
import { SaleStatus } from "@/generated/prisma/enums";
import { prisma } from "@/lib/prisma";

// Aggregates every figure the dashboard renders in one place so the page stays
// a thin presentation layer. Low-stock detection compares two columns
// (quantity vs reorderLevel), which Prisma's `where` can't express directly, so
// we pull active products once and derive stock value + low-stock rows in JS —
// fine for a single-store catalog.

function startOfToday(): Date {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
}

function startOfMonth(): Date {
  const d = new Date();
  return new Date(d.getFullYear(), d.getMonth(), 1);
}

export async function getDashboardData() {
  // The today/month windows read the request-time clock. Under Cache
  // Components this must run during dynamic rendering, so opt out of
  // prerendering before touching `new Date()`.
  await connection();

  const [
    activeProducts,
    totalProducts,
    supplierCount,
    categoryCount,
    salesToday,
    salesMonth,
    recentSales,
  ] = await Promise.all([
    prisma.product.findMany({
      where: { isActive: true },
      select: {
        id: true,
        name: true,
        sku: true,
        quantity: true,
        reorderLevel: true,
        costPrice: true,
        sellingPrice: true,
        category: { select: { name: true } },
      },
    }),
    prisma.product.count({ where: { isActive: true } }),
    prisma.supplier.count({ where: { isActive: true } }),
    prisma.category.count(),
    prisma.sale.aggregate({
      where: { status: SaleStatus.COMPLETED, createdAt: { gte: startOfToday() } },
      _sum: { total: true },
      _count: true,
    }),
    prisma.sale.aggregate({
      where: { status: SaleStatus.COMPLETED, createdAt: { gte: startOfMonth() } },
      _sum: { total: true },
      _count: true,
    }),
    prisma.sale.findMany({
      orderBy: { createdAt: "desc" },
      take: 8,
      include: {
        createdBy: { select: { name: true } },
        _count: { select: { items: true } },
      },
    }),
  ]);

  const inventoryValue = activeProducts.reduce(
    (sum, p) => sum + Number(p.costPrice) * p.quantity,
    0,
  );
  const retailValue = activeProducts.reduce(
    (sum, p) => sum + Number(p.sellingPrice) * p.quantity,
    0,
  );

  const lowStock = activeProducts
    .filter((p) => p.quantity <= p.reorderLevel)
    .sort((a, b) => a.quantity - b.quantity);

  const outOfStock = lowStock.filter((p) => p.quantity === 0).length;

  return {
    totalProducts,
    supplierCount,
    categoryCount,
    inventoryValue,
    retailValue,
    lowStock,
    outOfStock,
    revenueToday: Number(salesToday._sum.total ?? 0),
    countToday: salesToday._count,
    revenueMonth: Number(salesMonth._sum.total ?? 0),
    countMonth: salesMonth._count,
    recentSales,
  };
}
