import type { LoanRecord } from "./types";
import { installmentState, totals } from "./calculations";
import { dateLabel, todayPH } from "./dates";
import { moneyInput, pesos } from "./money";

export const exportAssumptions = [
  "Generated from user-entered information; not independently verified by any lender.",
  "Scheduled remaining equals saved installments less non-voided installment applications. Unapplied money is shown separately.",
  "No legal interest, late fees, daily accrual, prepayment rebate, or legal application of payments is inferred.",
  "Withheld deductions are already reflected in actual proceeds and are not added again. Separately paid upfront charges exclude charges inside installments.",
  "This is a personal record, not a lender-issued receipt, clearance, release, or verified settlement quote.",
];
export function csvCell(value: unknown): string {
  let str = value == null ? "" : String(value);
  // Mitigate spreadsheet formula injection, including a formula after whitespace.
  if (/^[\s\u0000-\u001f]*[=+@-]/.test(str) || /^[\t\r]/.test(str))
    str = "'" + str;
  return '"' + str.replaceAll('"', '""') + '"';
}
export function createCsv(l: LoanRecord, now = new Date()): string {
  const columns = [
    "record_type",
    "loan_id",
    "record_id",
    "date",
    "description",
    "amount_php",
    "scheduled_php",
    "applied_php",
    "remaining_scheduled_php",
    "unapplied_php",
    "principal_php",
    "interest_php",
    "fees_php",
    "status",
    "notes",
  ];
  type Row = Partial<Record<(typeof columns)[number], unknown>>;
  const rows: Row[] = [];
  const add = (row: Row) => rows.push({ loan_id: l.id, ...row });
  const summary = totals(l.installments, l.payments);
  add({
    record_type: "export",
    date: now.toISOString(),
    description: "LoanLens personal record",
    status: "user-entered",
    notes: exportAssumptions.join(" "),
  });
  add({
    record_type: "loan",
    record_id: l.id,
    date: l.disbursement_date,
    description: l.lender,
    amount_php: moneyInput(l.proceeds_centavos),
    scheduled_php: l.installments.length ? moneyInput(summary.scheduled) : "",
    applied_php: moneyInput(summary.applied),
    remaining_scheduled_php: l.installments.length
      ? moneyInput(summary.remaining)
      : "",
    unapplied_php: moneyInput(summary.unapplied),
    principal_php: moneyInput(l.principal_centavos),
    status: l.status,
    notes: JSON.stringify({
      withheld_php: moneyInput(l.withheld_centavos),
      separately_paid_upfront_php: moneyInput(l.upfront_paid_centavos),
      frequency: l.frequency,
      term_months: l.term_months,
      first_due_date: l.first_due_date,
      notes: l.notes,
      terms: l.loan_terms,
    }),
  });
  for (const i of [...l.installments].sort((a, b) => a.sequence - b.sequence)) {
    const state = installmentState(i, l.payments, todayPH(now));
    add({
      record_type: "installment",
      record_id: i.id,
      date: i.due_date,
      description: `Installment #${i.sequence}`,
      scheduled_php: moneyInput(i.amount_centavos),
      applied_php: moneyInput(state.paid),
      remaining_scheduled_php: moneyInput(state.remaining),
      status: state.status,
    });
  }
  for (const p of l.payments) {
    const applied = p.payment_allocations.reduce(
      (sum, a) => sum + a.amount_centavos,
      0,
    );
    add({
      record_type: "payment",
      record_id: p.id,
      date: p.paid_on,
      description: p.reference,
      amount_php: moneyInput(p.amount_centavos),
      applied_php: moneyInput(applied),
      unapplied_php: moneyInput(p.amount_centavos - applied),
      principal_php: moneyInput(p.principal_centavos),
      interest_php: moneyInput(p.interest_centavos),
      fees_php: moneyInput(p.fees_centavos),
      status: p.voided_at ? "voided" : "user-recorded",
      notes: JSON.stringify({
        notes: p.notes,
        void_reason: p.void_reason,
        voided_at: p.voided_at,
        created_at: p.created_at,
      }),
    });
    for (const a of p.payment_allocations)
      add({
        record_type: "application",
        record_id: p.id,
        date: p.paid_on,
        description: `To installment ${a.installment_id}`,
        applied_php: moneyInput(a.amount_centavos),
        status: p.voided_at ? "voided" : "recorded",
        notes:
          "Part of the payment row; do not sum again as a separate payment.",
      });
  }
  for (const d of l.documents)
    add({
      record_type: "document",
      record_id: d.id,
      date: d.created_at,
      description: d.filename,
      status: "user-provided",
      notes: JSON.stringify({
        payment_id: d.payment_id,
        mime_type: d.mime_type,
        size_bytes: d.size_bytes,
      }),
    });
  for (const h of l.correction_history)
    add({
      record_type: "correction",
      record_id: h.id,
      date: h.created_at,
      description: h.action,
      status: "history",
      notes: JSON.stringify({
        reason: h.reason,
        before: h.before_data,
        after: h.after_data,
      }),
    });
  return (
    "\uFEFF" +
    [
      columns.map(csvCell).join(","),
      ...rows.map((row) => columns.map((key) => csvCell(row[key])).join(",")),
    ].join("\r\n")
  );
}

