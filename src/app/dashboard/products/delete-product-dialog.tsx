"use client";

import { useTransition } from "react";
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
import type { ProductRow } from "@/lib/products";
import { deleteProduct } from "./actions";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  product: ProductRow | null;
};

export function DeleteProductDialog({ open, onOpenChange, product }: Props) {
  const [pending, startTransition] = useTransition();

  function handleDelete() {
    if (!product) return;
    startTransition(async () => {
      const result = await deleteProduct(product.id);
      if (result.status === "success") {
        toast.success(result.message);
        onOpenChange(false);
      } else {
        toast.error(result.message ?? "Couldn't delete product.");
      }
    });
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Delete product</DialogTitle>
          <DialogDescription>
            Delete{" "}
            <span className="font-medium text-foreground">{product?.name}</span>
            ? This can&apos;t be undone. Products with sales or purchase history
            are archived instead of removed.
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
            onClick={handleDelete}
            disabled={pending}
          >
            {pending ? "Deleting…" : "Delete"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
