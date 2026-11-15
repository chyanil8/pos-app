import { auth, currentUser } from "@clerk/nextjs/server";
import { UserRole } from "@/generated/prisma/enums";
import { prisma } from "@/lib/prisma";

// Bridges Clerk authentication to our domain `User` row. Clerk owns identity;
// every mutation that must be attributed to a person (e.g. Sale.createdById)
// needs the local row this resolves. Server-only — never import from a Client
// Component.

export type AppUser = {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  isActive: boolean;
};

// Roles permitted to ring up sales at the POS.
const SALE_ROLES: UserRole[] = [
  UserRole.OWNER,
  UserRole.MANAGER,
  UserRole.CASHIER,
];

// Roles permitted to void a completed sale (reverses inventory).
const VOID_ROLES: UserRole[] = [UserRole.OWNER, UserRole.MANAGER];

export function canSell(role: UserRole): boolean {
  return SALE_ROLES.includes(role);
}

export function canVoid(role: UserRole): boolean {
  return VOID_ROLES.includes(role);
}

function toAppUser(u: {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  isActive: boolean;
}): AppUser {
  return {
    id: u.id,
    name: u.name,
    email: u.email,
    role: u.role,
    isActive: u.isActive,
  };
}

// Resolves the signed-in Clerk user to a domain `User`, provisioning one on
// first sign-in. The upsert-by-email links a pre-existing (e.g. seeded) row to
// its Clerk account, or creates a new CASHIER. Returns null when there is no
// session or Clerk exposes no email to key on.
export async function getCurrentUser(): Promise<AppUser | null> {
  const { userId } = await auth();
  if (!userId) return null;

  const linked = await prisma.user.findUnique({ where: { clerkId: userId } });
  if (linked) return toAppUser(linked);

  const cu = await currentUser();
  const email =
    cu?.primaryEmailAddress?.emailAddress ??
    cu?.emailAddresses[0]?.emailAddress ??
    null;
  if (!email) return null;

  const name =
    [cu?.firstName, cu?.lastName].filter(Boolean).join(" ").trim() ||
    cu?.username ||
    email;

  const user = await prisma.user.upsert({
    where: { email },
    update: { clerkId: userId },
    create: { clerkId: userId, email, name, role: UserRole.CASHIER },
  });

  return toAppUser(user);
}
