"use client";

import { CheckCircle2, Printer } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import type { Receipt as ReceiptData } from "@/lib/pos";
import { Receipt } from "./receipt";

type Props = {
  receipt: ReceiptData | null;
  onNewSale: () => void;
};

// Confirmation shown only after the server commits the sale. The receipt body
// carries the `receipt-print` class, so the browser print dialog prints just the
// receipt (see the print rules in globals.css).
export function ReceiptDialog({ receipt, onNewSale }: Props) {
  return (
    <Dialog
      open={receipt !== null}
      onOpenChange={(open) => {
        if (!open) onNewSale();
      }}
    >
      <DialogContent className="sm:max-w-md">
        {receipt && (
          <>
            <DialogHeader className="items-center text-center">
              <div className="flex size-12 items-center justify-center rounded-full bg-emerald-100 text-emerald-600">
                <CheckCircle2 className="size-6" />
              </div>
              <DialogTitle>Sale complete</DialogTitle>
              <DialogDescription>
                {receipt.saleNumber} · saved to sales history.
              </DialogDescription>
            </DialogHeader>

            <div className="rounded-xl border bg-card p-4">
              <Receipt receipt={receipt} />
            </div>

            <DialogFooter>
              <Button
                variant="outline"
                onClick={() => window.print()}
                className="sm:flex-1"
              >
                <Printer data-icon="inline-start" />
                Print receipt
              </Button>
              <Button
                onClick={onNewSale}
                className="bg-indigo-600 text-white hover:bg-indigo-700 sm:flex-1"
              >
                Start new sale
              </Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
