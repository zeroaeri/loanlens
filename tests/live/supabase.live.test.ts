// Opt-in integration test. Creates labeled records in a dedicated TEST project.
// Nothing is deleted automatically: evidence/audit retention is part of the test.
import { it, expect } from "vitest";
import { createClient } from "@supabase/supabase-js";
it("isolates real REST records and private attachments between two authenticated accounts", async () => {
  const required = [
    "NEXT_PUBLIC_SUPABASE_URL",
    "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY",
    "LOANLENS_TEST_EMAIL_A",
    "LOANLENS_TEST_PASSWORD_A",
    "LOANLENS_TEST_EMAIL_B",
    "LOANLENS_TEST_PASSWORD_B",
  ];
  for (const key of required)
    if (!process.env[key])
      throw new Error(`Configure ${key} in .env.local for the opt-in test.`);
  if (process.env.LOANLENS_RUN_LIVE_TESTS !== "yes")
    throw new Error(
      "Set LOANLENS_RUN_LIVE_TESTS=yes for a disposable TEST project. This test creates labeled records and private evidence.",
    );
  const client = () =>
    createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
      { auth: { persistSession: false, autoRefreshToken: false } },
    );
  const a = client(),
    b = client();
  const sa = await a.auth.signInWithPassword({
    email: process.env.LOANLENS_TEST_EMAIL_A!,
    password: process.env.LOANLENS_TEST_PASSWORD_A!,
  });
  const sb = await b.auth.signInWithPassword({
    email: process.env.LOANLENS_TEST_EMAIL_B!,
    password: process.env.LOANLENS_TEST_PASSWORD_B!,
  });
  expect(sa.error).toBeNull();
  expect(sb.error).toBeNull();
  expect(sa.data.user!.id).not.toBe(sb.data.user!.id);
  const payload = {
    lender: `TEST ONLY - LoanLens isolation ${new Date().toISOString()}`,
    status: "offer",
    principal_centavos: 100000,
    proceeds_centavos: 95000,
    withheld_centavos: 5000,
    upfront_paid_centavos: 0,
    disbursement_date: "2020-01-01",
    first_due_date: "2020-02-01",
    term_months: 1,
    frequency: "monthly",
    notes: "Disposable integration-test record, not a real loan.",
    terms: {
      interest_wording: "Test only",
      rate: null,
      rate_period: "unknown",
      calculation_method: "other",
      penalty_wording: "",
      prepayment_terms: "",
      collateral: "unknown",
      guaranty: "unknown",
      suretyship: "unknown",
      security_notes: "",
      schedule_complete: true,
    },
    installments: [{ due_date: "2020-02-01", amount_centavos: 105000 }],
  };
  const saved = await a.rpc("save_offer", { payload });
  expect(saved.error).toBeNull();
  const id = saved.data as string;
  const own = await a
    .from("loans")
    .select(
      "*,loan_terms(*),installments(*),payments(*,payment_allocations(*)),documents(*),correction_history(*)",
    )
    .eq("id", id)
    .single();
  expect(own.error).toBeNull();
  expect(Array.isArray(own.data!.loan_terms)).toBe(false);
  expect(own.data!.loan_terms.schedule_complete).toBe(true);
  expect((await b.from("loans").select("*").eq("id", id)).data).toEqual([]);
  expect(
    (await b.rpc("save_offer", { payload: { ...payload, id } })).error,
  ).not.toBeNull();
  expect((await b.rpc("activate_loan", { lid: id })).error).not.toBeNull();
  expect((await a.rpc("activate_loan", { lid: id })).error).toBeNull();
  const payment = {
    request_id: crypto.randomUUID(),
    loan_id: id,
    paid_on: "2020-02-01",
    amount_centavos: 120000,
    reference: "TEST ONLY",
    notes: "Test overpayment",
    principal_centavos: null,
    interest_centavos: null,
    fees_centavos: null,
    allocations: [
      { installment_id: own.data!.installments[0].id, amount_centavos: 105000 },
    ],
  };
  expect(
    (await b.rpc("record_payment", { payload: payment })).error,
  ).not.toBeNull();
  const paid = await a.rpc("record_payment", { payload: payment });
  expect(paid.error).toBeNull();
  expect((await a.rpc("record_payment", { payload: payment })).data).toBe(
    paid.data,
  );
  const path = `${sa.data.user!.id}/${id}/${crypto.randomUUID()}.pdf`,
    bytes = new TextEncoder().encode(
      "%PDF-1.4\n% LoanLens fictional test evidence\n%%EOF",
    );
  expect(
    (
      await b.storage
        .from("loan-documents")
        .upload(path, bytes, { contentType: "application/pdf" })
    ).error,
  ).not.toBeNull();
  expect(
    (
      await a.storage
        .from("loan-documents")
        .upload(path, bytes, { contentType: "application/pdf" })
    ).error,
  ).toBeNull();
  const meta = await a.rpc("register_document", {
    payload: {
      loan_id: id,
      payment_id: paid.data,
      filename: "TEST-ONLY.pdf",
      object_path: path,
      mime_type: "application/pdf",
      size_bytes: bytes.byteLength,
    },
  });
  expect(meta.error).toBeNull();
  expect(
    (await b.from("documents").select("*").eq("id", meta.data)).data,
  ).toEqual([]);
  expect(
    (await b.storage.from("loan-documents").download(path)).error,
  ).not.toBeNull();
  expect(
    (await b.storage.from("loan-documents").createSignedUrl(path, 60)).error,
  ).not.toBeNull();
  const signed = await a.storage
    .from("loan-documents")
    .createSignedUrl(path, 60, { download: "TEST-ONLY.pdf" });
  expect(signed.error).toBeNull();
  expect((await fetch(signed.data!.signedUrl)).ok).toBe(true);
  expect(
    (
      await fetch(
        `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/loan-documents/${path}`,
      )
    ).ok,
  ).toBe(false);
  expect(
    (await a.storage.from("loan-documents").download(path)).error,
  ).toBeNull();
  expect(
    (await b.rpc("void_payment", { pid: paid.data, reason: "Wrong owner" }))
      .error,
  ).not.toBeNull();
  expect(
    (
      await a.rpc("void_payment", {
        pid: paid.data,
        reason: "TEST ONLY - correction check",
      })
    ).error,
  ).toBeNull();
  await a.auth.signOut();
  await b.auth.signOut();
});
