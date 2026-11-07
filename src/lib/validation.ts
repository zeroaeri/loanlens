import { z } from "zod";
import { isDate } from "./dates";
import { MAX_CENTAVOS } from "./money";
const money = z.number().int().min(0).max(MAX_CENTAVOS);
const date = z.string().refine(isDate, "Use a valid date from 1900–2199.");
const text = z.string().trim().max(5000);
const flag = z.enum(["unknown", "yes", "no"]);
export const offerSchema = z
  .object({
    id: z.uuid().optional(),
    lender: z
      .string()
      .trim()
      .min(1, "Give this offer a lender or label.")
      .max(120),
    status: z.enum(["draft", "offer"]),
    principal_centavos: money.nullable(),
    proceeds_centavos: money.nullable(),
    withheld_centavos: money.nullable(),
    upfront_paid_centavos: money.nullable(),
    disbursement_date: date.nullable(),
    first_due_date: date.nullable(),
    term_months: z.number().int().min(1).max(600).nullable(),
    frequency: z.enum([
      "unknown",
      "monthly",
      "weekly",
      "fortnightly",
      "irregular",
    ]),
    notes: text,
    terms: z.object({
      interest_wording: text,
      rate: z
        .string()
        .regex(/^\d{1,3}(\.\d{1,4})?$/)
        .refine((v) => Number(v) <= 100)
        .nullable(),
      rate_period: z.enum([
        "unknown",
        "month",
        "year",
        "week",
        "installment",
        "whole-term",
      ]),
      calculation_method: z.enum([
        "unknown",
        "flat-add-on",
        "reducing-balance",
        "interest-free",
        "other",
      ]),
      penalty_wording: text,
      prepayment_terms: text,
      collateral: flag,
      guaranty: flag,
      suretyship: flag,
      security_notes: text,
      schedule_complete: z.boolean(),
    }),
    installments: z
      .array(z.object({ due_date: date, amount_centavos: money.positive() }))
      .max(360),
  })
  .superRefine((v, ctx) => {
    if (
      v.installments.some(
        (i) => v.disbursement_date && i.due_date < v.disbursement_date,
      )
    )
      ctx.addIssue({
        code: "custom",
        message: "An installment cannot precede disbursement.",
        path: ["installments"],
      });
    if (
      v.installments.length &&
      v.first_due_date &&
      [...v.installments].sort((a, b) =>
        a.due_date.localeCompare(b.due_date),
      )[0].due_date !== v.first_due_date
    )
      ctx.addIssue({
        code: "custom",
        message: "First due date must match the earliest installment.",
        path: ["first_due_date"],
      });
    if (v.terms.schedule_complete && !v.installments.length)
      ctx.addIssue({
        code: "custom",
        message: "Add installments before marking the schedule complete.",
        path: ["installments"],
      });
  });
export type OfferInput = z.infer<typeof offerSchema>;
export const paymentSchema = z
  .object({
    request_id: z.uuid(),
    loan_id: z.uuid(),
    paid_on: date,
    amount_centavos: money.positive(),
    reference: z.string().trim().max(160),
    notes: text,
    principal_centavos: money.nullable(),
    interest_centavos: money.nullable(),
    fees_centavos: money.nullable(),
    allocations: z
      .array(
        z.object({
          installment_id: z.uuid(),
          amount_centavos: money.positive(),
        }),
      )
      .max(360),
  })
  .superRefine((v, ctx) => {
    if (
      v.allocations.reduce((s, a) => s + a.amount_centavos, 0) >
      v.amount_centavos
    )
      ctx.addIssue({
        code: "custom",
        message: "Installment applications exceed the payment.",
        path: ["allocations"],
      });
    if (
      new Set(v.allocations.map((a) => a.installment_id)).size !==
      v.allocations.length
    )
      ctx.addIssue({
        code: "custom",
        message: "Apply to each installment only once.",
        path: ["allocations"],
      });
    if (
      [
        v.principal_centavos,
        v.interest_centavos,
        v.fees_centavos,
      ].reduce<number>((s, a) => s + (a ?? 0), 0) > v.amount_centavos
    )
      ctx.addIssue({
        code: "custom",
        message: "Known components exceed the payment.",
        path: ["amount_centavos"],
      });
  });
export type PaymentInput = z.infer<typeof paymentSchema>;
export type ActionResult = { ok: boolean; message: string; id?: string };
