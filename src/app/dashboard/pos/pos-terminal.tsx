"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { PaymentMethod } from "@/generated/prisma/enums";
import { centsToNumber, toCents } from "@/lib/money";
import type { PosProduct, Receipt } from "@/lib/pos";
import { completeSale, searchProducts } from "./actions";
import { CartPanel, type CartLine } from "./cart-panel";
import { ProductCatalog } from "./product-catalog";
import { ReceiptDialog } from "./receipt-dialog";
import { createTerminalPaymentIntent } from "./stripe-actions";
import { collectCardPayment } from "./terminal-client";

type Props = {
  initialProducts: PosProduct[];
  taxRate: number;
  cashierName: string;
};

export function PosTerminal({ initialProducts, taxRate }: Props) {
  const [products, setProducts] = useState<PosProduct[]>(initialProducts);
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);

  const [lines, setLines] = useState<CartLine[]>([]);
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>(
    PaymentMethod.CASH,
  );
  const [processing, setProcessing] = useState(false);
  const [receipt, setReceipt] = useState<Receipt | null>(null);

  // One idempotency key per checkout attempt, reused across retries of the same
  // cart so a double-click or network retry can't create a second sale. Cleared
  // after a sale commits (or the cart is cleared) so the next sale gets a fresh
  // key.
  const idempotencyKeyRef = useRef<string | null>(null);
  // Guards against a slow search response overwriting a newer one.
  const searchSeqRef = useRef(0);
  // Lets the F2 shortcut (and barcode flow) return focus to the search box.
  const searchInputRef = useRef<HTMLInputElement>(null);

  const runSearch = useCallback(async (q: string) => {
    const seq = ++searchSeqRef.current;
    setLoading(true);
    setError(false);
    try {
      const result = await searchProducts(q);
      if (seq === searchSeqRef.current) setProducts(result);
    } catch {
      if (seq === searchSeqRef.current) setError(true);
    } finally {
      if (seq === searchSeqRef.current) setLoading(false);
    }
  }, []);

  // Debounce catalog search as the cashier types.
  useEffect(() => {
    const q = query.trim();
    const handle = setTimeout(() => runSearch(q), 250);
    return () => clearTimeout(handle);
  }, [query, runSearch]);

  const inCartQty = useCallback(
    (id: string) => lines.find((l) => l.productId === id)?.quantity ?? 0,
    [lines],
  );

  function addToCart(product: PosProduct) {
    if (lines.length === 0) idempotencyKeyRef.current = crypto.randomUUID();
    setLines((prev) => {
      const existing = prev.find((l) => l.productId === product.id);
      if (existing) {
        if (existing.quantity >= product.quantity) return prev; // At stock cap.
        return prev.map((l) =>
          l.productId === product.id
            ? { ...l, quantity: l.quantity + 1, stock: product.quantity }
            : l,
        );
      }
      if (product.quantity <= 0) return prev;
      return [
        ...prev,
        {
          productId: product.id,
          name: product.name,
          sku: product.sku,
          unitPrice: product.sellingPrice,
          quantity: 1,
          stock: product.quantity,
        },
      ];
    });
  }

  function increment(productId: string) {
    setLines((prev) =>
      prev.map((l) =>
        l.productId === productId && l.quantity < l.stock
          ? { ...l, quantity: l.quantity + 1 }
          : l,
      ),
    );
  }

  function decrement(productId: string) {
    setLines((prev) =>
      prev.flatMap((l) => {
        if (l.productId !== productId) return [l];
        if (l.quantity <= 1) return []; // Drop the line at zero.
        return [{ ...l, quantity: l.quantity - 1 }];
      }),
    );
  }

  // Direct quantity edit from the cart's number input. Clamps to [0, stock];
  // zero drops the line so typing over a value and clearing it removes the item.
  function setQuantity(productId: string, quantity: number) {
    setLines((prev) =>
      prev.flatMap((l) => {
        if (l.productId !== productId) return [l];
        const q = Math.max(0, Math.min(l.stock, Math.floor(quantity)));
        return q <= 0 ? [] : [{ ...l, quantity: q }];
      }),
    );
  }

  function remove(productId: string) {
    setLines((prev) => prev.filter((l) => l.productId !== productId));
  }

  function clearCart() {
    setLines([]);
    idempotencyKeyRef.current = null;
  }

  // Totals shown to the cashier. These are for display only — the server
  // recomputes every amount from database prices before saving.
  const subtotalCents = lines.reduce(
    (sum, l) => sum + toCents(l.unitPrice) * l.quantity,
    0,
  );
  const taxCents = Math.round(subtotalCents * taxRate);
  const totals = {
    subtotal: centsToNumber(subtotalCents),
    tax: centsToNumber(taxCents),
    taxRate,
    total: centsToNumber(subtotalCents + taxCents),
  };

  async function checkout() {
    if (lines.length === 0 || processing) return;
    setProcessing(true);

    const key = idempotencyKeyRef.current ?? crypto.randomUUID();
    idempotencyKeyRef.current = key;

    const items = lines.map((l) => ({
      productId: l.productId,
      quantity: l.quantity,
    }));

    try {
      // Card sales authorize on the Stripe Terminal reader before the sale is
      // recorded; completeSale captures the PaymentIntent server-side once the
      // sale commits. Any other method skips the reader entirely.
      let stripePaymentIntentId: string | undefined;
      if (paymentMethod === PaymentMethod.CARD) {
        const intent = await createTerminalPaymentIntent(items, key);
        if (!intent.ok) {
          toast.error(intent.error);
          return;
        }
        try {
          await collectCardPayment(intent.clientSecret);
        } catch (readerError) {
          toast.error(
            readerError instanceof Error
              ? readerError.message
              : "Card payment failed. The sale was not recorded.",
          );
          return;
        }
        stripePaymentIntentId = intent.paymentIntentId;
      }

      const result = await completeSale({
        items,
        paymentMethod,
        idempotencyKey: key,
        stripePaymentIntentId,
      });

      if (result.ok) {
        setReceipt(result.receipt);
        setLines([]);
        idempotencyKeyRef.current = null;
        runSearch(query.trim());
      } else {
        toast.error(result.error);
        if (result.code === "UNAVAILABLE" || result.code === "INSUFFICIENT_STOCK") {
          runSearch(query.trim()); // Refresh stock so the catalog reflects reality.
        }
      }
    } catch {
      toast.error("Network error. The sale was not recorded — please retry.");
    } finally {
      setProcessing(false);
    }
  }

  function startNewSale() {
    setReceipt(null);
    runSearch(query.trim());
  }

  return (
    <>
      <div className="grid flex-1 grid-cols-1 gap-6 lg:grid-cols-[1fr_380px]">
        <div className="min-h-0 rounded-xl border bg-card p-4">
          <ProductCatalog
            products={products}
            query={query}
            onQueryChange={setQuery}
            loading={loading}
            error={error}
            onRetry={() => runSearch(query.trim())}
            onAdd={addToCart}
            inCartQty={inCartQty}
          />
        </div>

        <div className="min-h-0 rounded-xl border bg-card lg:sticky lg:top-6 lg:h-[calc(100svh-7rem)]">
          <CartPanel
            lines={lines}
            totals={totals}
            paymentMethod={paymentMethod}
            onPaymentMethodChange={setPaymentMethod}
            onIncrement={increment}
            onDecrement={decrement}
            onRemove={remove}
            onClear={clearCart}
            onCheckout={checkout}
            processing={processing}
          />
        </div>
      </div>

      <ReceiptDialog receipt={receipt} onNewSale={startNewSale} />
    </>
  );
}
