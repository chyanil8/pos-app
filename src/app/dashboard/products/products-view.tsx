"use client";

import { MoreHorizontal, Pencil, Plus, Search, Trash2 } from "lucide-react";
import { useMemo, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { formatCurrency, formatNumber } from "@/lib/format";
import type { ProductFormOptions, ProductRow } from "@/lib/products";
import { DeleteProductDialog } from "./delete-product-dialog";
import { ProductFormDialog } from "./product-form-dialog";

type Props = {
  products: ProductRow[];
  options: ProductFormOptions;
};

export function ProductsView({ products, options }: Props) {
  // `editing: null` while the form dialog is closed, `"new"` for create, or a
  // row for edit. `deleting` holds the row pending deletion.
  const [editing, setEditing] = useState<ProductRow | "new" | null>(null);
  const [deleting, setDeleting] = useState<ProductRow | null>(null);
  const [query, setQuery] = useState("");

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return products;
    return products.filter((p) =>
      [p.name, p.sku, p.barcode, p.categoryName, p.supplierName].some(
        (field) => field?.toLowerCase().includes(q),
      ),
    );
  }, [products, query]);

  return (
    <>
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="relative w-full sm:max-w-xs">
          <Search className="absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search products…"
            className="pl-8"
            aria-label="Search products"
          />
        </div>
        <div className="flex items-center gap-4">
          <p className="text-sm text-muted-foreground">
            {formatNumber(filtered.length)} product
            {filtered.length === 1 ? "" : "s"}
          </p>
          <Button onClick={() => setEditing("new")}>
            <Plus data-icon="inline-start" />
            Add product
          </Button>
        </div>
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
            {filtered.length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={7}
                  className="py-10 text-center text-sm text-muted-foreground"
                >
                  {products.length === 0
                    ? "No products yet. Add your first one to get started."
                    : "No products match your search."}
                </TableCell>
              </TableRow>
            ) : (
              filtered.map((p) => (
                <TableRow key={p.id}>
                  <TableCell>
                    <div className="font-medium">{p.name}</div>
                    <div className="text-xs text-muted-foreground">{p.sku}</div>
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {p.categoryName ?? "—"}
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {p.supplierName ?? "—"}
                  </TableCell>
                  <TableCell className="text-right tabular-nums text-muted-foreground">
                    {formatCurrency(p.costPrice)}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    {formatCurrency(p.sellingPrice)}
                  </TableCell>
                  <TableCell className="text-right">
                    <Badge
                      variant={
                        p.quantity === 0
                          ? "destructive"
                          : p.quantity <= p.reorderLevel
                            ? "secondary"
                            : "outline"
                      }
                    >
                      {p.quantity}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <DropdownMenu>
                      <DropdownMenuTrigger
                        render={<Button variant="ghost" size="icon-sm" />}
                      >
                        <MoreHorizontal />
                        <span className="sr-only">Actions</span>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => setEditing(p)}>
                          <Pencil />
                          Edit
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          variant="destructive"
                          onClick={() => setDeleting(p)}
                        >
                          <Trash2 />
                          Delete
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      <ProductFormDialog
        open={editing !== null}
        onOpenChange={(open) => !open && setEditing(null)}
        product={editing === "new" ? null : editing}
        options={options}
      />

      <DeleteProductDialog
        open={deleting !== null}
        onOpenChange={(open) => !open && setDeleting(null)}
        product={deleting}
      />
    </>
  );
}
