"use client";
import { useState } from "react";
import Link from "next/link";
import { PageHeading, Notice, Empty, Badge } from "./ui";
import type { LoanRecord } from "@/lib/types";
import { totals, cashFlowDifference } from "@/lib/calculations";
import { pesos } from "@/lib/money";
import { dateLabel } from "@/lib/dates";

export function Comparison({
  loans,
  demo = false,
}: {
  loans: LoanRecord[];
  demo?: boolean;
}) {
  const offers = loans.filter((l) => l.status !== "active");
  const [selected, setSelected] = useState(offers.slice(0, 2).map((l) => l.id));
  const chosen = offers.filter((l) => selected.includes(l.id));
  const metrics: { label: string; get: (l: LoanRecord) => React.ReactNode }[] =
    [
      { label: "Principal", get: (l) => pesos(l.principal_centavos) },
      {
        label: "Cash actually received",
        get: (l) => (
          <strong className="value">{pesos(l.proceeds_centavos)}</strong>
        ),
      },
      {
        label: "Withheld deductions · already reflected in proceeds",
        get: (l) => pesos(l.withheld_centavos),
      },
      {
        label: "Separately paid upfront charges",
        get: (l) => pesos(l.upfront_paid_centavos),
      },
      {
        label: "Saved scheduled repayments",
        get: (l) => (
          <>
            {l.installments.length
              ? pesos(totals(l.installments, []).scheduled)
              : "Unknown"}
            <span className="table-sub">
              {l.loan_terms?.schedule_complete
                ? "Confirmed complete"
                : "Subtotal · incomplete/unconfirmed"}
            </span>
          </>
        ),
      },
      {
        label: "Net scheduled outflow above proceeds¹",
        get: (l) =>
          cashFlowDifference(l) == null
            ? "Insufficient terms"
            : pesos(cashFlowDifference(l)),
      },
      {
        label: "Frequency / installments",
        get: (l) => `${l.frequency} / ${l.installments.length || "unknown"}`,
      },
      {
        label: "Disbursement date",
        get: (l) => dateLabel(l.disbursement_date),
      },
      {
        label: "First → last scheduled date",
        get: (l) => {
          const sorted = [...l.installments].sort((a, b) =>
            a.due_date.localeCompare(b.due_date),
          );
          return sorted.length
            ? `${dateLabel(sorted[0].due_date)} → ${dateLabel(sorted.at(-1)!.due_date)}`
            : "Unknown";
        },
      },
      {
        label: "Entered term",
        get: (l) => (l.term_months ? `${l.term_months} months` : "Unknown"),
      },
      {
        label: "Interest wording · as entered",
        get: (l) => (
          <span className="prewrap">
            {l.loan_terms?.interest_wording || "Unknown"}
          </span>
        ),
      },
      {
        label: "Calculation method · as entered",
        get: (l) =>
          l.loan_terms?.calculation_method.replaceAll("-", " ") ?? "Unknown",
      },
      {
        label: "Penalty wording · not calculated",
        get: (l) => (
          <span className="prewrap">
            {l.loan_terms?.penalty_wording || "Unknown"}
          </span>
        ),
      },
      {
        label: "Prepayment terms · no rebate assumed",
        get: (l) => (
          <span className="prewrap">
            {l.loan_terms?.prepayment_terms || "Unknown"}
          </span>
        ),
      },
    ];
  return (
    <>
      <PageHeading
        eyebrow="BEFORE YOU COMMIT"
        title="Look at the whole picture."
        description="Compare two or three offers using your entered cash flows. There is no automatic “best” loan."
      />
      {offers.length < 2 ? (
        <section className="card">
          <Empty
            title="Two offers make a comparison."
            body="Save at least two offers or drafts, with actual proceeds and repayment dates when available."
            href={demo ? "/auth?mode=signup" : "/offers/new"}
            label="Add an offer"
          />
        </section>
      ) : (
        <>
          <div className="select-offers">
            {offers.map((l) => (
              <label className="offer-choice" key={l.id}>
                <input
                  type="checkbox"
                  checked={selected.includes(l.id)}
                  disabled={!selected.includes(l.id) && selected.length >= 3}
                  onChange={(e) =>
                    setSelected((old) =>
                      e.target.checked
                        ? [...old, l.id]
                        : old.filter((id) => id !== l.id),
                    )
                  }
                />
                {l.lender}
                <Badge>{l.status}</Badge>
              </label>
            ))}
          </div>
          {chosen.length < 2 ? (
            <Notice>Select two or three offers to compare.</Notice>
          ) : (
            <>
              <section className="card comparison-card">
                <div className="table-wrap">
                  <table className="comparison-table">
                    <thead>
                      <tr>
                        <th>Same questions. Clearer differences.</th>
                        {chosen.map((l) => (
                          <th key={l.id}>
                            <Link href={`${demo ? "/demo" : ""}/loans/${l.id}`}>
                              {l.lender} ↗
                            </Link>
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {metrics.map((m) => (
                        <tr key={m.label}>
                          <td>{m.label}</td>
                          {chosen.map((l) => (
                            <td key={l.id}>{m.get(l)}</td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </section>
              <Notice>
                ¹ Saved repayments + separately paid upfront charges − actual
                proceeds. Withheld charges are never added again. This is a
                cash-flow difference based on entered amounts, not an effective
                annual rate or a legally verified cost. It excludes unentered or
                contingent charges and assumes each saved installment is paid as
                scheduled.
              </Notice>
              <section className="card section-gap">
                <div className="section-head">
                  <div>
                    <h2>Cash-flow timeline</h2>
                    <p>
                      Each box is an actual entered date; spacing is not a time
                      scale. Upfront charges with unknown dates are shown above.
                    </p>
                  </div>
                </div>
                {chosen.map((l) => (
                  <div className="timeline-row" key={l.id}>
                    <h3 style={{ fontSize: 12 }}>{l.lender}</h3>
                    <div className="timeline-dates">
                      <div
                        className="timeline-node"
                        style={{ borderColor: "#176753" }}
                      >
                        <strong>+ {pesos(l.proceeds_centavos)}</strong>
                        <small>Cash received</small>
                        <small>{dateLabel(l.disbursement_date)}</small>
                      </div>
                      {[...l.installments]
                        .sort((a, b) => a.due_date.localeCompare(b.due_date))
                        .map((i) => (
                          <div className="timeline-node" key={i.id}>
                            <strong>− {pesos(i.amount_centavos)}</strong>
                            <small>Installment #{i.sequence}</small>
                            <small>{dateLabel(i.due_date)}</small>
                          </div>
                        ))}
                    </div>
                  </div>
                ))}
              </section>
              <section className="card section-gap">
                <h3>Things to ask before deciding</h3>
                <p style={{ fontSize: 12, marginTop: 12 }}>
                  Will you receive enough cash after deductions? Can you meet
                  the dates and payment sizes? Are fees fully captured, either
                  in the schedule or as separately paid charges? What happens if
                  you pay early or miss a payment? Unknown terms remain unknown
                  in this comparison.
                </p>
              </section>
            </>
          )}
        </>
      )}
    </>
  );
}
