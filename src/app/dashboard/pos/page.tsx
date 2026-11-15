import { ShieldAlert } from "lucide-react";
import type { Metadata } from "next";
import { Suspense } from "react";
import { Skeleton } from "@/components/ui/skeleton";
import { canSell, getCurrentUser } from "@/lib/auth";
import { getTaxRate, searchPosProducts } from "@/lib/pos";
import { PosTerminal } from "./pos-terminal";

export const metadata: Metadata = {
  title: "Point of Sale · POS",
};

export default function PosPage() {
  return (
    <div className="flex min-h-[calc(100svh-3.5rem)] flex-col gap-6 bg-muted/30 p-6">
      <header className="space-y-1">
        <h1 className="font-heading text-2xl font-semibold tracking-tight">
          Point of Sale
        </h1>
        <p className="text-sm text-muted-foreground">
          Ring up a sale — search the catalog, build the cart, and check out.
        </p>
      </header>

      <Suspense fallback={<PosSkeleton />}>
        <PosData />
      </Suspense>
    </div>
  );
}

async function PosData() {
  const user = await getCurrentUser();

  if (!user || !user.isActive || !canSell(user.role)) {
    return <NotAuthorized />;
  }

  const [initialProducts, taxRate] = await Promise.all([
    searchPosProducts(""),
    Promise.resolve(getTaxRate()),
  ]);

  return (
    <PosTerminal
      initialProducts={initialProducts}
      taxRate={taxRate}
      cashierName={user.name}
    />
  );
}

function NotAuthorized() {
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-3 rounded-xl border bg-card py-20 text-center">
      <ShieldAlert className="size-8 text-muted-foreground" />
      <p className="font-medium">You don&apos;t have access to the register</p>
      <p className="max-w-sm text-sm text-muted-foreground">
        Only cashiers, managers, and owners can create sales. Ask an owner to
        update your role if you need access.
      </p>
    </div>
  );
}

function PosSkeleton() {
  return (
    <div className="grid flex-1 grid-cols-1 gap-6 lg:grid-cols-[1fr_380px]">
      <div className="space-y-4 rounded-xl border bg-card p-4">
        <Skeleton className="h-9 w-full" />
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {Array.from({ length: 9 }).map((_, i) => (
            <Skeleton key={i} className="h-28 rounded-xl" />
          ))}
        </div>
      </div>
      <div className="rounded-xl border bg-card">
        <Skeleton className="h-full min-h-96 w-full rounded-xl" />
      </div>
    </div>
  );
}
