
import {
  AlertTriangle,
  Boxes,
  DollarSign,
  Package,
  ShoppingCart,
  Tags,
  TrendingUp,
  Users,
} from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { SaleStatus } from "@/generated/prisma/enums";
import { getDashboardData } from "@/lib/dashboard";
import { formatCurrency, formatDateTime, formatNumber } from "@/lib/format";

export const metadata: Metadata = {
  title: "Dashboard · POS",
};

// Figures are read live from the database. Under Next's Cache Components, these
// uncached Prisma reads make the route dynamic, so the data access must live
// behind a `<Suspense>` boundary — the static header prerenders, and the
// figures stream in once the request-time query resolves.
export default function DashboardPage() {
  return (
    <div className="mx-auto w-full max-w-6xl flex-1 space-y-8 px-6 py-8">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div className="space-y-1">
          <h1 className="font-heading text-2xl font-semibold tracking-tight">
            Dashboard
          </h1>
          <p className="text-sm text-muted-foreground">
            Overview of today&apos;s sales and current inventory health.
          </p>
        </div>
        <Button render={<Link href="/dashboard/products" />} variant="outline">
          <Package data-icon="inline-start" />
          Manage products
        </Button>
      </header>

      <Suspense fallback={<DashboardSkeleton />}>
        <DashboardContent />
      </Suspense>
    </div>
  );
}

