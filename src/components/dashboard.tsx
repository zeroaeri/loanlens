import Link from "next/link";
import {
  Plus,
  ArrowUpRight,
  Wallet,
  CalendarDays,
  ReceiptText,
  Clock3,
  Check,
  Lightbulb,
} from "lucide-react";
import { installmentState, totals } from "@/lib/calculations";
import { dateLabel } from "@/lib/dates";
import { pesos } from "@/lib/money";
import type { LoanRecord } from "@/lib/types";
import { Badge, Empty, PageHeading } from "./ui";

export function RecordLink({
  loan,
  demo = false,
  children,
}: {
  loan: LoanRecord;
  demo?: boolean;
  children: React.ReactNode;
}) {
  return (
    <Link href={`${demo ? "/demo" : ""}/loans/${loan.id}`}>{children}</Link>
  );
}
export function Dashboard({
  loans,
  today,
  demo = false,
}: {
  loans: LoanRecord[];
  today: string;
  demo?: boolean;
}) {
  const active = loans.filter((l) => l.status === "active"),
    offers = loans.filter((l) => l.status !== "active");
  const installments = active
    .flatMap((l) =>
      l.installments.map((i) => ({
        ...i,
        lender: l.lender,
        loan: l,
        ...installmentState(i, l.payments, today),
      })),
    )
    .sort(
      (a, b) => a.due_date.localeCompare(b.due_date) || a.sequence - b.sequence,
    );
  const dueSoon = installments
    .filter((i) => i.remaining > 0 && i.due_date >= today)
    .slice(0, 4);
  const overdue = installments
    .filter((i) => i.remaining > 0 && i.due_date < today)
    .reduce((s, i) => s + i.remaining, 0);
  const scheduledRemaining = active.reduce(
    (s, l) => s + totals(l.installments, l.payments).remaining,
    0,
  );
  const paidThisMonth = active
    .flatMap((l) => l.payments)
    .filter((p) => !p.voided_at && p.paid_on.slice(0, 7) === today.slice(0, 7))
    .reduce((s, p) => s + p.amount_centavos, 0);
  const nextMonth = installments
    .filter((i) => i.due_date.slice(0, 7) === today.slice(0, 7))
    .reduce((s, i) => s + i.remaining, 0);
  const metrics = [
    {
      label: "Scheduled amount remaining",
      value: pesos(scheduledRemaining),
      note: "Saved installments less applied payments",
      icon: Wallet,
      emphasis: true,
    },
    {
      label: "Due this calendar month",
      value: pesos(nextMonth),
      note: "Unpaid schedule amounts · includes overdue",
      icon: CalendarDays,
    },
    {
      label: "Payments recorded this month",
      value: pesos(paidThisMonth),
      note: "Your dated entries · excludes voids",
      icon: ReceiptText,
    },
    {
      label: "Overdue scheduled amounts",
      value: pesos(overdue),
      note: "Unpaid portions due before today",
      icon: Clock3,
    },
  ];
  return (
    <>
      <PageHeading
        eyebrow="YOUR BORROWING, AT A GLANCE"
        title="A clearer view of your loans."
        description={`Here’s where things stand as of ${dateLabel(today)} · Philippine time.`}
        action={
          <Link
            href={demo ? "/auth?mode=signup" : "/offers/new"}
            className="button primary"
          >
            <Plus size={16} />
            Add an offer
          </Link>
        }
      />
      <div className="metric-grid">
        {metrics.map(({ label, value, note, icon: Icon, emphasis }) => (
          <article
            key={label}
            className={`card metric ${emphasis ? "emphasis" : ""}`}
          >
            <span className="metric-icon">
              <Icon size={16} />
            </span>
            <div className="metric-label">{label}</div>
            <div className="metric-value">{value}</div>
            <small>{note}</small>
          </article>
        ))}
      </div>
      <div className="dashboard-columns">
        <div>
          <section className="card">
            <div className="section-head">
              <div>
                <h2>
                  Your active loans{" "}
                  <span
                    style={{ color: "#9ba58f", fontSize: 13, marginLeft: 6 }}
                  >
                    {active.length.toString().padStart(2, "0")}
                  </span>
                </h2>
                <p>A snapshot of your saved repayment schedules.</p>
              </div>
              <Link
                className="text-link"
                href={demo ? "/demo?view=offers" : "/offers"}
              >
                View all records <ArrowUpRight size={14} />
              </Link>
            </div>
            {active.length ? (
              <div className="table-wrap">
                <table>
                  <thead>
                    <tr>
                      <th>Loan / lender</th>
                      <th className="num">Schedule remaining</th>
                      <th>Applied progress</th>
                      <th />
                    </tr>
                  </thead>
                  <tbody>
                    {active.map((l) => {
                      const t = totals(l.installments, l.payments);
                      const percent = t.scheduled
                        ? Math.round((t.applied / t.scheduled) * 100)
                        : 0;
                      return (
                        <tr key={l.id}>
                          <td>
                            <RecordLink loan={l} demo={demo}>
                              <span className="table-lender">{l.lender}</span>
                              <span className="table-sub">
                                {l.frequency} · {l.installments.length}{" "}
                                installments
                              </span>
                            </RecordLink>
                          </td>
                          <td className="num">
                            {pesos(t.remaining)}
                            <span className="table-sub">
                              of {pesos(t.scheduled)} scheduled
                            </span>
                          </td>
                          <td>
                            <div className="progress-track">
                              <div
                                className="progress-fill"
                                style={{ width: `${percent}%` }}
                              />
                            </div>
                            <div className="progress-label">
                              {percent}% applied to schedule
                            </div>
                          </td>
                          <td>
                            <RecordLink loan={l} demo={demo}>
                              <ArrowUpRight
                                aria-label={`Open ${l.lender}`}
                                size={16}
                              />
                            </RecordLink>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            ) : (
              <Empty
                title="Your first loan starts with an offer."
                body="Enter the terms you know, review the schedule, then activate it when you’re ready."
                href="/offers/new"
                label="Enter an offer"
              />
            )}
          </section>
          <section className="card upcoming-card">
            <div className="section-head">
              <div>
                <h2>Coming up next</h2>
                <p>Upcoming unpaid installments across your active loans.</p>
              </div>
              <Link
                href={demo ? "/demo?view=calendar" : "/calendar"}
                className="text-link"
              >
                Open calendar <ArrowUpRight size={14} />
              </Link>
            </div>
            {dueSoon.length ? (
              <div className="table-wrap">
                <table>
                  <thead>
                    <tr>
                      <th>Due date</th>
                      <th>Loan / lender</th>
                      <th className="num">Unpaid portion</th>
                      <th>Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {dueSoon.map((i) => (
                      <tr key={i.id}>
                        <td>
                          <div className="payment-date">
                            <span className="date-tile">
                              <small>
                                {new Intl.DateTimeFormat("en", {
                                  month: "short",
                                  timeZone: "UTC",
                                })
                                  .format(new Date(i.due_date + "T00:00Z"))
                                  .toUpperCase()}
                              </small>
                              {Number(i.due_date.slice(8))}
                            </span>
                            <span>{dateLabel(i.due_date)}</span>
                          </div>
                        </td>
                        <td>
                          <RecordLink loan={i.loan} demo={demo}>
                            {i.lender}
                          </RecordLink>
                        </td>
                        <td className="num">{pesos(i.remaining)}</td>
                        <td>
                          <Badge tone={i.paid ? "amber" : "neutral"}>
                            {i.status}
                          </Badge>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <Empty
                title="No upcoming installments."
                body="Your calendar will show upcoming unpaid amounts once you activate a loan with a schedule."
              />
            )}
          </section>
        </div>
        <aside className="dashboard-aside">
          <section className="card focus-card">
            <div className="focus-illustration" aria-hidden="true">
              <div className="abstract-sheet" />
              <div className="abstract-sheet front" />
              <div className="abstract-circle">
                <Check size={19} />
              </div>
            </div>
            <div className="eyebrow">BEFORE YOU BORROW</div>
            <h2>
              A rate tells only
              <br />
              part of the story.
            </h2>
            <p>
              Put offers side by side. Look at the money you receive, what
              you’ll pay, and when.
            </p>
            <Link
              href={demo ? "/demo?view=compare" : "/compare"}
              className="text-link"
            >
              Compare your offers <ArrowUpRight size={15} />
            </Link>
            <div className="mini-stats">
              <div>
                <strong>
                  {offers
                    .filter((l) => l.status === "offer")
                    .length.toString()
                    .padStart(2, "0")}
                </strong>
                <small>Saved offers</small>
              </div>
              <div>
                <strong>
                  {offers
                    .filter((l) => l.status === "draft")
                    .length.toString()
                    .padStart(2, "0")}
                </strong>
                <small>Drafts to finish</small>
              </div>
            </div>
          </section>
          <section className="card sidebar-insight">
            <div className="insight-heading">
              <Lightbulb size={17} /> A note on your numbers
            </div>
            <p>
              Schedule remaining is a recordkeeping figure based on your saved
              installments and applied payments.
            </p>
            <p>
              A lender’s settlement quote may differ because of unentered terms,
              charges, or adjustments.
            </p>
            <Link href="/learn#payment" className="text-link">
              Understand the difference <ArrowUpRight size={13} />
            </Link>
          </section>
        </aside>
      </div>
    </>
  );
}
export function RecordsList({
  loans,
  demo = false,
}: {
  loans: LoanRecord[];
  demo?: boolean;
}) {
  return (
    <>
      <PageHeading
        eyebrow="YOUR PERSONAL RECORDS"
        title="Every loan, in one place."
        description="Draft an offer, review the terms, then activate its repayment schedule."
        action={
          <Link
            className="button primary"
            href={demo ? "/auth?mode=signup" : "/offers/new"}
          >
            <Plus size={16} />
            Add an offer
          </Link>
        }
      />
      <section className="card">
        {loans.length ? (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Lender / label</th>
                  <th>Status</th>
                  <th className="num">Principal</th>
                  <th className="num">Actual proceeds</th>
                  <th className="num">Saved schedule total</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {loans.map((l) => (
                  <tr key={l.id}>
                    <td>
                      <RecordLink loan={l} demo={demo}>
                        <strong>{l.lender}</strong>
                        <span className="table-sub">
                          {l.installments.length} installments · {l.frequency}
                        </span>
                      </RecordLink>
                    </td>
                    <td>
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
                    </td>
                    <td className="num">{pesos(l.principal_centavos)}</td>
                    <td className="num">{pesos(l.proceeds_centavos)}</td>
                    <td className="num">
                      {l.installments.length
                        ? pesos(totals(l.installments, l.payments).scheduled)
                        : "Unknown"}
                      <span className="table-sub">
                        {l.loan_terms?.schedule_complete
                          ? "Confirmed complete"
                          : "Incomplete / unconfirmed"}
                      </span>
                    </td>
                    <td>
                      <RecordLink loan={l} demo={demo}>
                        <ArrowUpRight
                          size={16}
                          aria-label={`Open ${l.lender}`}
                        />
                      </RecordLink>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <Empty
            title="Let’s bring your first offer into focus."
            body="Only a lender or label is required to save a draft. Leave anything you don’t know blank."
            href="/offers/new"
            label="Add your first offer"
          />
        )}
      </section>
    </>
  );
}
