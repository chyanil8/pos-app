import { z } from "zod";

// Shared between the server actions (for authoritative validation) and the
// client form (for the same error messages). Form fields arrive as strings via
// FormData, so numbers are coerced and optional text/relations collapse empty
// strings to `null` to match the nullable columns in the Prisma schema.

const nullableText = (max: number) =>
  z
    .string()
    .trim()
    .max(max, `Must be ${max} characters or fewer`)
    .transform((v) => (v === "" ? null : v))
    .nullable();

const nullableId = z
  .string()
  .trim()
  .transform((v) => (v === "" ? null : v))
  .nullable();

export const productSchema = z.object({
  name: z.string().trim().min(1, "Name is required").max(200),
  sku: z.string().trim().min(1, "SKU is required").max(100),
  barcode: nullableText(100),
  description: nullableText(1000),
  costPrice: z.coerce
    .number({ message: "Cost price must be a number" })
    .min(0, "Cost price can't be negative"),
  sellingPrice: z.coerce
    .number({ message: "Selling price must be a number" })
    .min(0, "Selling price can't be negative"),
  quantity: z.coerce
    .number({ message: "Quantity must be a number" })
    .int("Quantity must be a whole number")
    .min(0, "Quantity can't be negative"),
  reorderLevel: z.coerce
    .number({ message: "Reorder level must be a number" })
    .int("Reorder level must be a whole number")
    .min(0, "Reorder level can't be negative"),
  categoryId: nullableId,
  supplierId: nullableId,
});

export type ProductInput = z.infer<typeof productSchema>;

// Result shape returned by every product server action and consumed by the
// form via `useActionState`.
export type FormState = {
  status: "idle" | "success" | "error";
  message?: string;
  fieldErrors?: Record<string, string[]>;
};

export const initialFormState: FormState = { status: "idle" };
