import { Suspense } from "react";
import { auth } from "@clerk/nextjs/server";
import { AppSidebar } from "@/components/app-sidebar";
import { Separator } from "@/components/ui/separator";
import {
  SidebarInset,
  SidebarProvider,
  SidebarTrigger,
} from "@/components/ui/sidebar";
import { Skeleton } from "@/components/ui/skeleton";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <SidebarProvider>
      {/* AppSidebar is a Client Component that reads usePathname() for active-link
          highlighting. Under Cache Components that runtime URL read must live
          inside a Suspense boundary so the rest of the shell can still prerender. */}
      <Suspense
        fallback={
          <Skeleton className="h-svh w-(--sidebar-width) shrink-0 rounded-none" />
        }
      >
        <AppSidebar />
      </Suspense>
      <SidebarInset>
        <header className="flex h-14 shrink-0 items-center gap-2 border-b border-border px-4">
          <SidebarTrigger className="-ml-1" />
          <Separator orientation="vertical" className="mr-1 h-4" />
          <span className="font-heading text-sm font-medium">Counter POS</span>
        </header>
        {/* auth.protect() reads cookies/headers, a runtime (dynamic) data access.
            Under Cache Components it must sit inside a Suspense boundary, otherwise
            it opts the entire /dashboard subtree out of prerendering. Gating the
            children here lets the shell above prerender while auth streams in. */}
        <Suspense fallback={<DashboardContentSkeleton />}>
          <AuthGate>{children}</AuthGate>
        </Suspense>
      </SidebarInset>
    </SidebarProvider>
  );
}

// Require a signed-in user for everything under /dashboard; unauthenticated
// visitors are redirected to the sign-in page. Isolated in its own async
// component so the cookie/header read stays behind the Suspense boundary above.
async function AuthGate({ children }: { children: React.ReactNode }) {
  await auth.protect();
  return children;
}

function DashboardContentSkeleton() {
  return (
    <div className="flex flex-1 flex-col gap-6 p-6">
      <Skeleton className="h-8 w-64" />
      <Skeleton className="h-full min-h-96 w-full rounded-xl" />
    </div>
  );
}
