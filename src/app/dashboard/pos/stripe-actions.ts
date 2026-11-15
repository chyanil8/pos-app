"use server";

import { canSell, getCurrentUser } from "@/lib/auth";
import { computeCartTotalCents } from "@/lib/pos";
import { stripe } from "@/lib/stripe";

// Stripe Terminal server actions. The reader never talks to Stripe with our
// secret key: the browser SDK fetches a short-lived connection token from here,
// and the PaymentIntent amount is computed server-side from DB prices so the
// client can't dictate what the card is charged.

// Returns the secret the Terminal JS SDK exchanges to talk to Stripe. Gated on
// the same role that may ring up sales.
export async function createConnectionToken(): Promise<string> {
  const user = await getCurrentUser();
  if (!user || !user.isActive || !canSell(user.role)) {
    throw new Error("Not authorized to use the card reader.");
  }
  const token = await stripe.terminal.connectionTokens.create();
  return token.secret;
}

export type TerminalIntentResult =
  | { ok: true; paymentIntentId: string; clientSecret: string }
  | { ok: false; error: string };

// Creates a card_present PaymentIntent with manual capture. Authorization
// happens on the reader; completeSale captures it only after the sale commits.
// The Stripe idempotency key is the same checkout key the sale uses, so a
// retried checkout reuses one PaymentIntent instead of opening a second charge.
export async function createTerminalPaymentIntent(
  items: { productId: string; quantity: number }[],
  idempotencyKey: string,
): Promise<TerminalIntentResult> {
  const user = await getCurrentUser();
  if (!user || !user.isActive || !canSell(user.role)) {
    return { ok: false, error: "Not authorized to take card payments." };
  }

  const total = await computeCartTotalCents(items);
  if (!total.ok) {
    return { ok: false, error: "Nothing in the cart can be charged." };
  }

  try {
    const intent = await stripe.paymentIntents.create(
      {
        amount: total.totalCents,
        currency: "usd",
        payment_method_types: ["card_present"],
        capture_method: "manual",
      },
      { idempotencyKey: `pi_${idempotencyKey}` },
    );
    return {
      ok: true,
      paymentIntentId: intent.id,
      clientSecret: intent.client_secret!,
    };
  } catch (error) {
    console.error("createTerminalPaymentIntent failed", error);
    return { ok: false, error: "Couldn't start the card payment." };
  }
}