async function DashboardContent() {
  const data = await getDashboardData();

  const stats = [
    {
      label: "Revenue Today",
      value: formatCurrency(data.revenueToday),
      hint: `${formatNumber(data.countToday)} sale${data.countToday === 1 ? "" : "s"}`,
      icon: DollarSign,
    },
    {
      label: "Revenue This Month",
      value: formatCurrency(data.revenueMonth),
      hint: `${formatNumber(data.countMonth)} sale${data.countMonth === 1 ? "" : "s"}`,
      icon: TrendingUp,
    },
    {
      label: "Inventory Value",
      value: formatCurrency(data.inventoryValue),
      hint: `${formatCurrency(data.retailValue)} at retail`,
      icon: Boxes,
    },
    {
      label: "Low Stock Items",
      value: formatNumber(data.lowStock.length),
      hint: `${formatNumber(data.outOfStock)} out of stock`,
      icon: AlertTriangle,
      alert: data.lowStock.length > 0,
    },
  ];

  const secondary = [
    { label: "Active Products", value: data.totalProducts, icon: Package },
    { label: "Suppliers", value: data.supplierCount, icon: Users },
    { label: "Categories", value: data.categoryCount, icon: Tags },
  ];

  return (
    <>
      <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {stats.map((s) => (
          <Card key={s.label}>
            <CardHeader className="flex! flex-row items-center justify-between gap-2">
              <CardDescription>{s.label}</CardDescription>
              <s.icon
                className={
                  s.alert
                    ? "size-4 text-destructive"
                    : "size-4 text-muted-foreground"
                }
              />
            </CardHeader>
            <CardContent className="space-y-1">
              <div className="font-heading text-2xl font-semibold tracking-tight">
                {s.value}
              </div>
              <p className="text-xs text-muted-foreground">{s.hint}</p>
            </CardContent>
          </Card>
        ))}
      </section>

      <section className="grid gap-4 sm:grid-cols-3">
        {secondary.map((s) => (
          <Card key={s.label} size="sm">
            <CardContent className="flex items-center gap-3">
              <div className="flex size-10 items-center justify-center rounded-lg bg-muted">
                <s.icon className="size-5 text-muted-foreground" />
              </div>
              <div>
                <div className="font-heading text-xl font-semibold">
                  {formatNumber(s.value)}
                </div>
                <p className="text-xs text-muted-foreground">{s.label}</p>
              </div>
            </CardContent>
          </Card>
        ))}
      </section>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <ShoppingCart className="size-4" />
              Recent Sales
            </CardTitle>
            <CardDescription>The latest transactions.</CardDescription>
          </CardHeader>
          <CardContent className="px-0">
            {data.recentSales.length === 0 ? (
              <EmptyState message="No sales recorded yet." />
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Sale</TableHead>
                    <TableHead>Cashier</TableHead>
                    <TableHead className="text-right">Items</TableHead>
                    <TableHead className="text-right">Total</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.recentSales.map((sale) => (
                    <TableRow key={sale.id}>
                      <TableCell>
                        <div className="font-medium">{sale.saleNumber}</div>
                        <div className="text-xs text-muted-foreground">
                          {formatDateTime(sale.createdAt)}
                        </div>
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {sale.createdBy.name}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        {sale._count.items}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-2">
                          {sale.status === SaleStatus.VOIDED && (
                            <Badge variant="destructive">Voided</Badge>
                          )}
                          <span className="font-medium tabular-nums">
                            {formatCurrency(sale.total)}
                          </span>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <AlertTriangle className="size-4" />
              Low Stock
            </CardTitle>
            <CardDescription>
              Products at or below their reorder level.
            </CardDescription>
          </CardHeader>
          <CardContent className="px-0">
            {data.lowStock.length === 0 ? (
              <EmptyState message="Everything is well stocked." />
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Product</TableHead>
                    <TableHead>Category</TableHead>
                    <TableHead className="text-right">On Hand</TableHead>
                    <TableHead className="text-right">Reorder</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.lowStock.slice(0, 8).map((p) => (
                    <TableRow key={p.id}>
                      <TableCell>
                        <div className="font-medium">{p.name}</div>
                        <div className="text-xs text-muted-foreground">
                          {p.sku}
                        </div>
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {p.category?.name ?? "—"}
                      </TableCell>
                      <TableCell className="text-right">
                        <Badge
                          variant={
                            p.quantity === 0 ? "destructive" : "secondary"
                          }
                        >
                          {p.quantity}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right tabular-nums text-muted-foreground">
                        {p.reorderLevel}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>
    </>
  );
}

function DashboardSkeleton() {
  return (
    <div className="space-y-8">
      <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <Card key={i}>
            <CardHeader className="flex! flex-row items-center justify-between gap-2">
              <div className="h-4 w-24 animate-pulse rounded bg-muted" />
              <div className="size-4 animate-pulse rounded bg-muted" />
            </CardHeader>
            <CardContent className="space-y-2">
              <div className="h-7 w-20 animate-pulse rounded bg-muted" />
              <div className="h-3 w-16 animate-pulse rounded bg-muted" />
            </CardContent>
          </Card>
        ))}
      </section>

      <section className="grid gap-4 sm:grid-cols-3">
        {Array.from({ length: 3 }).map((_, i) => (
          <Card key={i} size="sm">
            <CardContent className="flex items-center gap-3">
              <div className="size-10 animate-pulse rounded-lg bg-muted" />
              <div className="space-y-2">
                <div className="h-5 w-12 animate-pulse rounded bg-muted" />
                <div className="h-3 w-20 animate-pulse rounded bg-muted" />
              </div>
            </CardContent>
          </Card>
        ))}
      </section>

      <div className="grid gap-6 lg:grid-cols-2">
        {Array.from({ length: 2 }).map((_, i) => (
          <Card key={i}>
            <CardHeader className="space-y-2">
              <div className="h-5 w-32 animate-pulse rounded bg-muted" />
              <div className="h-3 w-40 animate-pulse rounded bg-muted" />
            </CardHeader>
            <CardContent className="space-y-3">
              {Array.from({ length: 5 }).map((_, j) => (
                <div
                  key={j}
                  className="h-8 w-full animate-pulse rounded bg-muted"
                />
              ))}
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}

function EmptyState({ message }: { message: string }) {
  return (
    <div className="px-6 py-10 text-center text-sm text-muted-foreground">
      {message}
    </div>
  );
}
