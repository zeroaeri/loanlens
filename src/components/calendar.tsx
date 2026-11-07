"use client";
import { useState } from "react";
import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";
import type { LoanRecord } from "@/lib/types";
import { addDays, addMonths, dateLabel } from "@/lib/dates";
import { installmentState } from "@/lib/calculations";
import { pesos } from "@/lib/money";
import { PageHeading, Badge, Empty } from "./ui";
export function RepaymentCalendar({
  loans,
  today,
  demo = false,
}: {
  loans: LoanRecord[];
  today: string;
  demo?: boolean;
}) {
  const [month, setMonth] = useState(today.slice(0, 7) + "-01"),
    [view, setView] = useState<"month" | "list">("month"),
    [filter, setFilter] = useState("all");
  const active = loans.filter((l) => l.status === "active");
  const events = active
    .filter((l) => filter === "all" || filter === l.id)
    .flatMap((l) =>
      l.installments.map((i) => ({
        ...i,
        lender: l.lender,
        ...installmentState(i, l.payments, today),
      })),
    )
    .sort((a, b) => a.due_date.localeCompare(b.due_date));
  const visible = events.filter((i) =>
    i.due_date.startsWith(month.slice(0, 7)),
  );
  const offset = new Date(month + "T00:00:00Z").getUTCDay();
  const days = Array.from({ length: 42 }, (_, i) => addDays(month, i - offset));
  const monthName = new Intl.DateTimeFormat("en-PH", {
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(month + "T00:00:00Z"));
  const href = (id: string) => `${demo ? "/demo" : ""}/loans/${id}`;
  return (
    <>
      <PageHeading
        eyebrow="PLAN AROUND THE DATES"
        title="Your repayment calendar."
        description="Saved contractual installments across your active loans. Amounts below distinguish scheduled and unpaid portions."
      />
      <section className="card">
        <div className="calendar-toolbar">
          <div className="inline-fields" style={{ alignItems: "center" }}>
            <button
              aria-label="Previous month"
              className="icon-button"
              onClick={() => setMonth(addMonths(month, -1))}
              disabled={month <= "1901-01-01"}
            >
              <ChevronLeft size={16} />
            </button>
            <h2 style={{ minWidth: 160, fontSize: 19 }}>{monthName}</h2>
            <button
              aria-label="Next month"
              className="icon-button"
              onClick={() => setMonth(addMonths(month, 1))}
              disabled={month >= "2198-12-01"}
            >
              <ChevronRight size={16} />
            </button>
            <button
              className="button secondary small"
              onClick={() => setMonth(today.slice(0, 7) + "-01")}
            >
              Today
            </button>
          </div>
          <div className="segmented" aria-label="Calendar view">
            <button
              className={view === "month" ? "active" : ""}
              aria-pressed={view === "month"}
              onClick={() => setView("month")}
            >
              Month
            </button>
            <button
              className={view === "list" ? "active" : ""}
              aria-pressed={view === "list"}
              onClick={() => setView("list")}
            >
              List
            </button>
          </div>
        </div>
        <div className="inline-fields" style={{ marginBottom: 20 }}>
          <label className="field" style={{ maxWidth: 300 }}>
            <span>Show loans</span>
            <select value={filter} onChange={(e) => setFilter(e.target.value)}>
              <option value="all">All active loans</option>
              {active.map((l) => (
                <option key={l.id} value={l.id}>
                  {l.lender}
                </option>
              ))}
            </select>
          </label>
          <div style={{ fontSize: 11, paddingBottom: 10, color: "#7a8773" }}>
            {visible.length} installments ·{" "}
            {pesos(visible.reduce((s, i) => s + i.amount_centavos, 0))}{" "}
            scheduled · {pesos(visible.reduce((s, i) => s + i.remaining, 0))}{" "}
            unpaid
          </div>
        </div>
        {view === "month" ? (
          <div className="calendar-scroll">
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(7,1fr)",
                minWidth: 560,
              }}
            >
              {["SUN", "MON", "TUE", "WED", "THU", "FRI", "SAT"].map((d) => (
                <div className="calendar-weekday" key={d}>
                  {d}
                </div>
              ))}
            </div>
            <div className="calendar-grid">
              {days.map((day) => (
                <div
                  key={day}
                  className={`calendar-day ${day === today ? "today" : ""} ${!day.startsWith(month.slice(0, 7)) ? "outside" : ""}`}
                  aria-label={dateLabel(day)}
                >
                  <span>{Number(day.slice(8))}</span>
                  {events
                    .filter((i) => i.due_date === day)
                    .map((i) => (
                      <Link
                        className={`calendar-event ${i.status.includes("Overdue") ? "overdue" : ""}`}
                        key={i.id}
                        href={href(i.loan_id)}
                        title={`${i.lender}: ${pesos(i.amount_centavos)} scheduled; ${pesos(i.remaining)} unpaid; ${i.status}`}
                      >
                        <strong>{i.lender}</strong>
                        <small>{pesos(i.remaining)} unpaid</small>
                        <small>{i.status}</small>
                      </Link>
                    ))}
                </div>
              ))}
            </div>
          </div>
        ) : visible.length ? (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Loan</th>
                  <th className="num">Scheduled</th>
                  <th className="num">Applied</th>
                  <th className="num">Unpaid</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {visible.map((i) => (
                  <tr key={i.id}>
                    <td>{dateLabel(i.due_date)}</td>
                    <td>
                      <Link href={href(i.loan_id)}>{i.lender} ↗</Link>
                    </td>
                    <td className="num">{pesos(i.amount_centavos)}</td>
                    <td className="num">{pesos(i.paid)}</td>
                    <td className="num">{pesos(i.remaining)}</td>
                    <td>
                      <Badge
                        tone={
                          i.status.includes("Overdue")
                            ? "red"
                            : i.status === "Paid"
                              ? "green"
                              : "neutral"
                        }
                      >
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
            title="A quiet month."
            body="No saved installments for the selected month and loan filter."
          />
        )}
        <div className="legend">
          <span>Saved schedule / recorded applications</span>
          <span>Overdue unpaid portion</span>
        </div>
      </section>
      <div className="notice section-gap">
        Overdue means a saved due date is before today in the Philippines and an
        unpaid portion remains. No late fee, default status, or legal interest
        is inferred.
      </div>
    </>
  );
}
