"use client";

import { Ban, Printer } from "lucide-react";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { voidSale } from "@/app/dashboard/pos/actions";

type Props = {
  saleId: string;
  saleNumber: string;
  // Server-resolved: whether this user may void and the sale is still voidable.
  canVoid: boolean;
  isVoided: boolean;
};

// The `no-print` class hides these controls from the printed receipt.
export function ReceiptActions({ saleId, saleNumber, canVoid, isVoided }: Props) {
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [pending, startTransition] = useTransition();

  function handleVoid() {
    startTransition(async () => {
      const result = await voidSale(saleId);
      if (result.ok) {
        toast.success(`${saleNumber} voided. Stock was returned.`);
        setConfirmOpen(false);
      } else {
        toast.error(result.error);
      }
    });
  }

  return (
    <div className="no-print flex items-center gap-2">
      <Button variant="outline" onClick={() => window.print()}>
        <Printer data-icon="inline-start" />
        Print
      </Button>

      {canVoid && !isVoided && (
        <>
          <Button variant="outline" onClick={() => setConfirmOpen(true)}>
            <Ban data-icon="inline-start" />
            Void sale
          </Button>
          <Dialog open={confirmOpen} onOpenChange={setConfirmOpen}>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Void {saleNumber}?</DialogTitle>
                <DialogDescription>
                  This marks the sale as voided and returns its items to stock
                  with a recorded stock movement. The sale stays in history for
                  audit. This can&apos;t be undone.
                </DialogDescription>
              </DialogHeader>
              <DialogFooter>
                <DialogClose
                  render={
                    <Button type="button" variant="outline" disabled={pending} />
                  }
                >
                  Cancel
                </DialogClose>
                <Button
                  variant="destructive"
                  onClick={handleVoid}
                  disabled={pending}
                >
                  {pending ? "Voiding…" : "Void sale"}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </>
      )}
    </div>
  );
}
