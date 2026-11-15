"use client";

import { Banknote, Minus, Plus, ShoppingCart, Trash2 } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { PaymentMethod } from "@/generated/prisma/enums";
import { formatCurrency, titleCase } from "@/lib/format";
import { cn } from "@/lib/utils";

export type CartLine = {
  productId: string;
  name: string;
  sku: string;
  unitPrice: number;
  quantity: number;
  // Live stock shown in the UI; quantity is capped to this client-side.
  stock: number;
};

type Totals = {
  subtotal: number;
  tax: number;
  taxRate: number;
  total: number;
};

type Props = {
  lines: CartLine[];
  totals: Totals;
  paymentMethod: PaymentMethod;
  onPaymentMethodChange: (method: PaymentMethod) => void;
  onIncrement: (productId: string) => void;
  onDecrement: (productId: string) => void;
  onSetQuantity: (productId: string, quantity: number) => void;
  onRemove: (productId: string) => void;
  onClear: () => void;
  onCheckout: () => void;
  processing: boolean;
};

const PAYMENT_METHODS = Object.values(PaymentMethod);

export function CartPanel({
  lines,
  totals,
  paymentMethod,
  onPaymentMethodChange,
  onIncrement,
  onDecrement,
  onSetQuantity,
  onRemove,
  onClear,
  onCheckout,
  processing,
}: Props) {
  const empty = lines.length === 0;
  const itemCount = lines.reduce((n, l) => n + l.quantity, 0);
  const isCash = paymentMethod === PaymentMethod.CASH;

  // Cash tendered is UI-only — it drives the change-due readout and gates
  // checkout so a cashier can't accidentally under-collect. The server never
  // sees it. Empty string means "not yet entered".
  const [tendered, setTendered] = useState("");
  const tenderedNum = Number.parseFloat(tendered);
  const hasTender = tendered !== "" && Number.isFinite(tenderedNum);
  const changeDue = hasTender ? tenderedNum - totals.total : 0;
  const shortCash = isCash && hasTender && changeDue < 0;

  // Reset the tender whenever the cart empties or the payment method switches,
  // so stale cash never carries into the next sale.
  // biome-ignore lint/correctness/useExhaustiveDependencies: reset on these signals
  useEffect(() => {
    setTendered("");
  }, [empty, paymentMethod]);

  // Quick-cash chips: exact change plus the next common bills above the total.
  const quickCash = useMemo(() => {
    const bills = [5, 10, 20, 50, 100];
    const above = bills.filter((b) => b > totals.total).slice(0, 3);
    return [totals.total, ...above];
  }, [totals.total]);

  const checkoutBlocked =
    empty || processing || (isCash && hasTender && changeDue < 0);

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center justify-between border-b px-4 py-3">
        <div className="flex items-center gap-2 font-heading font-semibold">
          <ShoppingCart className="size-4" />
          Cart
          {!empty && (
            <span className="rounded-full bg-indigo-100 px-2 py-0.5 text-xs font-medium text-indigo-700 tabular-nums">
              {itemCount}
            </span>
          )}
        </div>
        <Button
          variant="ghost"
          size="sm"
          onClick={onClear}
          disabled={empty || processing}
        >
          <Trash2 data-icon="inline-start" />
          Clear
        </Button>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto">
        {empty ? (
          <div className="flex h-full flex-col items-center justify-center gap-2 px-6 py-16 text-center">
            <ShoppingCart className="size-8 text-muted-foreground/50" />
            <p className="text-sm text-muted-foreground">
              Cart is empty. Scan or tap a product to begin.
            </p>
          </div>
        ) : (
          <ul className="divide-y">
            {lines.map((line) => (
              <li key={line.productId} className="flex flex-col gap-2 p-4">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <div className="truncate font-medium">{line.name}</div>
                    <div className="text-xs text-muted-foreground">
                      {formatCurrency(line.unitPrice)} each
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => onRemove(line.productId)}
                    disabled={processing}
                    className="text-muted-foreground transition-colors hover:text-destructive disabled:opacity-50"
                    aria-label={`Remove ${line.name}`}
                  >
                    <Trash2 className="size-4" />
                  </button>
                </div>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1">
                    <Button
                      variant="outline"
                      size="icon-sm"
                      onClick={() => onDecrement(line.productId)}
                      disabled={processing}
                      aria-label={`Decrease ${line.name}`}
                    >
                      <Minus />
                    </Button>
                    <Input
                      type="text"
                      inputMode="numeric"
                      value={line.quantity}
                      onChange={(e) => {
                        const n = Number.parseInt(
                          e.target.value.replace(/\D/g, ""),
                          10,
                        );
                        onSetQuantity(line.productId, Number.isNaN(n) ? 0 : n);
                      }}
                      disabled={processing}
                      aria-label={`Quantity for ${line.name}`}
                      className="h-8 w-12 px-0 text-center tabular-nums"
                    />
                    <Button
                      variant="outline"
                      size="icon-sm"
                      onClick={() => onIncrement(line.productId)}
                      disabled={processing || line.quantity >= line.stock}
                      aria-label={`Increase ${line.name}`}
                    >
                      <Plus />
                    </Button>
                  </div>
                  <span className="font-medium tabular-nums">
                    {formatCurrency(line.unitPrice * line.quantity)}
                  </span>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="space-y-4 border-t bg-muted/30 p-4">
        <div className="grid gap-1.5">
          <span className="text-xs font-medium text-muted-foreground">
            Payment method
          </span>
          <Select
            value={paymentMethod}
            onValueChange={(v) => onPaymentMethodChange(v as PaymentMethod)}
            disabled={processing}
          >
            <SelectTrigger className="w-full bg-background">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {PAYMENT_METHODS.map((method) => (
                <SelectItem key={method} value={method}>
                  {titleCase(method)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {isCash && !empty && (
          <div className="grid gap-1.5">
            <span className="text-xs font-medium text-muted-foreground">
              Cash tendered
            </span>
            <div className="relative">
              <Banknote className="absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                type="text"
                inputMode="decimal"
                value={tendered}
                onChange={(e) =>
                  setTendered(e.target.value.replace(/[^0-9.]/g, ""))
                }
                placeholder="0.00"
                aria-label="Cash tendered"
                className={cn(
                  "bg-background pl-9 tabular-nums",
                  shortCash && "border-destructive",
                )}
              />
            </div>
            <div className="flex flex-wrap gap-1.5">
              {quickCash.map((amount, i) => (
                <button
                  key={`${amount}-${i}`}
                  type="button"
                  onClick={() => setTendered(amount.toFixed(2))}
                  disabled={processing}
                  className="rounded-md border bg-background px-2.5 py-1 text-xs font-medium tabular-nums transition-colors hover:border-indigo-400 hover:text-indigo-700"
                >
                  {i === 0 ? "Exact" : formatCurrency(amount)}
                </button>
              ))}
            </div>
          </div>
        )}

        <dl className="space-y-1 text-sm">
          <div className="flex justify-between text-muted-foreground">
            <dt>Subtotal</dt>
            <dd className="tabular-nums">{formatCurrency(totals.subtotal)}</dd>
          </div>
          <div className="flex justify-between text-muted-foreground">
            <dt>
              Tax
              {totals.taxRate > 0 &&
                ` (${(totals.taxRate * 100).toFixed(totals.taxRate * 100 % 1 === 0 ? 0 : 2)}%)`}
            </dt>
            <dd className="tabular-nums">{formatCurrency(totals.tax)}</dd>
          </div>
          <div className="flex justify-between font-heading text-lg font-semibold text-indigo-700">
            <dt>Total</dt>
            <dd className="tabular-nums">{formatCurrency(totals.total)}</dd>
          </div>
          {isCash && hasTender && (
            <div
              className={cn(
                "mt-1 flex justify-between rounded-md px-2 py-1.5 font-medium tabular-nums",
                shortCash
                  ? "bg-destructive/10 text-destructive"
                  : "bg-emerald-100 text-emerald-700",
              )}
            >
              <dt>{shortCash ? "Still owed" : "Change due"}</dt>
              <dd>{formatCurrency(Math.abs(changeDue))}</dd>
            </div>
          )}
        </dl>

        <Button
          className="h-12 w-full bg-indigo-600 text-base text-white hover:bg-indigo-700"
          onClick={onCheckout}
          disabled={checkoutBlocked}
        >
          {processing
            ? "Processing…"
            : empty
              ? "Complete Sale"
              : `Complete Sale · ${formatCurrency(totals.total)}`}
        </Button>
      </div>
    </div>
  );
}
