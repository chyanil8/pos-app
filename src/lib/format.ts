// Display helpers. Prisma Decimal values arrive as Decimal objects (or strings
// over the wire); `Number(...)` coerces either safely for formatting and math.

const currencyFmt = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
});

export function formatCurrency(value: unknown): string {
  return currencyFmt.format(Number(value ?? 0));
}

export function formatNumber(value: unknown): string {
  return new Intl.NumberFormat("en-US").format(Number(value ?? 0));
}

const dateFmt = new Intl.DateTimeFormat("en-US", {
  dateStyle: "medium",
  timeStyle: "short",
});

export function formatDateTime(value: Date | string): string {
  return dateFmt.format(new Date(value));
}

const dateOnlyFmt = new Intl.DateTimeFormat("en-US", { dateStyle: "medium" });

export function formatDate(value: Date | string): string {
  return dateOnlyFmt.format(new Date(value));
}

// Human-readable labels for the schema enums used across the UI.
export function titleCase(value: string): string {
  return value
    .toLowerCase()
    .split("_")
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}
