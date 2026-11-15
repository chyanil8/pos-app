import { connection } from "next/server";
import type { PaymentMethod, SaleStatus } from "@/generated/prisma/enums";
import { toCents } from "@/lib/money";
import { prisma } from "@/lib/prisma";

// Data access + shared types for the POS and sales-history screens. Reads are
// uncached (request-time) so stock and history always reflect the latest
// mutation; `connection()` opts the caller out of prerendering under Cache
// Components. Decimal → number happens at this boundary so results are
// serializable for the Client Components that render them.

export type PosProduct = {
  id: string;
  name: string;
  sku: string;
  barcode: string | null;
  sellingPrice: number;
  quantity: number;
  isActive: boolean;
};

export type ReceiptItem = {
  productName: string;
  quantity: number;
  unitPrice: number;
  subtotal: number;
};

export type Receipt = {
  id: string;
  saleNumber: string;
  // ISO string so it crosses the server→client boundary without a Date instance.
  createdAt: string;
  status: SaleStatus;
  paymentMethod: PaymentMethod;
  cashierName: string;
  subtotal: number;
  tax: number;
  discount: number;
  total: number;
  items: ReceiptItem[];
};

export type SaleListRow = {
  id: string;
  saleNumber: string;
  createdAt: string;
  cashierName: string;
  itemCount: number;
  paymentMethod: PaymentMethod;
  total: number;
  status: SaleStatus;
};

// Sales tax is intentionally 0 until a store configures a rate. US rates vary by
// jurisdiction and product, so we never hardcode one — set POS_TAX_RATE as a
// decimal fraction (e.g. 0.085 for 8.5%). Out-of-range values are ignored.
export function getTaxRate(): number {
  const raw = process.env.POS_TAX_RATE;
  if (!raw) return 0;
  const n = Number(raw);
  if (!Number.isFinite(n) || n < 0 || n > 1) return 0;
  return n;
}

// Server-side product search for the catalog. Filters active products by name,
// SKU, or barcode and caps the result so a large catalog stays responsive.
export async function searchPosProducts(
  query: string,
  limit = 50,
): Promise<PosProduct[]> {
  await connection();

  const q = query.trim();
  const rows = await prisma.product.findMany({
    where: {
      isActive: true,
      ...(q
        ? {
            OR: [
              { name: { contains: q, mode: "insensitive" } },
              { sku: { contains: q, mode: "insensitive" } },
              { barcode: { contains: q, mode: "insensitive" } },
            ],
          }
        : {}),
    },
    orderBy: { name: "asc" },
    take: limit,
    select: {
      id: true,
      name: true,
      sku: true,
      barcode: true,
      sellingPrice: true,
      quantity: true,
      isActive: true,
    },
  });

  return rows.map((p) => ({
    id: p.id,
    name: p.name,
    sku: p.sku,
    barcode: p.barcode,
    sellingPrice: Number(p.sellingPrice),
    quantity: p.quantity,
    isActive: p.isActive,
  }));
}

// Authoritative cart total in integer cents, computed from current DB prices —
// mirrors the money math inside completeSale so a Stripe Terminal PaymentIntent
// is created for the same amount the sale will record. Unknown/inactive
// products are skipped; `ok` is false when nothing chargeable remains so the
// caller never opens a $0 payment on the reader.
export async function computeCartTotalCents(
  items: { productId: string; quantity: number }[],
): Promise<{ ok: true; totalCents: number } | { ok: false }> {
  const qtyById = new Map<string, number>();
  for (const it of items) {
    if (it.quantity > 0) {
      qtyById.set(it.productId, (qtyById.get(it.productId) ?? 0) + it.quantity);
    }
  }
  if (qtyById.size === 0) return { ok: false };

  const products = await prisma.product.findMany({
    where: { id: { in: [...qtyById.keys()] }, isActive: true },
    select: { id: true, sellingPrice: true },
  });

  let subtotalCents = 0;
  for (const p of products) {
    subtotalCents += toCents(Number(p.sellingPrice)) * (qtyById.get(p.id) ?? 0);
  }
  if (subtotalCents <= 0) return { ok: false };

  const taxCents = Math.round(subtotalCents * getTaxRate());
  return { ok: true, totalCents: subtotalCents + taxCents };
}

export type SalesHistory = {
  sales: SaleListRow[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
};

export async function getSalesHistory({
  page = 1,
  pageSize = 20,
}: {
  page?: number;
  pageSize?: number;
} = {}): Promise<SalesHistory> {
  await connection();

  const safePage = Math.max(1, Math.floor(page));
  const [rows, total] = await Promise.all([
    prisma.sale.findMany({
      orderBy: { createdAt: "desc" },
      skip: (safePage - 1) * pageSize,
      take: pageSize,
      include: {
        createdBy: { select: { name: true } },
        _count: { select: { items: true } },
      },
    }),
    prisma.sale.count(),
  ]);

  return {
    sales: rows.map((s) => ({
      id: s.id,
      saleNumber: s.saleNumber,
      createdAt: s.createdAt.toISOString(),
      cashierName: s.createdBy.name,
      itemCount: s._count.items,
      paymentMethod: s.paymentMethod,
      total: Number(s.total),
      status: s.status,
    })),
    total,
    page: safePage,
    pageSize,
    totalPages: Math.max(1, Math.ceil(total / pageSize)),
  };
}

// Prisma `include` shared by every query that builds a Receipt.
export const receiptInclude = {
  items: true,
  createdBy: { select: { name: true } },
} as const;

type SaleWithReceipt = {
  id: string;
  saleNumber: string;
  createdAt: Date;
  status: SaleStatus;
  paymentMethod: PaymentMethod;
  subtotal: unknown;
  tax: unknown;
  discount: unknown;
  total: unknown;
  createdBy: { name: string };
  items: {
    productName: string;
    quantity: number;
    unitPrice: unknown;
    subtotal: unknown;
  }[];
};

// Maps a Sale (with items + cashier) to the serializable Receipt shape. Receipts
// render the historical name/price snapshot stored on each SaleItem, never the
// product's current values.
export function toReceipt(sale: SaleWithReceipt): Receipt {
  return {
    id: sale.id,
    saleNumber: sale.saleNumber,
    createdAt: sale.createdAt.toISOString(),
    status: sale.status,
    paymentMethod: sale.paymentMethod,
    cashierName: sale.createdBy.name,
    subtotal: Number(sale.subtotal),
    tax: Number(sale.tax),
    discount: Number(sale.discount),
    total: Number(sale.total),
    items: sale.items.map((i) => ({
      productName: i.productName,
      quantity: i.quantity,
      unitPrice: Number(i.unitPrice),
      subtotal: Number(i.subtotal),
    })),
  };
}

export async function getSaleReceipt(id: string): Promise<Receipt | null> {
  await connection();
  const sale = await prisma.sale.findUnique({
    where: { id },
    include: receiptInclude,
  });
  return sale ? toReceipt(sale) : null;
}
