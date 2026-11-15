import { connection } from "next/server";
import { prisma } from "@/lib/prisma";

// Data access for the products screen. Reads are uncached (request-time) so a
// mutation followed by `revalidatePath` always reflects the latest catalog;
// `connection()` opts the caller out of prerendering under Cache Components.

export type ProductRow = {
  id: string;
  name: string;
  sku: string;
  barcode: string | null;
  description: string | null;
  costPrice: number;
  sellingPrice: number;
  quantity: number;
  reorderLevel: number;
  categoryId: string | null;
  supplierId: string | null;
  isActive: boolean;
  categoryName: string | null;
  supplierName: string | null;
};

export type ProductFormOptions = {
  categories: { id: string; name: string }[];
  suppliers: { id: string; name: string }[];
};

export async function getProducts(): Promise<ProductRow[]> {
  await connection();

  const products = await prisma.product.findMany({
    where: { isActive: true },
    orderBy: { name: "asc" },
    include: {
      category: { select: { name: true } },
      supplier: { select: { name: true } },
    },
  });

  // Decimal → number at the boundary so the list is serializable for the
  // Client Component that renders it.
  return products.map((p) => ({
    id: p.id,
    name: p.name,
    sku: p.sku,
    barcode: p.barcode,
    description: p.description,
    costPrice: Number(p.costPrice),
    sellingPrice: Number(p.sellingPrice),
    quantity: p.quantity,
    reorderLevel: p.reorderLevel,
    categoryId: p.categoryId,
    supplierId: p.supplierId,
    isActive: p.isActive,
    categoryName: p.category?.name ?? null,
    supplierName: p.supplier?.name ?? null,
  }));
}

export async function getProductFormOptions(): Promise<ProductFormOptions> {
  const [categories, suppliers] = await Promise.all([
    prisma.category.findMany({
      orderBy: { name: "asc" },
      select: { id: true, name: true },
    }),
    prisma.supplier.findMany({
      where: { isActive: true },
      orderBy: { name: "asc" },
      select: { id: true, name: true },
    }),
  ]);

  return { categories, suppliers };
}