export function recordText(
  l: LoanRecord,
  now = new Date(),
): { heading: string; lines: string[] }[] {
  const t = totals(l.installments, l.payments),
    today = todayPH(now),
    terms = l.loan_terms;
  return [
    {
      heading: "Personal loan summary",
      lines: [
        `Lender / label: ${l.lender}`,
        `Loan ID: ${l.id}`,
        `Status: ${l.status}`,
        `Exported: ${new Intl.DateTimeFormat("en-PH", { dateStyle: "long", timeStyle: "short", timeZone: "Asia/Manila" }).format(now)} (Philippine time)`,
        `Principal: ${pesos(l.principal_centavos)}`,
        `Cash actually received: ${pesos(l.proceeds_centavos)}`,
        `Withheld deductions (already reflected in proceeds): ${pesos(l.withheld_centavos)}`,
        `Upfront charges paid separately: ${pesos(l.upfront_paid_centavos)}`,
        `Disbursement: ${dateLabel(l.disbursement_date)} | First due: ${dateLabel(l.first_due_date)}`,
        `Frequency: ${l.frequency} | Entered term: ${l.term_months ?? "unknown"} months`,
        `Schedule: ${terms?.schedule_complete ? "user-confirmed complete" : "incomplete / unconfirmed"}`,
        `Saved schedule ${terms?.schedule_complete ? "total" : "subtotal"}: ${l.installments.length ? pesos(t.scheduled) : "unknown"}`,
        `Payments recorded (excluding voids): ${pesos(t.recorded)}`,
        `Applied to installments: ${pesos(t.applied)} | Unapplied money: ${pesos(t.unapplied)}`,
        `Remaining in saved schedule rows: ${l.installments.length ? pesos(t.remaining) : "unknown"} (not a settlement quote)`,
      ],
    },
    {
      heading: "Entered terms and notes",
      lines: [
        `Interest wording: ${terms?.interest_wording || "Unknown"}`,
        `Quoted rate: ${terms?.rate ?? "unknown"}% | Period: ${terms?.rate_period ?? "unknown"} | Method: ${terms?.calculation_method ?? "unknown"}`,
        `Penalty wording: ${terms?.penalty_wording || "Unknown"}`,
        `Prepayment terms: ${terms?.prepayment_terms || "Unknown"}`,
        `Mentions collateral: ${terms?.collateral ?? "unknown"} | Guaranty: ${terms?.guaranty ?? "unknown"} | Suretyship: ${terms?.suretyship ?? "unknown"}`,
        `Security wording / document references: ${terms?.security_notes || "None entered"}`,
        `Notes: ${l.notes || "None entered"}`,
      ],
    },
    {
      heading: "Saved repayment schedule",
      lines: [...l.installments]
        .sort((a, b) => a.sequence - b.sequence)
        .map((i) => {
          const s = installmentState(i, l.payments, today);
          return `#${i.sequence} | ${dateLabel(i.due_date)} | Scheduled ${pesos(i.amount_centavos)} | Applied ${pesos(s.paid)} | Remaining ${pesos(s.remaining)} | ${s.status}`;
        }),
    },
    {
      heading: "Payment-history statement",
      lines: l.payments.length
        ? [...l.payments]
            .sort((a, b) => a.paid_on.localeCompare(b.paid_on))
            .flatMap((p) => [
              `${dateLabel(p.paid_on)} | ${pesos(p.amount_centavos)} | ${p.voided_at ? "VOIDED - retained" : "USER RECORDED - not lender verified"}`,
              `Entry ${p.id} | Recorded ${p.created_at} | Reference: ${p.reference || "None"}`,
              `Known principal ${pesos(p.principal_centavos)} | Interest ${pesos(p.interest_centavos)} | Fees ${pesos(p.fees_centavos)}`,
              `Applications: ${p.payment_allocations.map((a) => `#${l.installments.find((i) => i.id === a.installment_id)?.sequence ?? "?"} ${pesos(a.amount_centavos)}`).join("; ") || "None"} | Unapplied: ${pesos(p.amount_centavos - p.payment_allocations.reduce((s, a) => s + a.amount_centavos, 0))}`,
              `Notes: ${p.notes || "None"}${p.void_reason ? ` | Correction: ${p.void_reason}` : ""}`,
            ])
        : ["No payments recorded."],
    },
    {
      heading: "Supporting document index",
      lines: l.documents.length
        ? l.documents.map(
            (d) =>
              `${d.filename} | ${d.mime_type} | ${d.size_bytes} bytes | Uploaded ${d.created_at} | ${d.payment_id ? `Payment ${d.payment_id}` : "General loan record"} | User-provided evidence`,
          )
        : ["No documents attached."],
    },
    {
      heading: "Correction history",
      lines: l.correction_history.length
        ? l.correction_history.map(
            (h) =>
              `${h.created_at} | ${h.action} | ${h.reason || "No reason entered"} | Event ${h.id}. Full before/after snapshots are available in the CSV export.`,
          )
        : ["No correction events."],
    },
    { heading: "Assumptions and scope", lines: exportAssumptions },
  ];
}
