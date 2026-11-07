import Link from "next/link";
import { ArrowLeft, Download, FileText, ExternalLink } from "lucide-react";
import { PageHeading, Badge, Notice, Empty } from "./ui";
import { Activate, PaymentForm, UploadForm, VoidPayment } from "./loan-actions";
import type { LoanRecord } from "@/lib/types";
import { pesos } from "@/lib/money";
import { dateLabel } from "@/lib/dates";
import { totals, installmentState } from "@/lib/calculations";
import { legalNotes } from "@/lib/education";

export function LoanDetail({
  loan: l,
  today,
  demo = false,
}: {
  loan: LoanRecord;
  today: string;
  demo?: boolean;
}) {
  const t = totals(l.installments, l.payments),
    terms = l.loan_terms,
    schedule = [...l.installments].sort((a, b) => a.sequence - b.sequence);
  const missing = [
    l.principal_centavos == null ? "Principal" : null,
    l.proceeds_centavos == null ? "Actual proceeds" : null,
    l.upfront_paid_centavos == null ? "Separately paid upfront charges" : null,
    !terms?.schedule_complete ? "Complete confirmed schedule" : null,
  ].filter(Boolean);
  return (
    <>
      <Link className="text-link" href={demo ? "/demo?view=offers" : "/offers"}>
        <ArrowLeft size={14} />
        All records
      </Link>
      <div className="section-gap">
        <PageHeading
          eyebrow="YOUR ENTERED LOAN RECORD"
          title={l.lender}
          description={`${l.frequency} payments · ${dateLabel(l.disbursement_date)} disbursement`}
          action={
            <Badge
              tone={
                l.status === "active"
                  ? "green"
                  : l.status === "draft"
                    ? "amber"
                    : "neutral"
              }
            >
              {l.status}
            </Badge>
          }
        />
      </div>
      <div className="detail-layout">
        <div className="stack">
          <section className="card">
            <div className="detail-heading">
              <h2>The offer, in plain view</h2>
              {!demo && l.status !== "active" && (
                <Link className="text-link" href={`/loans/${l.id}/edit`}>
                  Edit entered terms ↗
                </Link>
              )}
            </div>
            <div className="summary-grid">
              {[
                { label: "Principal", value: pesos(l.principal_centavos) },
                {
                  label: "Actual cash received",
                  value: pesos(l.proceeds_centavos),
                },
                {
                  label: "Withheld deductions",
                  value: pesos(l.withheld_centavos),
                },
                {
                  label: "Separately paid upfront",
                  value: pesos(l.upfront_paid_centavos),
                },
                {
                  label: terms?.schedule_complete
                    ? "Total saved repayments"
                    : "Saved schedule subtotal",
                  value: schedule.length ? pesos(t.scheduled) : "Unknown",
                },
                {
                  label: "Quoted rate",
                  value:
                    terms?.rate != null
                      ? `${terms.rate}% / ${terms.rate_period}`
                      : "Unknown",
                },
              ].map((v) => (
                <div className="summary-item" key={v.label}>
                  <span>{v.label}</span>
                  <strong>{v.value}</strong>
                </div>
              ))}
            </div>
            <Notice>
              Principal is the stated loan amount. Actual proceeds are the cash
              you receive. Withheld charges are already reflected in those
              proceeds; they are not added to repayments again.
            </Notice>
            {missing.length > 0 && (
              <p className="warning-text">
                Information still needed for a complete cash-flow picture:{" "}
                {missing.join(", ")}. No reliable settlement amount is
                calculated.
              </p>
            )}
            <dl className="terms-list section-gap">
              <div>
                <dt>Interest wording · entered terms</dt>
                <dd>{terms?.interest_wording || "Unknown"}</dd>
              </div>
              <div>
                <dt>Calculation method · entered terms</dt>
                <dd>
                  {terms?.calculation_method.replaceAll("-", " ") ?? "Unknown"}
                </dd>
              </div>
              <div>
                <dt>Penalty wording · entered terms</dt>
                <dd>
                  {terms?.penalty_wording || "Unknown; no penalty calculated."}
                </dd>
              </div>
              <div>
                <dt>Prepayment terms · entered terms</dt>
                <dd>
                  {terms?.prepayment_terms || "Unknown; no rebate assumed."}
                </dd>
              </div>
              <div>
                <dt>Term and first due date</dt>
                <dd>
                  {l.term_months ? `${l.term_months} months` : "Term unknown"} ·{" "}
                  {dateLabel(l.first_due_date)}
                </dd>
              </div>
              <div>
                <dt>Security mentioned · entered terms</dt>
                <dd>
                  Collateral: {terms?.collateral ?? "unknown"}
                  <br />
                  Guaranty: {terms?.guaranty ?? "unknown"}
                  <br />
                  Suretyship: {terms?.suretyship ?? "unknown"}
                </dd>
              </div>
              <div className="full-width">
                <dt>Security wording and references</dt>
                <dd>{terms?.security_notes || "None entered"}</dd>
              </div>
              <div className="full-width">
                <dt>Notes · user-entered</dt>
                <dd>{l.notes || "None entered"}</dd>
              </div>
            </dl>
          </section>
          <section className="card">
            <div className="section-head">
              <div>
                <h2>Saved repayment schedule</h2>
                <p>
                  {terms?.schedule_complete
                    ? "User-confirmed complete schedule"
                    : "Incomplete / unconfirmed schedule"}
                  . Payment entries never change these dates or amounts.
                </p>
              </div>
            </div>
            {schedule.length ? (
              <div className="table-wrap">
                <table>
                  <thead>
                    <tr>
                      <th># / due date</th>
                      <th className="num">Scheduled</th>
                      <th className="num">Applied</th>
                      <th className="num">Remaining</th>
                      <th>Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {schedule.map((i) => {
                      const s = installmentState(i, l.payments, today);
                      return (
                        <tr key={i.id}>
                          <td>
                            #{i.sequence}
                            <span className="table-sub">
                              {dateLabel(i.due_date)}
                            </span>
                          </td>
                          <td className="num">{pesos(i.amount_centavos)}</td>
                          <td className="num">{pesos(s.paid)}</td>
                          <td className="num">{pesos(s.remaining)}</td>
                          <td>
                            <Badge
                              tone={
                                s.status === "Paid"
                                  ? "green"
                                  : s.status.includes("Overdue")
                                    ? "red"
                                    : s.paid
                                      ? "amber"
                                      : "neutral"
                              }
                            >
                              {s.status}
                            </Badge>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            ) : (
              <Empty
                title="No installments entered yet."
                body="Add the dates and amounts you know, then confirm the complete schedule before activation."
              />
            )}
            {l.status === "active" && (
              <div className="notice section-gap">
                {pesos(t.remaining)} scheduled remaining · {pesos(t.recorded)}{" "}
                payments recorded · {pesos(t.unapplied)} unapplied. These are
                user records, not a lender’s settlement quote.
              </div>
            )}
          </section>
          {l.status === "active" && (
            <>
              <section className="card" id="record-payment">
                <h2>Record a payment</h2>
                <div className="section-gap">
                  {demo ? (
                    <Notice>
                      This is fictional, read-only presentation data. Create
                      your own workspace to record payments.
                    </Notice>
                  ) : (
                    <PaymentForm loan={l} today={today} />
                  )}
                </div>
              </section>
              <section className="card">
                <div className="section-head">
                  <div>
                    <h2>Payment history</h2>
                    <p>
                      User-recorded payments · lender acknowledgment not
                      verified.
                    </p>
                  </div>
                </div>
                {l.payments.length ? (
                  [...l.payments]
                    .sort((a, b) => b.created_at.localeCompare(a.created_at))
                    .map((p) => (
                      <article
                        key={p.id}
                        className={`card section-gap ${p.voided_at ? "voided" : ""}`}
                      >
                        <div className="detail-heading">
                          <div>
                            <strong className="payment-amount">
                              {pesos(p.amount_centavos)}
                            </strong>
                            <p style={{ fontSize: 11, marginTop: 6 }}>
                              {dateLabel(p.paid_on)} ·{" "}
                              {p.reference || "No reference"}
                            </p>
                          </div>
                          <Badge tone={p.voided_at ? "red" : "neutral"}>
                            {p.voided_at
                              ? "Voided · retained"
                              : "User recorded"}
                          </Badge>
                        </div>
                        <p style={{ fontSize: 11 }}>
                          Principal: {pesos(p.principal_centavos)} · Interest:{" "}
                          {pesos(p.interest_centavos)} · Fees:{" "}
                          {pesos(p.fees_centavos)}
                        </p>
                        <p style={{ fontSize: 11, marginTop: 8 }}>
                          Applied:{" "}
                          {pesos(
                            p.payment_allocations.reduce(
                              (s, a) => s + a.amount_centavos,
                              0,
                            ),
                          )}{" "}
                          · Unapplied:{" "}
                          {pesos(
                            p.amount_centavos -
                              p.payment_allocations.reduce(
                                (s, a) => s + a.amount_centavos,
                                0,
                              ),
                          )}
                        </p>
                        {p.payment_allocations.length > 0 && (
                          <p style={{ fontSize: 11, marginTop: 6 }}>
                            Applications:{" "}
                            {p.payment_allocations
                              .map(
                                (a) =>
                                  `#${schedule.find((i) => i.id === a.installment_id)?.sequence ?? "?"}: ${pesos(a.amount_centavos)}`,
                              )
                              .join(" · ")}
                          </p>
                        )}
                        {p.notes && (
                          <p
                            className="prewrap"
                            style={{ fontSize: 11, marginTop: 10 }}
                          >
                            {p.notes}
                          </p>
                        )}
                        {p.void_reason && (
                          <p className="warning-text">
                            Correction reason: {p.void_reason}
                          </p>
                        )}
                        {!demo && <VoidPayment payment={p} />}
                      </article>
                    ))
                ) : (
                  <Empty
                    title="Your payment history starts here."
                    body="Record a payment above, then attach a receipt privately. Partial and excess payments are preserved."
                  />
                )}
              </section>
            </>
          )}
        </div>
        <aside className="stack">
          {l.status !== "active" && (
            <section className="card">
              <h2 style={{ fontSize: 18, marginBottom: 15 }}>
                Ready to track this loan?
              </h2>
              {demo ? (
                <Notice>
                  Fictional offer. Sign in to create and activate your own
                  records.
                </Notice>
              ) : (
                <Activate id={l.id} />
              )}
            </section>
          )}
          <section className="card">
            <h2 style={{ fontSize: 18 }}>Your documents</h2>
            <p style={{ fontSize: 11, marginTop: 9 }}>
              Private uploads. Receipts are user-provided evidence, not
              independently verified lender acknowledgment.
            </p>
            {l.documents.length ? (
              <ul className="document-list">
                {l.documents.map((d) => (
                  <li key={d.id}>
                    <a
                      href={`/documents/${d.id}`}
                      target="_blank"
                      rel="noreferrer"
                    >
                      <FileText
                        size={13}
                        style={{ display: "inline", marginRight: 5 }}
                      />
                      {d.filename}
                    </a>
                    <small>
                      {Math.ceil(d.size_bytes / 1024)} KB ·{" "}
                      {d.payment_id ? "Payment evidence" : "Loan documentation"}
                    </small>
                  </li>
                ))}
              </ul>
            ) : (
              <p style={{ fontSize: 11, margin: "18px 0" }}>
                No documents attached.
              </p>
            )}
            {!demo && <UploadForm loanId={l.id} payments={l.payments} />}
          </section>
          <section className="card">
            <h2 style={{ fontSize: 18 }}>Take your records with you</h2>
            <p style={{ fontSize: 11, margin: "12px 0 16px" }}>
              A summary, schedule, payment history, and correction log based on
              your entries.
            </p>
            {demo ? (
              <Notice>
                Exports are available for your saved personal records.
              </Notice>
            ) : (
              <div className="stack" style={{ gap: 10 }}>
                <a
                  className="button secondary small"
                  href={`/loans/${l.id}/export?format=pdf`}
                >
                  <Download size={14} />
                  Download PDF record
                </a>
                <a
                  className="button secondary small"
                  href={`/loans/${l.id}/export?format=csv`}
                >
                  <Download size={14} />
                  Download CSV
                </a>
              </div>
            )}
          </section>
          <section className="card">
            <h2 style={{ fontSize: 18 }}>Terms, explained</h2>
            <p style={{ fontSize: 11, marginTop: 9 }}>
              Educational notes · separate from the entered terms.
            </p>
            {legalNotes.map((n) => (
              <details className="explanation" key={n.id}>
                <summary>{n.title}</summary>
                <p>{n.body}</p>
                <a href={n.url} target="_blank" rel="noreferrer">
                  {n.authority}{" "}
                  <ExternalLink size={10} style={{ display: "inline" }} />
                </a>
              </details>
            ))}
          </section>
          <section className="card">
            <h2 style={{ fontSize: 18 }}>Traceable history</h2>
            {l.correction_history.length ? (
              [...l.correction_history]
                .sort((a, b) => b.created_at.localeCompare(a.created_at))
                .map((h) => (
                  <div className="history-item" key={h.id}>
                    <strong>{h.action.replaceAll("_", " ")}</strong>
                    <small>
                      {new Intl.DateTimeFormat("en-PH", {
                        timeZone: "Asia/Manila",
                        dateStyle: "medium",
                        timeStyle: "short",
                      }).format(new Date(h.created_at))}{" "}
                      PH
                    </small>
                    {h.reason && <p className="prewrap">{h.reason}</p>}
                  </div>
                ))
            ) : (
              <p style={{ fontSize: 11, marginTop: 15 }}>
                {demo
                  ? "Fictional demo · no live audit events."
                  : "No history yet."}
              </p>
            )}
          </section>
        </aside>
      </div>
    </>
  );
}
