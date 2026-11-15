"use server";

import { revalidatePath } from "next/cache";
import { StockMovementType } from "@/generated/prisma/enums";
import { canSell, canVoid, getCurrentUser } from "@/lib/auth";
import {
  centsToDecimalString,
  toCents,
} from "@/lib/money";
import {
  getTaxRate,
  type PosProduct,
  receiptInclude,
  searchPosProducts,
  toReceipt,
} from "@/lib/pos";
import { prisma } from "@/lib/prisma";
import { stripe } from "@/lib/stripe";
import {
  type CheckoutInput,
  type CheckoutResult,
  checkoutSchema,
  type UnavailableItem,
  type VoidResult,
} from "./schema";

// Server-backed catalog search invoked by the client as the cashier types.
export async function searchProducts(query: string): Promise<PosProduct[]> {
  const user = await getCurrentUser();
  if (!user || !canSell(user.role)) return [];
  return searchPosProducts(query);
}

function hasCode(error: unknown, code: string): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    (error as { code?: unknown }).code === code
  );
}

function targetIncludes(error: unknown, field: string): boolean {
  const target = (error as { meta?: { target?: unknown } }).meta?.target;
  if (Array.isArray(target)) return target.map(String).includes(field);
  return typeof target === "string" && target.includes(field);
}

// Thrown inside the checkout transaction to abort (and roll back) with a
// user-facing reason; caught and converted to a CheckoutResult at the boundary.
class CheckoutError extends Error {
  code: "UNAVAILABLE" | "INSUFFICIENT_STOCK";
  unavailable: UnavailableItem[];
  constructor(
    message: string,
    code: "UNAVAILABLE" | "INSUFFICIENT_STOCK",
    unavailable: UnavailableItem[],
  ) {
    super(message);
    this.code = code;
    this.unavailable = unavailable;
  }
}

// Sale numbers are derived from the row count, so two concurrent checkouts can
// compute the same value; the unique constraint rejects the loser. A rolled-back
// transaction persists nothing, so retrying with a fresh count is safe.
function isSaleNumberConflict(error: unknown): boolean {
  return hasCode(error, "P2002") && targetIncludes(error, "saleNumber");
}

