import { ArrowLeft } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { Receipt } from "@/app/dashboard/pos/receipt";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { canVoid, getCurrentUser } from "@/lib/auth";
import { getSaleReceipt } from "@/lib/pos";
import { ReceiptActions } from "../receipt-actions";

export const metadata: Metadata = {
  title: "Receipt · POS",
};

export default function SaleDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  return (
    <div className="mx-auto w-full max-w-2xl flex-1 space-y-6 px-6 py-8">
      <div className="no-print">
        <Button variant="ghost" size="sm" render={<Link href="/dashboard/sales" />}>
          <ArrowLeft data-icon="inline-start" />
          Back to sales
        </Button>
      </div>

      <Suspense fallback={<Skeleton className="h-96 w-full rounded-xl" />}>
        <SaleReceipt params={params} />
      </Suspense>
    </div>
  );
}

async function SaleReceipt({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [receipt, user] = await Promise.all([getSaleReceipt(id), getCurrentUser()]);

  if (!receipt) notFound();

  const mayVoid = user ? canVoid(user.role) : false;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-heading text-xl font-semibold tracking-tight">
            {receipt.saleNumber}
          </h1>
          <p className="text-sm text-muted-foreground">Transaction receipt</p>
        </div>
        <ReceiptActions
          saleId={receipt.id}
          saleNumber={receipt.saleNumber}
          canVoid={mayVoid}
          isVoided={receipt.status === "VOIDED"}
        />
      </div>

      <div className="rounded-xl border bg-card p-6">
        <Receipt receipt={receipt} />
      </div>
    </div>
  );
}
