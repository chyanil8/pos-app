import { z } from "zod";
import type { Receipt } from "@/lib/pos";

// Authoritative validation for the checkout request. The client cart is only a
// convenience: the server re-reads prices, status, and stock from the database
// and ignores any amounts the browser might send.

export const checkoutSchema = z.object({
  items: z
    .array(
      z.object({
        productId: z.string().min(1),
        quantity: z.number().int().min(1).max(100_000),
      }),
    )
    .min(1, "Your cart is empty."),
  paymentMethod: z.enum(["CASH", "CARD", "BANK_TRANSFER", "OTHER"]),
  // Client-generated key that makes a checkout idempotent so a retried or
  // double-clicked submission can never create two sales.
  idempotencyKey: z.string().min(8).max(100),
  // Set for CARD sales paid on a Stripe Terminal reader: the authorized
  // PaymentIntent that completeSale captures once the sale is recorded.
  stripePaymentIntentId: z.string().min(1).max(255).optional(),
});

export type CheckoutInput = z.infer<typeof checkoutSchema>;

// A product that blocked checkout, surfaced so the UI can refresh/flag it.
export type UnavailableItem = {
  productId: string;
  name: string;
  reason: "unavailable" | "insufficient_stock";
};

export type CheckoutResult =
  | { ok: true; receipt: Receipt }
  | {
      ok: false;
      error: string;
      code?:
        | "UNAVAILABLE"
        | "INSUFFICIENT_STOCK"
        | "AUTH"
        | "VALIDATION"
        | "PAYMENT";
      unavailable?: UnavailableItem[];
    };

export type VoidResult =
  | { ok: true }
  | { ok: false; error: string };
