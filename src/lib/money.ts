// All persisted amounts are integer centavos; decimal input is parsed as text.
export const MAX_CENTAVOS = 100_000_000_000; // ₱1 billion per amount
export function centavos(input: string): number {
  const value = input.trim();
  if (!/^\d{1,10}(\.\d{1,2})?$/.test(value))
    throw new Error(
      "Enter pesos with up to two decimal places, without commas.",
    );
  const [whole, fraction = ""] = value.split(".");
  const result = Number(BigInt(whole) * 100n + BigInt(fraction.padEnd(2, "0")));
  if (result > MAX_CENTAVOS)
    throw new Error("Amount exceeds the ₱1 billion limit.");
  return result;
}
export function pesos(value: number | null | undefined): string {
  return value == null
    ? "Unknown"
    : new Intl.NumberFormat("en-PH", {
        style: "currency",
        currency: "PHP",
      }).format(value / 100);
}
export function moneyInput(value: number | null | undefined): string {
  return value == null ? "" : (value / 100).toFixed(2);
}
export function divideRounded(numerator: bigint, denominator: bigint): bigint {
  if (numerator < 0n || denominator <= 0n)
    throw new Error(
      "Expected non-negative numerator and positive denominator.",
    );
  return (numerator + denominator / 2n) / denominator;
}
export function splitCentavos(total: number, count: number): number[] {
  if (
    !Number.isSafeInteger(total) ||
    total < 0 ||
    !Number.isInteger(count) ||
    count < 1
  )
    throw new Error("Invalid installment split.");
  const base = Math.floor(total / count),
    extra = total % count;
  return Array.from({ length: count }, (_, i) => base + (i < extra ? 1 : 0));
}
