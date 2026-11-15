import Stripe from "stripe";

// Server-only Stripe client. Keyed by the test-mode secret and reused across
// hot reloads like the Prisma client so dev doesn't spawn a new instance per
// request. Never import this from a Client Component — it would leak the key.
const secretKey = process.env.STRIPE_SECRET_KEY;

if (!secretKey) {
  throw new Error("STRIPE_SECRET_KEY is not set");
}

const globalForStripe = globalThis as unknown as {
  stripe?: Stripe;
};

export const stripe: Stripe =
  globalForStripe.stripe ?? new Stripe(secretKey);

if (process.env.NODE_ENV !== "production") {
  globalForStripe.stripe = stripe;
}
