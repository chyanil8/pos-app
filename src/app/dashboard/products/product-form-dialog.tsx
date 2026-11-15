"use client";

import { useActionState, useEffect, useRef } from "react";
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
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import type { ProductFormOptions, ProductRow } from "@/lib/products";
import { createProduct, updateProduct } from "./actions";
import { initialFormState } from "./schema";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  // `null` → create mode; a row → edit mode.
  product: ProductRow | null;
  options: ProductFormOptions;
};

export function ProductFormDialog({
  open,
  onOpenChange,
  product,
  options,
}: Props) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        {/* Remount the form each time the dialog opens (or the target product
            changes) so inputs and the action state reset cleanly. */}
        {open && (
          <ProductForm
            key={product?.id ?? "new"}
            product={product}
            options={options}
            onDone={() => onOpenChange(false)}
          />
        )}
      </DialogContent>
    </Dialog>
  );
}

function ProductForm({
  product,
  options,
  onDone,
}: {
  product: ProductRow | null;
  options: ProductFormOptions;
  onDone: () => void;
}) {
  const isEdit = product !== null;
  const [state, formAction, pending] = useActionState(
    isEdit ? updateProduct : createProduct,
    initialFormState,
  );

  // `onDone` is an inline parent callback; read it through a ref so the effect
  // only re-runs when a fresh action result arrives, not on every re-render.
  const onDoneRef = useRef(onDone);
  onDoneRef.current = onDone;

  useEffect(() => {
    if (state.status === "success") {
      toast.success(state.message);
      onDoneRef.current();
    } else if (state.status === "error" && state.message) {
      toast.error(state.message);
    }
  }, [state]);

  const err = (name: string) => state.fieldErrors?.[name]?.[0];

  return (
    <form action={formAction} className="grid gap-4">
      <DialogHeader>
        <DialogTitle>{isEdit ? "Edit product" : "New product"}</DialogTitle>
        <DialogDescription>
          {isEdit
            ? "Update the details for this product."
            : "Add a product to your catalog."}
        </DialogDescription>
      </DialogHeader>

      {isEdit && <input type="hidden" name="id" value={product.id} />}

      <div className="grid gap-4">
        <Field label="Name" error={err("name")}>
          <Input
            name="name"
            defaultValue={product?.name ?? ""}
            placeholder="Cappuccino"
            autoFocus
            aria-invalid={!!err("name")}
          />
        </Field>

        <div className="grid grid-cols-2 gap-4">
          <Field label="SKU" error={err("sku")}>
            <Input
              name="sku"
              defaultValue={product?.sku ?? ""}
              placeholder="COF-001"
              aria-invalid={!!err("sku")}
            />
          </Field>
          <Field label="Barcode" error={err("barcode")} optional>
            <Input
              name="barcode"
              defaultValue={product?.barcode ?? ""}
              placeholder="0123456789012"
              aria-invalid={!!err("barcode")}
            />
          </Field>
        </div>

        <Field label="Description" error={err("description")} optional>
          <Textarea
            name="description"
            defaultValue={product?.description ?? ""}
            placeholder="Short description"
            rows={2}
          />
        </Field>

        <div className="grid grid-cols-2 gap-4">
          <Field label="Cost price" error={err("costPrice")}>
            <Input
              name="costPrice"
              type="number"
              step="0.01"
              min="0"
              defaultValue={product?.costPrice ?? 0}
              aria-invalid={!!err("costPrice")}
            />
          </Field>
          <Field label="Selling price" error={err("sellingPrice")}>
            <Input
              name="sellingPrice"
              type="number"
              step="0.01"
              min="0"
              defaultValue={product?.sellingPrice ?? ""}
              aria-invalid={!!err("sellingPrice")}
            />
          </Field>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <Field label="Quantity" error={err("quantity")}>
            <Input
              name="quantity"
              type="number"
              step="1"
              min="0"
              defaultValue={product?.quantity ?? 0}
              aria-invalid={!!err("quantity")}
            />
          </Field>
          <Field label="Reorder level" error={err("reorderLevel")}>
            <Input
              name="reorderLevel"
              type="number"
              step="1"
              min="0"
              defaultValue={product?.reorderLevel ?? 0}
              aria-invalid={!!err("reorderLevel")}
            />
          </Field>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <Field label="Category" error={err("categoryId")} optional>
            <RelationSelect
              name="categoryId"
              placeholder="No category"
              defaultValue={product?.categoryId ?? null}
              items={options.categories}
            />
          </Field>
          <Field label="Supplier" error={err("supplierId")} optional>
            <RelationSelect
              name="supplierId"
              placeholder="No supplier"
              defaultValue={product?.supplierId ?? null}
              items={options.suppliers}
            />
          </Field>
        </div>
      </div>

      <DialogFooter>
        <DialogClose
          render={<Button type="button" variant="outline" disabled={pending} />}
        >
          Cancel
        </DialogClose>
        <Button type="submit" disabled={pending}>
          {pending ? "Saving…" : isEdit ? "Save changes" : "Create product"}
        </Button>
      </DialogFooter>
    </form>
  );
}

function Field({
  label,
  error,
  optional,
  children,
}: {
  label: string;
  error?: string;
  optional?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div className="grid gap-1.5">
      <Label className="justify-between">
        <span>{label}</span>
        {optional && (
          <span className="text-xs font-normal text-muted-foreground">
            Optional
          </span>
        )}
      </Label>
      {children}
      {error && <p className="text-xs text-destructive">{error}</p>}
    </div>
  );
}

function RelationSelect({
  name,
  placeholder,
  defaultValue,
  items,
}: {
  name: string;
  placeholder: string;
  defaultValue: string | null;
  items: { id: string; name: string }[];
}) {
  return (
    <Select name={name} defaultValue={defaultValue}>
      <SelectTrigger className="w-full">
        <SelectValue>
          {(value: string | null) =>
            value
              ? (items.find((i) => i.id === value)?.name ?? placeholder)
              : placeholder
          }
        </SelectValue>
      </SelectTrigger>
      <SelectContent>
        <SelectItem value={null}>{placeholder}</SelectItem>
        {items.map((i) => (
          <SelectItem key={i.id} value={i.id}>
            {i.name}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
