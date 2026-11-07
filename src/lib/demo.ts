import { addMonths } from "./dates";
import type { LoanRecord, Installment } from "./types";
export const demoId = (n: number) =>
  `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
export function demoRecords(today: string): LoanRecord[] {
  const first = today.slice(0, 7) + "-15";
  const base = (
    n: number,
    lender: string,
    status: "active" | "offer",
    principal: number,
    proceeds: number,
    amount: number,
    count: number,
  ): LoanRecord => {
    const id = demoId(n);
    const installments: Installment[] = Array.from(
      { length: count },
      (_, i) => ({
        id: demoId(n * 100 + i),
        loan_id: id,
        sequence: i + 1,
        due_date: addMonths(first, i - (status === "active" ? 2 : 0)),
        amount_centavos: amount,
      }),
    );
    return {
      id,
      user_id: demoId(999),
      lender,
      status,
      principal_centavos: principal,
      proceeds_centavos: proceeds,
      withheld_centavos: principal - proceeds,
      upfront_paid_centavos: 0,
      disbursement_date: addMonths(first, status === "active" ? -3 : -1),
      first_due_date: installments[0].due_date,
      term_months: count,
      frequency: "monthly",
      notes:
        "FICTIONAL DEMO: created for presentation only. This lender and agreement are invented.",
      created_at: today + "T00:00:00Z",
      loan_terms: {
        loan_id: id,
        interest_wording:
          "Illustrative fixed total repayment in equal monthly installments.",
        rate: null,
        rate_period: "unknown",
        calculation_method: "other",
        penalty_wording: "Unknown; no penalty is calculated.",
        prepayment_terms: "Unknown; no rebate is assumed.",
        collateral: "no",
        guaranty: "unknown",
        suretyship: "no",
        security_notes: "Fictional example only.",
        schedule_complete: true,
      },
      installments,
      payments:
        status === "active"
          ? [
              {
                id: demoId(n + 500),
                loan_id: id,
                paid_on: today.slice(0, 7) + "-01",
                amount_centavos: amount + Math.round(amount / 2),
                reference: "DEMO-PAYMENT",
                notes:
                  "Fictional payment: one full and one partial installment.",
                principal_centavos: null,
                interest_centavos: null,
                fees_centavos: null,
                voided_at: null,
                void_reason: null,
                created_at: today + "T00:00:00Z",
                payment_allocations: [
                  {
                    installment_id: installments[0].id,
                    amount_centavos: amount,
                  },
                  {
                    installment_id: installments[1].id,
                    amount_centavos: Math.round(amount / 2),
                  },
                ],
              },
            ]
          : [],
      documents: [],
      correction_history: [],
    };
  };
  return [
    base(1, "Harbor Community · demo", "active", 5000000, 4850000, 470000, 12),
    base(2, "Bayan Cooperative · demo", "active", 2400000, 2400000, 430000, 6),
    base(3, "Cedar Finance · demo", "offer", 3000000, 2850000, 280000, 12),
    base(4, "Mango Lending · demo", "offer", 3000000, 3000000, 550000, 6),
    base(5, "Acacia Credit · demo", "offer", 3000000, 2940000, 345000, 10),
  ];
}
