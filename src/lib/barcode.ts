// Deterministic EAN-13 barcodes derived from a product SKU. Keeping the mapping
// a pure function of the SKU means the seed and any backfill produce identical,
// collision-free codes for the same catalog without coordinating state.

// 2-digit code per SKU prefix; unknown prefixes fall back to "90".
const PREFIX_CODE: Record<string, string> = {
  BEV: "10",
  SNK: "20",
  HSE: "30",
  PER: "40",
  ELC: "50",
};

// Appends the EAN-13 check digit to a 12-digit base. Weights alternate 1,3 from
// the left; the check digit rounds the weighted sum up to the next multiple of 10.
function withCheckDigit(base12: string): string {
  const sum = base12
    .split("")
    .reduce((acc, ch, i) => acc + Number(ch) * (i % 2 === 0 ? 1 : 3), 0);
  const check = (10 - (sum % 10)) % 10;
  return base12 + String(check);
}

// Maps "BEV-001" → a stable 13-digit EAN-13. Prefix selects a 2-digit group,
// the numeric part becomes the item code, and the rest is zero-padded.
export function skuToBarcode(sku: string): string {
  const [prefix, num = ""] = sku.split("-");
  const group = PREFIX_CODE[prefix] ?? "90";
  const item = num.replace(/\D/g, "").padStart(3, "0").slice(-3);
  const base12 = `20${group}${item}`.padEnd(12, "0");
  return withCheckDigit(base12);
}