export async function completeSale(
  input: CheckoutInput,
): Promise<CheckoutResult> {
  const parsed = checkoutSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: "Invalid checkout request.", code: "VALIDATION" };
  }
  const data = parsed.data;

  const user = await getCurrentUser();
  if (!user) {
    return { ok: false, error: "You must be signed in.", code: "AUTH" };
  }
  if (!user.isActive || !canSell(user.role)) {
    return {
      ok: false,
      error: "You are not allowed to create sales.",
      code: "AUTH",
    };
  }

  // Merge duplicate lines defensively so each product is decremented once.
  const qtyById = new Map<string, number>();
  for (const it of data.items) {
    qtyById.set(it.productId, (qtyById.get(it.productId) ?? 0) + it.quantity);
  }
  const productIds = [...qtyById.keys()];

  // Idempotency fast path: a prior attempt with this key already succeeded.
  const prior = await prisma.sale.findUnique({
    where: { idempotencyKey: data.idempotencyKey },
    include: receiptInclude,
  });
  if (prior) return { ok: true, receipt: toReceipt(prior) };

  const taxRate = getTaxRate();

  const runTransaction = () =>
    prisma.$transaction(async (tx) => {
      // Re-read authoritative price/status/stock; never trust the client.
      const products = await tx.product.findMany({
        where: { id: { in: productIds } },
        select: {
          id: true,
          name: true,
          sellingPrice: true,
          isActive: true,
        },
      });
      const byId = new Map(products.map((p) => [p.id, p]));

      const unavailable: UnavailableItem[] = [];
      for (const id of productIds) {
        const p = byId.get(id);
        if (!p || !p.isActive) {
          unavailable.push({
            productId: id,
            name: p?.name ?? "Unknown product",
            reason: "unavailable",
          });
        }
      }
      if (unavailable.length > 0) {
        throw new CheckoutError(
          "Some items are no longer available.",
          "UNAVAILABLE",
          unavailable,
        );
      }

      // Money is computed from DB prices, in integer cents.
      const lines = productIds.map((id) => {
        const p = byId.get(id)!;
        const quantity = qtyById.get(id)!;
        const unitCents = toCents(Number(p.sellingPrice));
        return {
          id,
          name: p.name,
          quantity,
          unitCents,
          lineCents: unitCents * quantity,
        };
      });

      const subtotalCents = lines.reduce((s, l) => s + l.lineCents, 0);
      const discountCents = 0; // No server-validated discount policy in v1.
      const taxCents = Math.round((subtotalCents - discountCents) * taxRate);
      const totalCents = subtotalCents - discountCents + taxCents;

      // Conditional, atomic stock decrement. The `quantity >= needed` guard in
      // the WHERE is re-evaluated against the latest committed row under the row
      // lock, so concurrent checkouts can't oversell. RETURNING hands back the
      // post-decrement balance in the same round-trip, so we capture the exact
      // ledger balance here instead of re-reading each row in a second loop
      // (which is what blew past the interactive-transaction timeout). An empty
      // result means the row vanished, deactivated, or lacked stock.
      const balanceById = new Map<string, number>();
      for (const l of lines) {
        const rows = await tx.$queryRaw<{ quantity: number }[]>`
          UPDATE "Product"
          SET "quantity" = "quantity" - ${l.quantity}
          WHERE "id" = ${l.id}
            AND "isActive" = true
            AND "quantity" >= ${l.quantity}
          RETURNING "quantity"
        `;
        if (rows.length !== 1) {
          throw new CheckoutError(
            `Not enough stock for ${l.name}.`,
            "INSUFFICIENT_STOCK",
            [{ productId: l.id, name: l.name, reason: "insufficient_stock" }],
          );
        }
        balanceById.set(l.id, rows[0].quantity);
      }

      const count = await tx.sale.count();
      const saleNumber = `SALE-${String(count + 1).padStart(4, "0")}`;

      const sale = await tx.sale.create({
        data: {
          saleNumber,
          idempotencyKey: data.idempotencyKey,
          stripePaymentIntentId: data.stripePaymentIntentId,
          paymentMethod: data.paymentMethod,
          createdById: user.id,
          subtotal: centsToDecimalString(subtotalCents),
          tax: centsToDecimalString(taxCents),
          discount: centsToDecimalString(discountCents),
          total: centsToDecimalString(totalCents),
          items: {
            create: lines.map((l) => ({
              productId: l.id,
              productName: l.name,
              quantity: l.quantity,
              unitPrice: centsToDecimalString(l.unitCents),
              subtotal: centsToDecimalString(l.lineCents),
            })),
          },
        },
        include: receiptInclude,
      });

      // Append one stock-ledger row per product. balanceAfter was captured from
      // the RETURNING clause of the atomic decrement above, so it reflects the
      // true post-decrement stock without an extra read per line.
      await tx.stockMovement.createMany({
        data: lines.map((l) => ({
          productId: l.id,
          type: StockMovementType.SALE,
          quantity: -l.quantity,
          balanceAfter: balanceById.get(l.id)!,
          reason: `Sold on ${saleNumber}`,
          userId: user.id,
          saleId: sale.id,
        })),
      });

      return toReceipt(sale);
    }, {
      // Remote Postgres adds per-round-trip latency; give the (now leaner)
      // transaction headroom beyond the 5s default so a slow link doesn't
      // trip P2028 mid-checkout.
      timeout: 15_000,
      maxWait: 5_000,
    });

  try {
    let receipt: Awaited<ReturnType<typeof runTransaction>> | null = null;
    for (let attempt = 0; attempt < 5; attempt++) {
      try {
        receipt = await runTransaction();
        break;
      } catch (error) {
        if (isSaleNumberConflict(error) && attempt < 4) continue;
        throw error;
      }
    }

    // Sale is recorded. For a Terminal card sale, capture the authorized
    // PaymentIntent now. If capture fails the customer was never charged, so
    // undo the sale (restore stock + VOID) and cancel the authorization rather
    // than leaving an unpaid COMPLETED sale behind.
    if (data.stripePaymentIntentId) {
      try {
        await stripe.paymentIntents.capture(data.stripePaymentIntentId, {
          amount_to_capture: toCents(receipt!.total),
        });
      } catch (captureError) {
        console.error("Terminal capture failed; reversing sale", captureError);
        await reverseRecordedSale(receipt!.id, user.id);
        try {
          await stripe.paymentIntents.cancel(data.stripePaymentIntentId);
        } catch (cancelError) {
          console.error("PaymentIntent cancel failed", cancelError);
        }
        return {
          ok: false,
          error: "The card payment failed. No sale was recorded.",
          code: "PAYMENT",
        };
      }
    }

    revalidatePath("/dashboard");
    revalidatePath("/dashboard/pos");
    revalidatePath("/dashboard/sales");
    return { ok: true, receipt: receipt! };
  } catch (error) {
    if (error instanceof CheckoutError) {
      return {
        ok: false,
        error: error.message,
        code: error.code,
        unavailable: error.unavailable,
      };
    }

    // Idempotency race: a concurrent attempt with the same key committed first.
    if (hasCode(error, "P2002") && targetIncludes(error, "idempotencyKey")) {
      const again = await prisma.sale.findUnique({
        where: { idempotencyKey: data.idempotencyKey },
        include: receiptInclude,
      });
      if (again) return { ok: true, receipt: toReceipt(again) };
    }

    console.error("completeSale failed", error);
    return {
      ok: false,
      error: "Something went wrong. No sale was recorded — please try again.",
    };
  }
}

