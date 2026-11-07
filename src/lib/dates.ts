// ISO calendar dates are compared lexically; never parse them in the host timezone.
export function isDate(value: string): boolean {
  if (
    !/^\d{4}-\d{2}-\d{2}$/.test(value) ||
    value < "1900-01-01" ||
    value > "2199-12-31"
  )
    return false;
  const date = new Date(value + "T00:00:00Z");
  return (
    !Number.isNaN(date.valueOf()) && date.toISOString().slice(0, 10) === value
  );
}
export function todayPH(now = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Manila",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);
}
export function dateLabel(value: string | null | undefined): string {
  return value
    ? new Intl.DateTimeFormat("en-PH", {
        day: "numeric",
        month: "short",
        year: "numeric",
        timeZone: "UTC",
      }).format(new Date(value + "T00:00:00Z"))
    : "Unknown";
}
export function addMonths(value: string, months: number): string {
  if (!isDate(value)) throw new Error("Invalid calendar date.");
  const [year, month, day] = value.split("-").map(Number);
  const last = new Date(Date.UTC(year, month + months, 0)).getUTCDate();
  const result = new Date(
    Date.UTC(year, month - 1 + months, Math.min(day, last)),
  )
    .toISOString()
    .slice(0, 10);
  if (!isDate(result)) throw new Error("Generated date is outside 1900–2199.");
  return result;
}
export function addDays(value: string, days: number): string {
  if (!isDate(value)) throw new Error("Invalid calendar date.");
  const result = new Date(
    new Date(value + "T00:00:00Z").valueOf() + days * 86_400_000,
  )
    .toISOString()
    .slice(0, 10);
  if (!isDate(result)) throw new Error("Generated date is outside 1900–2199.");
  return result;
}
