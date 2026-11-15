// Decimal-safe money math. All arithmetic is done in integer cents to avoid
// binary floating-point drift, then converted to fixed(2) strings at the Prisma
// boundary (the Decimal(12,2) columns accept strings losslessly).

export function toCents(value: number | string): number {
  return Math.round(Number(value) * 100);
}

export function centsToNumber(cents: number): number {
  return cents / 100;
}

// Prisma Decimal columns accept a fixed-precision string without float coercion.
export function centsToDecimalString(cents: number): string {
  return (cents / 100).toFixed(2);
}
