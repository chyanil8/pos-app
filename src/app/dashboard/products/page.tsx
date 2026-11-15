import type { Metadata } from "next";
import { Suspense } from "react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { getProductFormOptions, getProducts } from "@/lib/products";
import { ProductsView } from "./products-view";

export const metadata: Metadata = {
  title: "Products · POS",
};

export default function ProductsPage() {
  return (
    <div className="mx-auto w-full max-w-6xl flex-1 space-y-6 px-6 py-8">
      <header className="space-y-1">
        <h1 className="font-heading text-2xl font-semibold tracking-tight">
          Products
        </h1>
        <p className="text-sm text-muted-foreground">
          Manage your catalog — add, edit, and remove products.
        </p>
      </header>

      {/* The catalog is read at request time, so stream it in behind Suspense;
          the static header prerenders immediately. */}
      <Suspense fallback={<ProductsSkeleton />}>
        <ProductsData />
      </Suspense>
    </div>
  );
}

async function ProductsData() {
  const [products, options] = await Promise.all([
    getProducts(),
    getProductFormOptions(),
  ]);

  return <ProductsView products={products} options={options} />;
}

function ProductsSkeleton() {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="h-4 w-32 animate-pulse rounded bg-muted" />
        <div className="h-8 w-32 animate-pulse rounded-lg bg-muted" />
      </div>
      <div className="rounded-xl border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Product</TableHead>
              <TableHead>Category</TableHead>
              <TableHead>Supplier</TableHead>
              <TableHead className="text-right">Cost</TableHead>
              <TableHead className="text-right">Price</TableHead>
              <TableHead className="text-right">Stock</TableHead>
              <TableHead className="w-10" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {["r1", "r2", "r3", "r4", "r5", "r6"].map((row) => (
              <TableRow key={row}>
                <TableCell colSpan={7}>
                  <div className="h-6 w-full animate-pulse rounded bg-muted" />
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
