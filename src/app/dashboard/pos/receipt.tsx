import { Store } from "lucide-react";
import type { Receipt as ReceiptData } from "@/lib/pos";
import { formatCurrency, formatDateTime, titleCase } from "@/lib/format";

// Presentational receipt shared by the POS success dialog and the sales-history
// detail page. It renders only the historical snapshot stored on the sale, so an
// old receipt is unaffected by later price or product-name changes. The
// `receipt-print` class is the target of the print stylesheet in globals.css.

export function Receipt({ receipt }: { receipt: ReceiptData }) {
  return (
    <div className="receipt-print mx-auto w-full max-w-sm space-y-4 text-sm">
      <div className="flex flex-col items-center gap-1 text-center">
        <div className="flex size-9 items-center justify-center rounded-lg bg-indigo-600 text-white">
          <Store className="size-5" />
        </div>
        <div className="font-heading text-base font-semibold tracking-tight">
          Counter POS
        </div>
        {receipt.status === "VOIDED" && (
          <div className="font-heading text-sm font-semibold text-destructive">
            *** VOIDED ***
          </div>
        )}
      </div>

      <dl className="space-y-0.5 text-xs text-muted-foreground">
        <div className="flex justify-between">
          <dt>Receipt</dt>
          <dd className="font-medium text-foreground">{receipt.saleNumber}</dd>
        </div>
        <div className="flex justify-between">
          <dt>Date</dt>
          <dd>{formatDateTime(receipt.createdAt)}</dd>
        </div>
        <div className="flex justify-between">
          <dt>Cashier</dt>
          <dd>{receipt.cashierName}</dd>
        </div>
        <div className="flex justify-between">
          <dt>Payment</dt>
          <dd>{titleCase(receipt.paymentMethod)}</dd>
        </div>
      </dl>

      <div className="border-t border-dashed" />

      <table className="w-full">
        <thead>
          <tr className="text-left text-xs text-muted-foreground">
            <th className="font-normal">Item</th>
            <th className="w-12 text-center font-normal">Qty</th>
            <th className="w-20 text-right font-normal">Price</th>
            <th className="w-20 text-right font-normal">Total</th>
          </tr>
        </thead>
        <tbody>
          {receipt.items.map((item, i) => (
            <tr key={`${item.productName}-${i}`} className="align-top">
              <td className="py-0.5 pr-2">{item.productName}</td>
              <td className="py-0.5 text-center tabular-nums">
                {item.quantity}
              </td>
              <td className="py-0.5 text-right tabular-nums">
                {formatCurrency(item.unitPrice)}
              </td>
              <td className="py-0.5 text-right tabular-nums">
                {formatCurrency(item.subtotal)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      <div className="border-t border-dashed" />

      <dl className="space-y-1">
        <div className="flex justify-between text-muted-foreground">
          <dt>Subtotal</dt>
          <dd className="tabular-nums">{formatCurrency(receipt.subtotal)}</dd>
        </div>
        {receipt.discount > 0 && (
          <div className="flex justify-between text-muted-foreground">
            <dt>Discount</dt>
            <dd className="tabular-nums">
              −{formatCurrency(receipt.discount)}
            </dd>
          </div>
        )}
        <div className="flex justify-between text-muted-foreground">
          <dt>Tax</dt>
          <dd className="tabular-nums">{formatCurrency(receipt.tax)}</dd>
        </div>
        <div className="flex justify-between font-heading text-base font-semibold">
          <dt>Total</dt>
          <dd className="tabular-nums">{formatCurrency(receipt.total)}</dd>
        </div>
      </dl>

      <p className="pt-2 text-center text-xs text-muted-foreground">
        Thank you for your purchase!
      </p>
    </div>
  );
}
