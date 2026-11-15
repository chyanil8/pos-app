"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { type FormState, productSchema } from "./schema";

// Server actions are the single source of truth for mutations: they re-validate
// with the shared Zod schema (never trust the client), translate known database
// errors into friendly messages, and revalidate the affected routes.

function hasCode(error: unknown, code: string): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    (error as { code?: unknown }).code === code
  );
}

// Maps a Prisma P2002 unique-constraint violation to the offending field so the
// form can highlight it (SKU and barcode are both unique).
function uniqueFieldError(error: unknown): FormState | null {
  if (!hasCode(error, "P2002")) return null;
  const target = (error as { meta?: { target?: unknown } }).meta?.target;
  const fields = Array.isArray(target) ? target.map(String) : [];
  const field = fields.includes("barcode") ? "barcode" : "sku";
  const label = field === "barcode" ? "barcode" : "SKU";
  return {
    status: "error",
    message: `A product with that ${label} already exists.`,
    fieldErrors: { [field]: [`This ${label} is already in use`] },
  };
}

function parse(formData: FormData) {
  return productSchema.safeParse({
    name: formData.get("name"),
    sku: formData.get("sku"),
    barcode: formData.get("barcode"),
    description: formData.get("description"),
    costPrice: formData.get("costPrice"),
    sellingPrice: formData.get("sellingPrice"),
    quantity: formData.get("quantity"),
    reorderLevel: formData.get("reorderLevel"),
    categoryId: formData.get("categoryId"),
    supplierId: formData.get("supplierId"),
  });
}

function revalidate() {
  revalidatePath("/dashboard/products");
  revalidatePath("/dashboard");
}

export async function createProduct(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const parsed = parse(formData);
  if (!parsed.success) {
    return {
      status: "error",
      message: "Please fix the highlighted fields.",
      fieldErrors: parsed.error.flatten().fieldErrors as Record<
        string,
        string[]
      >,
    };
  }

  try {
    await prisma.product.create({ data: parsed.data });
  } catch (error) {
    const unique = uniqueFieldError(error);
    if (unique) return unique;
    throw error;
  }

  revalidate();
  return { status: "success", message: "Product created." };
}

export async function updateProduct(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const id = formData.get("id");
  if (typeof id !== "string" || id === "") {
    return { status: "error", message: "Missing product id." };
  }

  const parsed = parse(formData);
  if (!parsed.success) {
    return {
      status: "error",
      message: "Please fix the highlighted fields.",
      fieldErrors: parsed.error.flatten().fieldErrors as Record<
        string,
        string[]
      >,
    };
  }

  try {
    await prisma.product.update({ where: { id }, data: parsed.data });
  } catch (error) {
    const unique = uniqueFieldError(error);
    if (unique) return unique;
    if (hasCode(error, "P2025")) {
      return { status: "error", message: "That product no longer exists." };
    }
    throw error;
  }

  revalidate();
  return { status: "success", message: "Product updated." };
}

// "Delete" respects the schema's history-preservation rules: a product that has
// never been sold, purchased, or moved is removed outright; one that is
// referenced can't be hard-deleted (onDelete: Restrict), so it is archived by
// clearing `isActive`, which drops it from the active catalog all the same.
export async function deleteProduct(id: string): Promise<FormState> {
  if (!id) return { status: "error", message: "Missing product id." };

  try {
    await prisma.product.delete({ where: { id } });
    revalidate();
    return { status: "success", message: "Product deleted." };
  } catch (error) {
    if (hasCode(error, "P2025")) {
      return { status: "error", message: "That product no longer exists." };
    }
    if (hasCode(error, "P2003")) {
      await prisma.product.update({ where: { id }, data: { isActive: false } });
      revalidate();
      return {
        status: "success",
        message: "Product archived (it has sales or purchase history).",
      };
    }
    throw error;
  }
}