// System reversal of a just-recorded sale whose card payment failed to capture.
// Unlike voidSale this carries no role check — it's an automatic compensation
// for the cashier's own in-flight checkout, not a user-initiated void. Restores
// stock, flips status to VOIDED, and appends CUSTOMER_RETURN ledger rows.
async function reverseRecordedSale(
  saleId: string,
  userId: string,
): Promise<void> {
  await prisma.$transaction(async (tx) => {
    const sale = await tx.sale.findUnique({
      where: { id: saleId },
      include: { items: true },
    });
    if (!sale || sale.status === "VOIDED") return;

    await tx.sale.update({
      where: { id: saleId },
      data: { status: "VOIDED" },
    });

    for (const item of sale.items) {
      const updated = await tx.product.update({
        where: { id: item.productId },
        data: { quantity: { increment: item.quantity } },
        select: { quantity: true },
      });
      await tx.stockMovement.create({
        data: {
          productId: item.productId,
          type: StockMovementType.CUSTOMER_RETURN,
          quantity: item.quantity,
          balanceAfter: updated.quantity,
          reason: `Auto-reversed ${sale.saleNumber}: card payment failed`,
          userId,
          saleId: sale.id,
        },
      });
    }
  });
}

// Voids a completed sale: reverses stock, records CUSTOMER_RETURN ledger rows,
// and flips status to VOIDED. Restricted to managers/owners; sales are never
// hard-deleted so history stays auditable.
export async function voidSale(saleId: string): Promise<VoidResult> {
  if (!saleId) return { ok: false, error: "Missing sale id." };

  const user = await getCurrentUser();
  if (!user || !user.isActive || !canVoid(user.role)) {
    return { ok: false, error: "You are not allowed to void sales." };
  }

  try {
    await prisma.$transaction(async (tx) => {
      const sale = await tx.sale.findUnique({
        where: { id: saleId },
        include: { items: true },
      });
      if (!sale) throw new Error("NOT_FOUND");
      if (sale.status === "VOIDED") return; // Already voided — no-op.

      await tx.sale.update({
        where: { id: saleId },
        data: { status: "VOIDED" },
      });

      for (const item of sale.items) {
        const updated = await tx.product.update({
          where: { id: item.productId },
          data: { quantity: { increment: item.quantity } },
          select: { quantity: true },
        });
        await tx.stockMovement.create({
          data: {
            productId: item.productId,
            type: StockMovementType.CUSTOMER_RETURN,
            quantity: item.quantity,
            balanceAfter: updated.quantity,
            reason: `Void of ${sale.saleNumber}`,
            userId: user.id,
            saleId: sale.id,
          },
        });
      }
    });

    revalidatePath("/dashboard");
    revalidatePath("/dashboard/sales");
    revalidatePath(`/dashboard/sales/${saleId}`);
    return { ok: true };
  } catch (error) {
    if (error instanceof Error && error.message === "NOT_FOUND") {
      return { ok: false, error: "That sale no longer exists." };
    }
    console.error("voidSale failed", error);
    return { ok: false, error: "Couldn't void the sale. Please try again." };
  }
}
