import {
  SignInButton,
  SignUpButton,
  Show,
  UserButton,
} from "@clerk/nextjs";
import {
  ArrowRight,
  BarChart3,
  Boxes,
  Receipt,
  ScanLine,
  ShieldCheck,
  Store,
} from "lucide-react";
import Link from "next/link";
import { Suspense } from "react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

const features = [
  {
    icon: ScanLine,
    title: "Fast checkout",
    description:
      "Scan, ring up, and take payment in seconds with a keyboard-first register.",
  },
  {
    icon: Boxes,
    title: "Live inventory",
    description:
      "Stock levels update on every sale, with low-stock and reorder alerts.",
  },
  {
    icon: BarChart3,
    title: "Clear reporting",
    description:
      "Daily and monthly revenue, best sellers, and inventory value at a glance.",
  },
  {
    icon: ShieldCheck,
    title: "Reliable records",
    description:
      "Every transaction is logged with cashier, items, and totals for easy audits.",
  },
];

export default function Home() {
  return (
    <div className="relative flex flex-1 flex-col overflow-hidden">
      {/* Soft gradient backdrop */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 -z-10 bg-[radial-gradient(60%_50%_at_50%_0%,color-mix(in_oklch,var(--primary),transparent_88%),transparent)]"
      />

      <header className="mx-auto flex w-full max-w-6xl items-center justify-between px-6 py-5">
        <div className="flex items-center gap-2">
          <div className="flex size-8 items-center justify-center rounded-lg bg-primary text-primary-foreground">
            <Store className="size-4" />
          </div>
          <span className="font-heading text-lg font-semibold tracking-tight">
            Counter
          </span>
        </div>
        {/* Auth state depends on request cookies, so stream it in and keep the
            rest of the marketing shell prerendered. */}
        <Suspense fallback={<div className="h-8 w-40" />}>
          <div className="flex items-center gap-2">
            <Show when="signed-out">
              <SignInButton mode="modal">
                <Button variant="ghost" size="sm">
                  Sign in
                </Button>
              </SignInButton>
              <SignUpButton mode="modal">
                <Button size="sm">Sign up</Button>
              </SignUpButton>
            </Show>
            <Show when="signed-in">
              <Button
                render={<Link href="/dashboard" />}
                variant="ghost"
                size="sm"
              >
                Open dashboard
                <ArrowRight data-icon="inline-end" />
              </Button>
              <UserButton />
            </Show>
          </div>
        </Suspense>
      </header>

      <main className="mx-auto flex w-full max-w-6xl flex-1 flex-col px-6 pb-16">
        {/* Hero */}
        <section className="flex flex-col items-center gap-6 py-16 text-center sm:py-24">
          <span className="inline-flex items-center gap-2 rounded-full border border-border bg-card px-3 py-1 text-xs font-medium text-muted-foreground">
            <Receipt className="size-3.5" />
            Point of sale, made simple
          </span>
          <h1 className="max-w-3xl font-heading text-4xl font-semibold tracking-tight text-balance sm:text-5xl md:text-6xl">
            Run your shop from one fast, modern register
          </h1>
          <p className="max-w-xl text-base text-pretty text-muted-foreground sm:text-lg">
            Sell, track stock, and see how your business is doing — all in a
            clean dashboard your whole team can use.
          </p>
          <div className="flex flex-col gap-3 sm:flex-row">
            <Button render={<Link href="/dashboard" />} size="lg">
              Go to dashboard
              <ArrowRight data-icon="inline-end" />
            </Button>
            <Button
              render={<Link href="/dashboard/products" />}
              variant="outline"
              size="lg"
            >
              <Boxes data-icon="inline-start" />
              Manage products
            </Button>
          </div>
        </section>

        {/* Feature grid */}
        <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {features.map((feature) => (
            <Card
              key={feature.title}
              className="transition-colors hover:border-ring/40"
            >
              <CardHeader>
                <div className="flex size-10 items-center justify-center rounded-lg bg-muted text-foreground">
                  <feature.icon className="size-5" />
                </div>
                <CardTitle className="mt-3 font-heading text-base">
                  {feature.title}
                </CardTitle>
                <CardDescription>{feature.description}</CardDescription>
              </CardHeader>
            </Card>
          ))}
        </section>

        {/* CTA */}
        <section className="mt-16">
          <Card className="overflow-hidden border-border bg-card">
            <CardContent className="flex flex-col items-start justify-between gap-6 py-8 sm:flex-row sm:items-center">
              <div className="space-y-1">
                <h2 className="font-heading text-xl font-semibold tracking-tight">
                  Ready to ring up your first sale?
                </h2>
                <p className="text-sm text-muted-foreground">
                  Jump into the dashboard and see today&apos;s numbers.
                </p>
              </div>
              <Button render={<Link href="/dashboard" />} size="lg">
                Open dashboard
                <ArrowRight data-icon="inline-end" />
              </Button>
            </CardContent>
          </Card>
        </section>
      </main>

      <footer className="mx-auto w-full max-w-6xl px-6 py-6 text-center text-xs text-muted-foreground sm:text-left">
        Counter POS · Built with Next.js & Tailwind CSS
      </footer>
    </div>
  );
}
