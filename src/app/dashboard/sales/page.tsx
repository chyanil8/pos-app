import { ChevronLeft, ChevronRight } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { getSalesHistory } from "@/lib/pos";
import { formatCurrency, formatDateTime, titleCase } from "@/lib/format";

export const metadata: Metadata = {
  title: "Sales · POS",
};

const PAGE_SIZE = 20;

export default function SalesPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string }>;
}) {
  return (
    <div className="mx-auto w-full max-w-6xl flex-1 space-y-6 px-6 py-8">
      <header className="space-y-1">
        <h1 className="font-heading text-2xl font-semibold tracking-tight">
          Sales
        </h1>
        <p className="text-sm text-muted-foreground">
          Every completed and voided transaction, newest first.
        </p>
      </header>

      <Suspense fallback={<SalesSkeleton />}>
        <SalesData searchParams={searchParams} />
      </Suspense>
    </div>
  );
}

async function SalesData({
  searchParams,
}: {
  searchParams: Promise<{ page?: string }>;
}) {
  const { page: pageParam } = await searchParams;
  const page = Math.max(1, Number(pageParam) || 1);
  const { sales, total, totalPages } = await getSalesHistory({
    page,
    pageSize: PAGE_SIZE,
  });

  return (
    <>
      <div className="rounded-xl border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Sale</TableHead>
              <TableHead>Cashier</TableHead>
              <TableHead>Payment</TableHead>
              <TableHead className="text-right">Items</TableHead>
              <TableHead className="text-right">Total</TableHead>
              <TableHead className="text-right">Status</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {sales.length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={6}
                  className="py-10 text-center text-sm text-muted-foreground"
                >
                  No sales recorded yet.
                </TableCell>
              </TableRow>
            ) : (
              sales.map((sale) => (
                <TableRow
                  key={sale.id}
                  className="cursor-pointer"
                  // Row links to the receipt; the whole row is clickable via the
                  // anchor in the first cell for keyboard access.
                >
                  <TableCell>
                    <Link
                      href={`/dashboard/sales/${sale.id}`}
                      className="font-medium hover:underline"
                    >
                      {sale.saleNumber}
                    </Link>
                    <div className="text-xs text-muted-foreground">
                      {formatDateTime(sale.createdAt)}
                    </div>
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {sale.cashierName}
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {titleCase(sale.paymentMethod)}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    {sale.itemCount}
                  </TableCell>
                  <TableCell className="text-right font-medium tabular-nums">
                    {formatCurrency(sale.total)}
                  </TableCell>
                  <TableCell className="text-right">
                    <Badge
                      variant={
                        sale.status === "VOIDED" ? "destructive" : "secondary"
                      }
                    >
                      {titleCase(sale.status)}
                    </Badge>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          {total} sale{total === 1 ? "" : "s"} · page {page} of {totalPages}
        </p>
        <div className="flex items-center gap-2">
          {page <= 1 ? (
            <Button variant="outline" size="sm" disabled>
              <ChevronLeft data-icon="inline-start" />
              Previous
            </Button>
          ) : (
            <Button
              variant="outline"
              size="sm"
              render={
                <Link
                  href={`/dashboard/sales?page=${page - 1}`}
                  aria-label="Previous page"
                />
              }
            >
              <ChevronLeft data-icon="inline-start" />
              Previous
            </Button>
          )}
          {page >= totalPages ? (
            <Button variant="outline" size="sm" disabled>
              Next
              <ChevronRight data-icon="inline-end" />
            </Button>
          ) : (
            <Button
              variant="outline"
              size="sm"
              render={
                <Link
                  href={`/dashboard/sales?page=${page + 1}`}
                  aria-label="Next page"
                />
              }
            >
              Next
              <ChevronRight data-icon="inline-end" />
            </Button>
          )}
        </div>
      </div>
    </>
  );
}

function SalesSkeleton() {
  return (
    <div className="rounded-xl border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Sale</TableHead>
            <TableHead>Cashier</TableHead>
            <TableHead>Payment</TableHead>
            <TableHead className="text-right">Items</TableHead>
            <TableHead className="text-right">Total</TableHead>
            <TableHead className="text-right">Status</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {Array.from({ length: 8 }).map((_, i) => (
            <TableRow key={i}>
              <TableCell colSpan={6}>
                <div className="h-6 w-full animate-pulse rounded bg-muted" />
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
