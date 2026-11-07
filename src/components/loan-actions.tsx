"use client";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { activateLoan, recordPayment, voidPayment } from "@/app/actions";
import { uploadDocument } from "@/app/document-actions";
import { centavos, moneyInput, pesos } from "@/lib/money";
import { dateLabel } from "@/lib/dates";
import { paidTo, suggestAllocations } from "@/lib/calculations";
import type { LoanRecord, Payment } from "@/lib/types";
import { Field, Notice, Status } from "./ui";

export function Activate({ id }: { id: string }) {
  const [confirmed, setConfirmed] = useState(false),
    [result, setResult] = useState<{ ok: boolean; message: string }>({
      ok: false,
      message: "",
    }),
    [pending, start] = useTransition();
  const router = useRouter();
  return (
    <div>
      <p style={{ fontSize: 12 }}>
        Activate when you have selected this offer. This freezes the entered
        terms and reviewed schedule; recording payments will not recalculate it.
      </p>
      <label className="checkbox section-gap">
        <input
          type="checkbox"
          checked={confirmed}
          onChange={(e) => setConfirmed(e.target.checked)}
        />
        <span>
          I reviewed the terms and complete schedule and want to start tracking
          this loan.
        </span>
      </label>
      <Status {...result} />
      <button
        disabled={!confirmed || pending}
        className="button primary section-gap"
        onClick={() =>
          start(async () => {
            const r = await activateLoan(id);
            setResult(r);
            if (r.ok) router.refresh();
          })
        }
      >
        {pending ? "Activating…" : "Activate this loan"}
      </button>
    </div>
  );
}
export function PaymentForm({
  loan,
  today,
}: {
  loan: LoanRecord;
  today: string;
}) {
  const [requestId, setRequestId] = useState(() => crypto.randomUUID());
  const router = useRouter(),
    [pending, start] = useTransition(),
    [amount, setAmount] = useState(""),
    [applications, setApplications] = useState<Record<string, string>>({}),
    [result, setResult] = useState({ ok: false, message: "" }),
    [formKey, setFormKey] = useState(0);
  let amountCents = 0;
  try {
    amountCents = centavos(amount);
  } catch {
    /* Invalid/empty input is shown on submit. */
  }
  let applied = 0;
  try {
    applied = Object.values(applications).reduce(
      (s, v) => s + (v ? centavos(v) : 0),
      0,
    );
  } catch {
    /* Server validation is authoritative. */
  }
  const schedule = [...loan.installments].sort(
    (a, b) => a.sequence - b.sequence,
  );
  function suggest() {
    try {
      const values = suggestAllocations(
        centavos(amount),
        schedule,
        loan.payments,
      );
      setApplications(
        Object.fromEntries(
          values.map((a) => [a.installment_id, moneyInput(a.amount_centavos)]),
        ),
      );
      setResult({
        ok: true,
        message:
          "Suggestion filled. Review each amount; this is recordkeeping, not a legal application determination.",
      });
    } catch (e) {
      setResult({ ok: false, message: (e as Error).message });
    }
  }
  function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    try {
      const optional = (key: string) =>
        String(f.get(key) ?? "").trim() ? centavos(String(f.get(key))) : null;
      const payload = {
        request_id: requestId,
        loan_id: loan.id,
        paid_on: String(f.get("paid_on")),
        amount_centavos: centavos(amount),
        reference: String(f.get("reference") ?? ""),
        notes: String(f.get("notes") ?? ""),
        principal_centavos: optional("principal"),
        interest_centavos: optional("interest"),
        fees_centavos: optional("fees"),
        allocations: Object.entries(applications)
          .filter(([, v]) => v && centavos(v) > 0)
          .map(([installment_id, v]) => ({
            installment_id,
            amount_centavos: centavos(v),
          })),
      };
      start(async () => {
        const r = await recordPayment(payload);
        setResult(r);
        if (r.ok) {
          setRequestId(crypto.randomUUID());
          setAmount("");
          setApplications({});
          setFormKey((k) => k + 1);
          router.refresh();
        }
      });
    } catch (e) {
      setResult({ ok: false, message: (e as Error).message });
    }
  }
  return (
    <form onSubmit={submit} key={formKey}>
      <Notice>
        Record an actual payment you made. Receipts are user-provided evidence;
        no lender acknowledgment is verified.
      </Notice>
      <div className="form-grid section-gap">
        <Field label="Payment date *">
          <input
            type="date"
            name="paid_on"
            required
            defaultValue={today}
            min={loan.disbursement_date ?? "1900-01-01"}
            max={today}
          />
        </Field>
        <Field label="Payment amount · PHP *">
          <input
            required
            inputMode="decimal"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            placeholder="0.00"
          />
        </Field>
        <Field label="Reference">
          <input
            name="reference"
            maxLength={160}
            placeholder="Transfer or receipt reference"
          />
        </Field>
        <Field label="Notes">
          <input name="notes" maxLength={5000} />
        </Field>
      </div>
      <details className="section-gap">
        <summary style={{ fontSize: 12, cursor: "pointer" }}>
          Known payment components · optional
        </summary>
        <p style={{ fontSize: 11, margin: "10px 0" }}>
          Leave blank when unknown. These components describe the payment and
          are not extra amounts on top of it.
        </p>
        <div className="form-grid">
          {["principal", "interest", "fees"].map((key) => (
            <Field
              label={`${key[0].toUpperCase() + key.slice(1)} · PHP`}
              key={key}
            >
              <input name={key} inputMode="decimal" placeholder="Unknown" />
            </Field>
          ))}
        </div>
      </details>
      <div className="section-gap">
        <div className="section-head">
          <div>
            <h3>Apply to installments</h3>
            <p>Choose what this entry covers. Unapplied money is retained.</p>
          </div>
          <button
            type="button"
            className="button secondary small"
            onClick={suggest}
          >
            Suggest earliest first
          </button>
        </div>
        <div className="allocation-grid">
          {schedule
            .filter((i) => i.amount_centavos > paidTo(i.id, loan.payments))
            .map((i) => (
              <label className="allocation-row" key={i.id}>
                <span>
                  #{i.sequence} · {dateLabel(i.due_date)}
                  <small style={{ display: "block", marginTop: 4 }}>
                    {pesos(i.amount_centavos - paidTo(i.id, loan.payments))}{" "}
                    remaining
                  </small>
                </span>
                <input
                  className="table-input"
                  inputMode="decimal"
                  aria-label={`Amount applied to installment ${i.sequence}`}
                  value={applications[i.id] ?? ""}
                  onChange={(e) =>
                    setApplications({ ...applications, [i.id]: e.target.value })
                  }
                  placeholder="0.00"
                />
              </label>
            ))}
        </div>
        <div className="notice">
          {pesos(applied)} applied · {pesos(amountCents - applied)} unapplied.
          An unapplied amount does not automatically pay future interest or
          create a rebate.
        </div>
        <label className="checkbox section-gap">
          <input type="checkbox" required />
          <span>
            I reviewed the date, amount, and installment applications. They
            reflect my payment record.
          </span>
        </label>
      </div>
      <Status {...result} />
      <button className="button primary section-gap" disabled={pending}>
        {pending ? "Recording…" : "Record payment"}
      </button>
    </form>
  );
}
export function VoidPayment({ payment }: { payment: Payment }) {
  const router = useRouter(),
    [reason, setReason] = useState(""),
    [pending, start] = useTransition(),
    [result, setResult] = useState({ ok: false, message: "" });
  if (payment.voided_at) return null;
  return (
    <details className="section-gap">
      <summary className="text-link" style={{ cursor: "pointer" }}>
        Correct this entry
      </summary>
      <p style={{ fontSize: 11, margin: "12px 0" }}>
        Void the original with a reason, then record a replacement if needed.
        The original amount, applications, and attachments stay in the history.
      </p>
      <Field label="Correction reason *">
        <input
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          minLength={3}
          maxLength={1000}
        />
      </Field>
      <Status {...result} />
      <button
        className="button danger small section-gap"
        disabled={pending || reason.trim().length < 3}
        onClick={() =>
          start(async () => {
            const r = await voidPayment(payment.id, payment.loan_id, reason);
            setResult(r);
            if (r.ok) router.refresh();
          })
        }
      >
        {pending ? "Saving correction…" : "Void entry & preserve original"}
      </button>
    </details>
  );
}
export function UploadForm({
  loanId,
  payments,
}: {
  loanId: string;
  payments: Payment[];
}) {
  const router = useRouter(),
    [pending, start] = useTransition(),
    [result, setResult] = useState({ ok: false, message: "" });
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        const f = new FormData(e.currentTarget);
        start(async () => {
          const r = await uploadDocument(f);
          setResult(r);
          if (r.ok) router.refresh();
        });
      }}
    >
      <input type="hidden" name="loan_id" value={loanId} />
      <Field
        label="Supporting file"
        hint="PDF, JPEG, or PNG · up to 4 MB · private storage"
      >
        <input
          name="file"
          type="file"
          required
          accept="application/pdf,image/png,image/jpeg"
        />
      </Field>
      <div className="section-gap">
        <Field label="Attach to">
          <select name="payment_id">
            <option value="">Loan / agreement generally</option>
            {payments.map((p) => (
              <option key={p.id} value={p.id}>
                {dateLabel(p.paid_on)} · {pesos(p.amount_centavos)}
                {p.voided_at ? " · voided" : ""}
              </option>
            ))}
          </select>
        </Field>
      </div>
      <Status {...result} />
      <button className="button secondary small section-gap" disabled={pending}>
        {pending ? "Uploading…" : "Attach private file"}
      </button>
    </form>
  );
}
