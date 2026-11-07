import { addDays, addMonths } from "./dates";
import { centavos, divideRounded, MAX_CENTAVOS, splitCentavos } from "./money";
import type { Installment, Payment, LoanRecord } from "./types";

export function paidTo(installmentId: string, payments: Payment[]): number {
  return payments
    .filter((p) => !p.voided_at)
    .flatMap((p) => p.payment_allocations)
    .filter((a) => a.installment_id === installmentId)
    .reduce((s, a) => s + a.amount_centavos, 0);
}
export function installmentState(
  i: Installment,
  payments: Payment[],
  today: string,
) {
  const paid = paidTo(i.id, payments),
    remaining = Math.max(0, i.amount_centavos - paid);
  return {
    paid,
    remaining,
    status:
      remaining === 0
        ? "Paid"
        : i.due_date < today
          ? paid > 0
            ? "Overdue · partial"
            : "Overdue"
          : paid > 0
            ? "Partially paid"
            : "Scheduled",
  };
}
export function totals(schedule: Installment[], payments: Payment[]) {
  const scheduled = schedule.reduce((s, i) => s + i.amount_centavos, 0);
  const recorded = payments
    .filter((p) => !p.voided_at)
    .reduce((s, p) => s + p.amount_centavos, 0);
  const applied = payments
    .filter((p) => !p.voided_at)
    .flatMap((p) => p.payment_allocations)
    .reduce((s, a) => s + a.amount_centavos, 0);
  return {
    scheduled,
    recorded,
    applied,
    unapplied: recorded - applied,
    remaining: Math.max(0, scheduled - applied),
  };
}
// Withheld charges are information about proceeds, never a second outgoing payment.
export function cashFlowDifference(loan: LoanRecord): number | null {
  if (
    !loan.loan_terms?.schedule_complete ||
    !loan.installments.length ||
    loan.proceeds_centavos == null ||
    loan.upfront_paid_centavos == null
  )
    return null;
  return (
    totals(loan.installments, []).scheduled +
    loan.upfront_paid_centavos -
    loan.proceeds_centavos
  );
}
export type ScheduleRow = { due_date: string; amount_centavos: number };
export interface GeneratorInput {
  principal: string;
  rate: string;
  count: number;
  firstDue: string;
  frequency: "monthly" | "weekly" | "fortnightly";
  method: "equal-total" | "flat-periodic";
  total: string;
}
export function generateSchedule(input: GeneratorInput): ScheduleRow[] {
  if (!Number.isInteger(input.count) || input.count < 1 || input.count > 360)
    throw new Error("Use 1–360 installments.");
  let total: number;
  if (input.method === "equal-total") total = centavos(input.total);
  else {
    const principal = centavos(input.principal);
    if (!/^\d{1,3}(\.\d{1,4})?$/.test(input.rate) || Number(input.rate) > 100)
      throw new Error(
        "Enter a rate from 0–100% with up to four decimal places.",
      );
    const [whole, fraction = ""] = input.rate.split(".");
    const rateUnits = BigInt(whole) * 10000n + BigInt(fraction.padEnd(4, "0"));
    // Flat/add-on: principal × rate per installment period × number of periods.
    const interest = divideRounded(
      BigInt(principal) * rateUnits * BigInt(input.count),
      1_000_000n,
    );
    total = principal + Number(interest);
  }
  if (total > MAX_CENTAVOS || total < input.count)
    throw new Error(
      "Total must cover at least one centavo per installment and remain within ₱1 billion.",
    );
  return splitCentavos(total, input.count).map((amount_centavos, i) => ({
    amount_centavos,
    due_date:
      input.frequency === "monthly"
        ? addMonths(input.firstDue, i)
        : addDays(input.firstDue, i * (input.frequency === "weekly" ? 7 : 14)),
  }));
}
// Merely a recordkeeping suggestion; the user reviews the allocation before saving.
export function suggestAllocations(
  amount: number,
  installments: Installment[],
  payments: Payment[],
): { installment_id: string; amount_centavos: number }[] {
  let left = amount;
  return [...installments]
    .sort(
      (a, b) => a.due_date.localeCompare(b.due_date) || a.sequence - b.sequence,
    )
    .flatMap((i) => {
      const allocated = Math.min(
        left,
        Math.max(0, i.amount_centavos - paidTo(i.id, payments)),
      );
      left -= allocated;
      return allocated
        ? [{ installment_id: i.id, amount_centavos: allocated }]
        : [];
    });
}
