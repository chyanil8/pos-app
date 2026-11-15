import {
  loadStripeTerminal,
  type Reader,
  type Terminal,
} from "@stripe/terminal-js";
import { createConnectionToken } from "./stripe-actions";

// Browser-side Stripe Terminal glue. Uses the SIMULATED reader so the full
// collect → process → capture flow works without hardware; swapping to a real
// internet reader later is just discovering with { simulated: false } and a
// location. The Terminal instance and connected reader are module singletons so
// repeated checkouts reuse one connection.

let terminalPromise: Promise<Terminal> | null = null;
let connectedReader: Reader | null = null;

async function getTerminal(): Promise<Terminal> {
  if (!terminalPromise) {
    terminalPromise = (async () => {
      const StripeTerminal = await loadStripeTerminal();
      if (!StripeTerminal) {
        throw new Error("Stripe Terminal SDK failed to load.");
      }
      return StripeTerminal.create({
        onFetchConnectionToken: createConnectionToken,
        onUnexpectedReaderDisconnect: () => {
          connectedReader = null;
        },
      });
    })();
  }
  return terminalPromise;
}

// Discovers and connects a simulated reader once, then reuses it.
async function ensureReader(): Promise<Terminal> {
  const terminal = await getTerminal();
  if (connectedReader) return terminal;

  const discover = await terminal.discoverReaders({ simulated: true });
  if ("error" in discover) throw new Error(discover.error.message);
  const [reader] = discover.discoveredReaders;
  if (!reader) throw new Error("No simulated reader available.");

  const connect = await terminal.connectReader(reader);
  if ("error" in connect) throw new Error(connect.error.message);
  connectedReader = connect.reader;
  return terminal;
}

// Runs the on-reader half of the payment: collect the card, then authorize.
// Leaves the PaymentIntent in requires_capture for the server to capture after
// the sale is recorded. Throws with a cashier-facing message on any failure.
export async function collectCardPayment(clientSecret: string): Promise<void> {
  const terminal = await ensureReader();

  const collected = await terminal.collectPaymentMethod(clientSecret);
  if ("error" in collected) throw new Error(collected.error.message);

  const processed = await terminal.processPayment(collected.paymentIntent);
  if ("error" in processed) {
    throw new Error(processed.error.message ?? "The card was declined.");
  }
}
