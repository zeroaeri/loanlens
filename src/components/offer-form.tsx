"use client";
import { useState, useTransition, useRef } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Plus, Trash2, WandSparkles, ArrowLeft } from "lucide-react";
import { saveOffer } from "@/app/actions";
import { centavos, moneyInput, pesos } from "@/lib/money";
import { generateSchedule, type GeneratorInput } from "@/lib/calculations";
import type { LoanRecord } from "@/lib/types";
import { Field, Notice, Status } from "./ui";

type Row = { key: string; date: string; amount: string };
const text = (f: FormData, k: string) => String(f.get(k) ?? "").trim();
const nullableMoney = (f: FormData, k: string) =>
  text(f, k) === "" ? null : centavos(text(f, k));
export function OfferForm({ loan }: { loan?: LoanRecord }) {
  const router = useRouter(),
    formRef = useRef<HTMLFormElement>(null),
    errorRef = useRef<HTMLDivElement>(null);
  const [pending, start] = useTransition(),
    [message, setMessage] = useState("");
  const terms = loan?.loan_terms;
  const [rows, setRows] = useState<Row[]>(
    [...(loan?.installments ?? [])]
      .sort((a, b) => a.sequence - b.sequence)
      .map((i) => ({
        key: i.id,
        date: i.due_date,
        amount: moneyInput(i.amount_centavos),
      })),
  );
  const [generator, setGenerator] = useState<GeneratorInput>({
    method: "equal-total",
    total: "",
    principal: moneyInput(loan?.principal_centavos),
    rate: "",
    count: 12,
    firstDue: loan?.first_due_date ?? "",
    frequency: "monthly",
  });
  const [preview, setPreview] = useState<Row[] | null>(null),
    [generatorError, setGeneratorError] = useState("");
  const numberField = (
    name: string,
    label: string,
    value: number | null | undefined,
    hint?: string,
  ) => (
    <Field
      label={label}
      hint={hint ?? "Leave blank if unknown; enter 0 only if confirmed zero."}
    >
      <input
        name={name}
        inputMode="decimal"
        defaultValue={moneyInput(value)}
        placeholder="Unknown"
        pattern="[0-9]+(\.[0-9]{1,2})?"
      />
    </Field>
  );
  function updateRow(key: string, field: "date" | "amount", value: string) {
    setRows((old) =>
      old.map((r) => (r.key === key ? { ...r, [field]: value } : r)),
    );
  }
  function generate() {
    try {
      const r = generateSchedule(generator);
      setPreview(
        r.map((i, n) => ({
          key: String(n),
          date: i.due_date,
          amount: moneyInput(i.amount_centavos),
        })),
      );
      setGeneratorError("");
    } catch (e) {
      setGeneratorError((e as Error).message);
      setPreview(null);
    }
  }
  function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setMessage("");
    const f = new FormData(e.currentTarget),
      status =
        (e.nativeEvent as SubmitEvent).submitter?.getAttribute("value") ??
        "draft";
    try {
      const installments = rows
        .filter((r) => r.date || r.amount)
        .map((r) => ({
          due_date: r.date,
          amount_centavos: centavos(r.amount),
        }));
      const payload = {
        ...(loan ? { id: loan.id } : {}),
        lender: text(f, "lender"),
        status,
        principal_centavos: nullableMoney(f, "principal"),
        proceeds_centavos: nullableMoney(f, "proceeds"),
        withheld_centavos: nullableMoney(f, "withheld"),
        upfront_paid_centavos: nullableMoney(f, "upfront_paid"),
        disbursement_date: text(f, "disbursement") || null,
        first_due_date: text(f, "first_due") || null,
        term_months: text(f, "term") ? Number(text(f, "term")) : null,
        frequency: text(f, "frequency"),
        notes: text(f, "notes"),
        terms: {
          interest_wording: text(f, "interest_wording"),
          rate: text(f, "rate") || null,
          rate_period: text(f, "rate_period"),
          calculation_method: text(f, "method"),
          penalty_wording: text(f, "penalty_wording"),
          prepayment_terms: text(f, "prepayment_terms"),
          collateral: text(f, "collateral"),
          guaranty: text(f, "guaranty"),
          suretyship: text(f, "suretyship"),
          security_notes: text(f, "security_notes"),
          schedule_complete: f.get("schedule_complete") === "on",
        },
        installments,
      };
      start(async () => {
        const result = await saveOffer(payload);
        if (result.ok) {
          router.push(`/loans/${result.id}`);
          router.refresh();
        } else {
          setMessage(result.message);
          errorRef.current?.focus();
        }
      });
    } catch (error) {
      setMessage((error as Error).message);
      errorRef.current?.focus();
    }
  }
  return (
    <form ref={formRef} onSubmit={submit}>
      <Link className="text-link" href={loan ? `/loans/${loan.id}` : "/offers"}>
        <ArrowLeft size={14} />
        Back to records
      </Link>
      <div className="section-gap">
        <Notice>
          Enter the terms as you understand them. Blank amounts and dates mean
          unknown. You can save a draft with just a label. Educational
          explanations appear separately in the summary.
        </Notice>
      </div>
      <section className="card form-section section-gap">
        <div className="form-section-header">
          <span className="step-number">01</span>
          <div>
            <h2>The money you’re borrowing</h2>
            <p>Principal and the cash you actually receive can be different.</p>
          </div>
        </div>
        <div className="form-grid">
          <div className="full-width">
            <Field label="Lender name or offer label *">
              <input
                name="lender"
                required
                maxLength={120}
                defaultValue={loan?.lender}
                placeholder="e.g. Cooperative personal loan"
              />
            </Field>
          </div>
          {numberField(
            "principal",
            "Principal · PHP",
            loan?.principal_centavos,
          )}
          {numberField(
            "proceeds",
            "Cash actually received · PHP",
            loan?.proceeds_centavos,
            "Net cash received after withheld amounts. Enter it directly; we do not infer it.",
          )}
          {numberField(
            "withheld",
            "Deductions withheld from proceeds · PHP",
            loan?.withheld_centavos,
            "Already reflected in actual proceeds. Never added again to repayments.",
          )}
          {numberField(
            "upfront_paid",
            "Upfront charges paid separately · PHP",
            loan?.upfront_paid_centavos,
            "Only additional cash you pay out separately. Exclude withheld charges and any charge included in installments.",
          )}
          <Field label="Disbursement date">
            <input
              type="date"
              name="disbursement"
              min="1900-01-01"
              max="2199-12-31"
              defaultValue={loan?.disbursement_date ?? ""}
            />
          </Field>
          <Field
            label="Loan term · months"
            hint="Optional; schedule dates control the cash-flow comparison."
          >
            <input
              type="number"
              name="term"
              min={1}
              max={600}
              defaultValue={loan?.term_months ?? ""}
              placeholder="Unknown"
            />
          </Field>
        </div>
      </section>
      <section className="card form-section">
        <div className="form-section-header">
          <span className="step-number">02</span>
          <div>
            <h2>Interest and other terms</h2>
            <p>
              Record the wording first. A quoted rate alone cannot define the
              calculation.
            </p>
          </div>
        </div>
        <div className="form-grid">
          <div className="full-width">
            <Field
              label="Interest wording from the agreement"
              hint="Quote or describe the terms; leave blank if unavailable."
            >
              <textarea
                name="interest_wording"
                maxLength={5000}
                defaultValue={terms?.interest_wording}
                placeholder="e.g. 1.5% per month, add-on to the original principal"
              />
            </Field>
          </div>
          <Field
            label="Quoted rate · %"
            hint="Up to four decimal places. This is not an effective annual rate."
          >
            <input
              name="rate"
              inputMode="decimal"
              defaultValue={terms?.rate ?? ""}
              placeholder="Unknown"
            />
          </Field>
          <Field label="Rate period">
            <select
              name="rate_period"
              defaultValue={terms?.rate_period ?? "unknown"}
            >
              <option value="unknown">Unknown</option>
              <option value="month">Per month</option>
              <option value="year">Per year</option>
              <option value="week">Per week</option>
              <option value="installment">Per installment period</option>
              <option value="whole-term">Whole term</option>
            </select>
          </Field>
          <div className="full-width">
            <Field label="Calculation method, if stated">
              <select
                name="method"
                defaultValue={terms?.calculation_method ?? "unknown"}
              >
                <option value="unknown">Unknown / unclear</option>
                <option value="flat-add-on">Flat / add-on interest</option>
                <option value="reducing-balance">
                  Reducing balance (manual schedule only)
                </option>
                <option value="interest-free">Interest-free, as entered</option>
                <option value="other">Other / fixed scheduled amount</option>
              </select>
            </Field>
          </div>
          <Field label="Penalty wording">
            <textarea
              name="penalty_wording"
              maxLength={5000}
              defaultValue={terms?.penalty_wording}
              placeholder="Unknown — no penalty automatically imposed"
            />
          </Field>
          <Field label="Prepayment terms">
            <textarea
              name="prepayment_terms"
              maxLength={5000}
              defaultValue={terms?.prepayment_terms}
              placeholder="Unknown — no rebate or interest reduction assumed"
            />
          </Field>
        </div>
      </section>
      <section className="card form-section">
        <div className="form-section-header">
          <span className="step-number">03</span>
          <div>
            <h2>The repayment schedule</h2>
            <p>
              Enter the contractual dates and amounts, or generate a preview to
              review.
            </p>
          </div>
        </div>
        <div className="form-grid">
          <Field label="First due date">
            <input
              type="date"
              name="first_due"
              min="1900-01-01"
              max="2199-12-31"
              defaultValue={loan?.first_due_date ?? ""}
            />
          </Field>
          <Field label="Payment frequency">
            <select
              name="frequency"
              defaultValue={loan?.frequency ?? "unknown"}
            >
              <option value="unknown">Unknown</option>
              <option value="monthly">Monthly</option>
              <option value="weekly">Weekly</option>
              <option value="fortnightly">Every 14 days</option>
              <option value="irregular">Irregular / custom dates</option>
            </select>
          </Field>
        </div>
        <details className="section-gap">
          <summary className="text-link" style={{ cursor: "pointer" }}>
            <WandSparkles size={15} />
            Open schedule generator
          </summary>
          <div className="generator section-gap">
            <h3>A planning aid, reviewed by you.</h3>
            <p>
              Supported: split a known repayment total, or flat/add-on interest
              at a rate per installment period. Monthly dates preserve the
              original day and clamp to month-end. No reducing-balance,
              daily-accrual, penalty, or early-payment calculations.
            </p>
            <div className="form-grid">
              <Field label="Generator method">
                <select
                  value={generator.method}
                  onChange={(e) => {
                    setGenerator({
                      ...generator,
                      method: e.target.value as GeneratorInput["method"],
                    });
                    setPreview(null);
                  }}
                >
                  <option value="equal-total">
                    Split a known repayment total
                  </option>
                  <option value="flat-periodic">
                    Flat / add-on per installment period
                  </option>
                </select>
              </Field>
              {generator.method === "equal-total" ? (
                <Field label="Known repayment total · PHP">
                  <input
                    inputMode="decimal"
                    value={generator.total}
                    onChange={(e) =>
                      setGenerator({ ...generator, total: e.target.value })
                    }
                  />
                </Field>
              ) : (
                <>
                  <Field label="Principal for this calculation · PHP">
                    <input
                      inputMode="decimal"
                      value={generator.principal}
                      onChange={(e) =>
                        setGenerator({
                          ...generator,
                          principal: e.target.value,
                        })
                      }
                    />
                  </Field>
                  <Field
                    label="Rate per installment period · %"
                    hint="Match the installment frequency; no automatic annual/monthly conversion."
                  >
                    <input
                      inputMode="decimal"
                      value={generator.rate}
                      onChange={(e) =>
                        setGenerator({ ...generator, rate: e.target.value })
                      }
                    />
                  </Field>
                </>
              )}
              <Field label="Number of installments">
                <input
                  type="number"
                  min={1}
                  max={360}
                  value={generator.count}
                  onChange={(e) =>
                    setGenerator({
                      ...generator,
                      count: Number(e.target.value),
                    })
                  }
                />
              </Field>
              <Field label="First due date for generator">
                <input
                  type="date"
                  min="1900-01-01"
                  max="2199-12-31"
                  value={generator.firstDue}
                  onChange={(e) =>
                    setGenerator({ ...generator, firstDue: e.target.value })
                  }
                />
              </Field>
              <Field label="Generator frequency">
                <select
                  value={generator.frequency}
                  onChange={(e) =>
                    setGenerator({
                      ...generator,
                      frequency: e.target.value as GeneratorInput["frequency"],
                    })
                  }
                >
                  <option value="monthly">Monthly</option>
                  <option value="weekly">Weekly</option>
                  <option value="fortnightly">Every 14 days</option>
                </select>
              </Field>
            </div>
            <div className="form-actions section-gap">
              <button
                type="button"
                onClick={generate}
                className="button secondary"
              >
                Generate preview
              </button>
            </div>
            <Status message={generatorError} />
            {preview && (
              <div className="section-gap">
                <strong style={{ fontSize: 12 }}>
                  Preview · {preview.length} installments ·{" "}
                  {pesos(preview.reduce((s, r) => s + centavos(r.amount), 0))}{" "}
                  total
                </strong>
                <div
                  className="table-wrap"
                  style={{ maxHeight: 260, marginTop: 12 }}
                >
                  <table>
                    <thead>
                      <tr>
                        <th>Date</th>
                        <th className="num">Amount</th>
                      </tr>
                    </thead>
                    <tbody>
                      {preview.map((r, i) => (
                        <tr key={i}>
                          <td>{r.date}</td>
                          <td className="num">{pesos(centavos(r.amount))}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <p className="section-gap">
                  Review all dates and rounding. Interest is rounded once to a
                  centavo, then the total is split; any extra centavos go to the
                  earliest installments. Generator fields do not change the
                  entered contract terms.
                </p>
                <button
                  type="button"
                  className="button primary"
                  onClick={() => {
                    setRows(
                      preview.map((r) => ({ ...r, key: crypto.randomUUID() })),
                    );
                    setPreview(null);
                    const date = formRef.current?.elements.namedItem(
                      "first_due",
                    ) as HTMLInputElement;
                    const freq = formRef.current?.elements.namedItem(
                      "frequency",
                    ) as HTMLSelectElement;
                    if (date) date.value = preview[0].date;
                    if (freq) freq.value = generator.frequency;
                  }}
                >
                  Use reviewed preview · replaces rows below
                </button>
              </div>
            )}
          </div>
        </details>
        <div className="schedule-editor">
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>#</th>
                  <th>Due date</th>
                  <th>Amount · PHP</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {rows.map((r, i) => (
                  <tr key={r.key}>
                    <td>{i + 1}</td>
                    <td>
                      <input
                        className="table-input"
                        aria-label={`Installment ${i + 1} due date`}
                        type="date"
                        min="1900-01-01"
                        max="2199-12-31"
                        value={r.date}
                        onChange={(e) =>
                          updateRow(r.key, "date", e.target.value)
                        }
                      />
                    </td>
                    <td>
                      <input
                        className="table-input"
                        aria-label={`Installment ${i + 1} amount in pesos`}
                        inputMode="decimal"
                        value={r.amount}
                        onChange={(e) =>
                          updateRow(r.key, "amount", e.target.value)
                        }
                        placeholder="0.00"
                      />
                    </td>
                    <td>
                      <button
                        className="icon-button"
                        type="button"
                        aria-label={`Remove installment ${i + 1}`}
                        onClick={() =>
                          setRows((old) => old.filter((v) => v.key !== r.key))
                        }
                      >
                        <Trash2 size={15} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <button
            type="button"
            className="button secondary small section-gap"
            disabled={rows.length >= 360}
            onClick={() =>
              setRows((old) => [
                ...old,
                { key: crypto.randomUUID(), date: "", amount: "" },
              ])
            }
          >
            <Plus size={14} />
            Add installment
          </button>
        </div>
        <label className="checkbox section-gap">
          <input
            type="checkbox"
            name="schedule_complete"
            defaultChecked={terms?.schedule_complete ?? false}
          />
          <span>
            I reviewed every saved installment and confirm this is the complete
            schedule as entered. Activation freezes these terms and dates.
          </span>
        </label>
      </section>
      <section className="card form-section">
        <div className="form-section-header">
          <span className="step-number">04</span>
          <div>
            <h2>Security and your notes</h2>
            <p>
              Record what is mentioned. This does not determine its legal
              effect.
            </p>
          </div>
        </div>
        <div className="form-grid">
          {(["collateral", "guaranty", "suretyship"] as const).map((key) => (
            <Field key={key} label={`Does the agreement mention ${key}?`}>
              <select name={key} defaultValue={terms?.[key] ?? "unknown"}>
                <option value="unknown">Unknown / not reviewed</option>
                <option value="yes">Yes, mentioned</option>
                <option value="no">No, as reviewed</option>
              </select>
            </Field>
          ))}
          <div className="full-width">
            <Field label="Collateral / guaranty / suretyship wording or document references">
              <textarea
                name="security_notes"
                maxLength={5000}
                defaultValue={terms?.security_notes}
              />
            </Field>
          </div>
          <div className="full-width">
            <Field label="Other notes">
              <textarea
                name="notes"
                maxLength={5000}
                defaultValue={loan?.notes}
                placeholder="Missing details to ask the lender, known fee descriptions, or context"
              />
            </Field>
          </div>
        </div>
        <p className="warning-text">
          Supporting documents can be attached privately after saving. Selecting
          “yes” does not create a guaranty, suretyship, or registered security
          interest.
        </p>
      </section>
      <div tabIndex={-1} ref={errorRef}>
        <Status message={message} />
      </div>
      <div className="form-actions">
        <button
          type="submit"
          value="draft"
          className="button secondary"
          disabled={pending}
        >
          {pending ? "Saving…" : "Save incomplete draft"}
        </button>
        <button
          type="submit"
          value="offer"
          className="button primary"
          disabled={pending}
        >
          {pending ? "Saving…" : "Save offer & view summary"}
        </button>
      </div>
    </form>
  );
}
