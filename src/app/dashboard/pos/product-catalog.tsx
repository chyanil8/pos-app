"use client";

import { AlertCircle, Plus, Search } from "lucide-react";
import type { RefObject } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { formatCurrency } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { PosProduct } from "@/lib/pos";

type Props = {
  products: PosProduct[];
  query: string;
  onQueryChange: (q: string) => void;
  // Fired on Enter in the search box — used for barcode-scan "add on scan".
  onSubmit: () => void;
  loading: boolean;
  error: boolean;
  onRetry: () => void;
  onAdd: (product: PosProduct) => void;
  // Quantity of this product already in the cart, to cap against live stock.
  inCartQty: (id: string) => number;
  // Lets the terminal focus the search box via the F2 shortcut.
  inputRef: RefObject<HTMLInputElement | null>;
};

export function ProductCatalog({
  products,
  query,
  onQueryChange,
  onSubmit,
  loading,
  error,
  onRetry,
  onAdd,
  inCartQty,
  inputRef,
}: Props) {
  return (
    <div className="flex h-full flex-col gap-4">
      <div className="space-y-2">
        <div className="relative">
          <Search className="absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            ref={inputRef}
            type="search"
            value={query}
            onChange={(e) => onQueryChange(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                onSubmit();
              }
            }}
            placeholder="Scan barcode or search by name or SKU…"
            className="h-11 pl-9 text-base"
            aria-label="Search products"
            autoFocus
          />
        </div>
        <div className="flex items-center justify-between px-0.5 text-xs text-muted-foreground">
          <span>
            {loading
              ? "Searching…"
              : `${products.length} ${products.length === 1 ? "product" : "products"}`}
          </span>
          <span className="hidden items-center gap-3 sm:flex">
            <Shortcut keys="F2" label="Search" />
            <Shortcut keys="Enter" label="Add scanned" />
            <Shortcut keys="F9" label="Checkout" />
          </span>
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto">
        {error ? (
          <CatalogMessage
            icon={<AlertCircle className="size-6 text-destructive" />}
            title="Couldn't load products"
            body="There was a problem reaching the catalog."
          >
            <Button variant="outline" size="sm" onClick={onRetry}>
              Try again
            </Button>
          </CatalogMessage>
        ) : loading ? (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-4">
            {Array.from({ length: 12 }).map((_, i) => (
              <Skeleton key={i} className="h-32 rounded-xl" />
            ))}
          </div>
        ) : products.length === 0 ? (
          <CatalogMessage
            icon={<Search className="size-6 text-muted-foreground" />}
            title={query ? "No matching products" : "No active products"}
            body={
              query
                ? "Try a different name, SKU, or barcode."
                : "Add products to your catalog to start selling."
            }
          />
        ) : (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-4">
            {products.map((product) => {
              const reserved = inCartQty(product.id);
              const remaining = product.quantity - reserved;
              const outOfStock = product.quantity <= 0;
              const disabled = outOfStock || remaining <= 0;

              return (
                <button
                  key={product.id}
                  type="button"
                  onClick={() => onAdd(product)}
                  disabled={disabled}
                  aria-label={`Add ${product.name} to cart`}
                  className={cn(
                    "group relative flex flex-col justify-between gap-3 rounded-xl border bg-card p-3 text-left transition",
                    "hover:border-indigo-400 hover:shadow-sm focus-visible:border-indigo-500 focus-visible:ring-2 focus-visible:ring-indigo-500/40 focus-visible:outline-none",
                    "active:scale-[0.98]",
                    disabled && "cursor-not-allowed opacity-55 hover:border-border hover:shadow-none active:scale-100",
                  )}
                >
                  {reserved > 0 && (
                    <span className="absolute -top-2 -right-2 flex size-6 items-center justify-center rounded-full bg-indigo-600 text-xs font-semibold text-white tabular-nums shadow">
                      {reserved}
                    </span>
                  )}
                  <div className="space-y-1">
                    <div className="line-clamp-2 text-sm font-medium leading-tight">
                      {product.name}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {product.sku}
                    </div>
                  </div>
                  <div className="flex items-end justify-between gap-2">
                    <div className="space-y-1">
                      <div className="font-heading text-lg font-semibold tabular-nums">
                        {formatCurrency(product.sellingPrice)}
                      </div>
                      <Badge
                        variant={
                          outOfStock
                            ? "destructive"
                            : remaining <= 5
                              ? "secondary"
                              : "outline"
                        }
                      >
                        {outOfStock ? "Out of stock" : `${remaining} left`}
                      </Badge>
                    </div>
                    <span
                      className={cn(
                        "flex size-8 items-center justify-center rounded-lg bg-indigo-600 text-white transition group-hover:bg-indigo-700",
                        disabled && "bg-muted text-muted-foreground group-hover:bg-muted",
                      )}
                    >
                      <Plus className="size-4" />
                    </span>
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

function Shortcut({ keys, label }: { keys: string; label: string }) {
  return (
    <span className="flex items-center gap-1.5">
      <kbd className="rounded border bg-muted px-1.5 py-0.5 font-mono text-[10px] font-medium text-foreground">
        {keys}
      </kbd>
      {label}
    </span>
  );
}

function CatalogMessage({
  icon,
  title,
  body,
  children,
}: {
  icon: React.ReactNode;
  title: string;
  body: string;
  children?: React.ReactNode;
}) {
  return (
    <div className="flex flex-col items-center justify-center gap-2 py-16 text-center">
      {icon}
      <p className="font-medium">{title}</p>
      <p className="max-w-xs text-sm text-muted-foreground">{body}</p>
      {children}
    </div>
  );
}
