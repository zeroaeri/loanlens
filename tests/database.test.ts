import { beforeAll, afterAll, describe, it, expect } from "vitest";
import { PGlite } from "@electric-sql/pglite";
import { readFile, readdir } from "node:fs/promises";
const alice = "11111111-1111-4111-8111-111111111111",
  bob = "22222222-2222-4222-8222-222222222222";
let db: PGlite;
async function asUser(id: string) {
  await db.exec("reset role; set role authenticated;");
  await db.query("select set_config('request.jwt.claim.sub',$1,false)", [id]);
}
function offer(extra: Record<string, unknown> = {}) {
  return {
    lender: "Test lender",
    status: "offer",
    principal_centavos: 10000,
    proceeds_centavos: 9500,
    withheld_centavos: 500,
    upfront_paid_centavos: 0,
    disbursement_date: "2020-01-01",
    first_due_date: "2020-02-01",
    term_months: 2,
    frequency: "monthly",
    notes: "",
    terms: {
      interest_wording: "",
      rate: null,
      rate_period: "unknown",
      calculation_method: "unknown",
      penalty_wording: "",
      prepayment_terms: "",
      collateral: "unknown",
      guaranty: "unknown",
      suretyship: "unknown",
      security_notes: "",
      schedule_complete: true,
    },
    installments: [
      { due_date: "2020-02-01", amount_centavos: 6000 },
      { due_date: "2020-03-01", amount_centavos: 6000 },
    ],
    ...extra,
  };
}
async function save(extra: Record<string, unknown> = {}) {
  const r = await db.query<{ id: string }>(
    "select public.save_offer($1::jsonb) as id",
    [JSON.stringify(offer(extra))],
  );
  return r.rows[0].id;
}
async function active() {
  await asUser(alice);
  const id = await save();
  await db.query("select public.activate_loan($1)", [id]);
  return id;
}
async function pay(id: string, amount: number, allocations: unknown[] = []) {
  return db.query<{ id: string }>(
    "select public.record_payment($1::jsonb) as id",
    [
      JSON.stringify({
        request_id: crypto.randomUUID(),
        loan_id: id,
        paid_on: "2020-02-01",
        amount_centavos: amount,
        reference: "x",
        notes: "",
        principal_centavos: null,
        interest_centavos: null,
        fees_centavos: null,
        allocations,
      }),
    ],
  );
}
beforeAll(async () => {
  db = new PGlite();
  // Minimal platform schemas only. Financial tables, functions and RLS use the real migration unchanged.
  await db.exec(`create role anon;create role authenticated;create schema auth;create schema storage;
 create table auth.users(id uuid primary key);
 create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
 create table storage.buckets(id text primary key,name text,public boolean,file_size_limit bigint,allowed_mime_types text[]);
 create table storage.objects(id uuid primary key default gen_random_uuid(),bucket_id text,name text unique);
 alter table storage.objects enable row level security;
 grant usage on schema public,auth,storage to authenticated,anon;
 grant select,insert,delete on storage.objects to authenticated;`);
  const migrations = (await readdir("supabase/migrations"))
    .filter((name) => name.endsWith(".sql"))
    .sort();
  for (const name of migrations) {
    await db.exec(await readFile(`supabase/migrations/${name}`, "utf8"));
  }
  await db.query("insert into auth.users(id) values($1),($2)", [alice, bob]);
}, 30000);
afterAll(async () => {
  await db?.close();
});
describe("real PostgreSQL migration: ownership, transactions and immutable records", () => {
  it("makes exact payment retries idempotent and rejects a changed reused request", async () => {
    const id = await active();
    const payload = {
      request_id: crypto.randomUUID(),
      loan_id: id,
      paid_on: "2020-02-01",
      amount_centavos: 500,
      reference: "retry",
      notes: "",
      principal_centavos: null,
      interest_centavos: null,
      fees_centavos: null,
      allocations: [],
    };
    const call = (p: unknown) =>
      db.query<{ id: string }>(
        "select public.record_payment($1::jsonb) as id",
        [JSON.stringify(p)],
      );
    const a = await call(payload),
      b = await call(payload);
    expect(a.rows[0].id).toBe(b.rows[0].id);
    expect(
      (await db.query("select * from public.payments where loan_id=$1", [id]))
        .rows,
    ).toHaveLength(1);
    await expect(call({ ...payload, amount_centavos: 600 })).rejects.toThrow(
      "different values",
    );
  });
  it("creates an owner profile automatically and denies another user access", async () => {
    await asUser(alice);
    expect((await db.query("select * from public.profiles")).rows).toHaveLength(
      1,
    );
    await db.query(
      "update public.profiles set display_name='Alice' where id=$1",
      [bob],
    );
    await asUser(bob);
    expect(
      (
        await db.query<{ display_name: string }>(
          "select display_name from public.profiles",
        )
      ).rows[0].display_name,
    ).toBe("");
  });
  it("hides all child tables and denies cross-account writes via RPC", async () => {
    await asUser(alice);
    const id = await save();
    await asUser(bob);
    for (const table of [
      "loans",
      "loan_terms",
      "installments",
      "payments",
      "payment_allocations",
      "documents",
      "correction_history",
    ]) {
      const col = table === "loans" ? "id" : "loan_id";
      expect(
        (await db.query(`select * from public.${table} where ${col}=$1`, [id]))
          .rows,
      ).toHaveLength(0);
    }
    await expect(save({ id, lender: "hijacked" })).rejects.toThrow(
      "Record unavailable",
    );
    await expect(
      db.query("select public.activate_loan($1)", [id]),
    ).rejects.toThrow("unavailable");
  });
  it("blocks direct financial writes and history tampering", async () => {
    await asUser(alice);
    const id = await save();
    await expect(
      db.query("update public.loans set status='active' where id=$1", [id]),
    ).rejects.toThrow("permission denied");
    await expect(
      db.query("delete from public.correction_history where loan_id=$1", [id]),
    ).rejects.toThrow("permission denied");
  });
  it("rejects activation without complete terms and freezes active schedules", async () => {
    await asUser(alice);
    const incomplete = await save({ proceeds_centavos: null });
    await expect(
      db.query("select public.activate_loan($1)", [incomplete]),
    ).rejects.toThrow("required");
    const id = await active();
    await expect(save({ id })).rejects.toThrow("frozen");
  });
  it("supports partial application and keeps excess payment unapplied", async () => {
    const id = await active();
    const { rows } = await db.query<{ id: string }>(
      "select id from public.installments where loan_id=$1 order by sequence",
      [id],
    );
    await pay(id, 3000, [
      { installment_id: rows[0].id, amount_centavos: 3000 },
    ]);
    await pay(id, 10000, [
      { installment_id: rows[0].id, amount_centavos: 3000 },
      { installment_id: rows[1].id, amount_centavos: 6000 },
    ]);
    const result = await db.query<{ paid: string; applied: string }>(
      `select (select sum(amount_centavos) from public.payments where loan_id=$1) as paid,(select sum(amount_centavos) from public.payment_allocations where loan_id=$1) as applied`,
      [id],
    );
    expect(Number(result.rows[0].paid) - Number(result.rows[0].applied)).toBe(
      1000,
    );
  });
  it("rolls back an entire payment and audit event when any allocation is invalid", async () => {
    const id = await active();
    const { rows } = await db.query<{ id: string }>(
      "select id from public.installments where loan_id=$1 order by sequence",
      [id],
    );
    await expect(
      pay(id, 1000, [{ installment_id: rows[0].id, amount_centavos: 2000 }]),
    ).rejects.toThrow("exceed");
    expect(
      (await db.query("select * from public.payments where loan_id=$1", [id]))
        .rows,
    ).toHaveLength(0);
    expect(
      (
        await db.query(
          "select * from public.correction_history where loan_id=$1 and action='payment_recorded'",
          [id],
        )
      ).rows,
    ).toHaveLength(0);
    await expect(
      pay(id, 10000, [{ installment_id: rows[0].id, amount_centavos: 7000 }]),
    ).rejects.toThrow("exceeds installment");
  });
  it("rejects cross-loan and cross-owner applications even with a known UUID", async () => {
    const id = await active();
    await asUser(bob);
    const other = await save();
    const { rows } = await db.query<{ id: string }>(
      "select id from public.installments where loan_id=$1",
      [other],
    );
    await asUser(alice);
    await expect(
      pay(id, 1000, [{ installment_id: rows[0].id, amount_centavos: 1000 }]),
    ).rejects.toThrow("Installment unavailable");
    await asUser(bob);
    await expect(pay(id, 1000)).rejects.toThrow("Active loan unavailable");
  });
  it("voids without deleting and releases application capacity for a replacement", async () => {
    const id = await active();
    const { rows } = await db.query<{ id: string }>(
      "select id from public.installments where loan_id=$1 order by sequence",
      [id],
    );
    const p = await pay(id, 6000, [
      { installment_id: rows[0].id, amount_centavos: 6000 },
    ]);
    await expect(
      pay(id, 1, [{ installment_id: rows[0].id, amount_centavos: 1 }]),
    ).rejects.toThrow("exceeds");
    await asUser(bob);
    await expect(
      db.query("select public.void_payment($1,$2)", [
        p.rows[0].id,
        "wrong owner",
      ]),
    ).rejects.toThrow("unavailable");
    await asUser(alice);
    await db.query("select public.void_payment($1,$2)", [
      p.rows[0].id,
      "Mistyped amount",
    ]);
    await pay(id, 6000, [
      { installment_id: rows[0].id, amount_centavos: 6000 },
    ]);
    expect(
      (await db.query("select * from public.payments where loan_id=$1", [id]))
        .rows,
    ).toHaveLength(2);
    expect(
      (
        await db.query(
          "select * from public.payment_allocations where loan_id=$1",
          [id],
        )
      ).rows,
    ).toHaveLength(2);
  });
  it("enforces file ownership, loan paths, private bucket and evidence retention", async () => {
    await asUser(alice);
    const id = await save(),
      objectPath = `${alice}/${id}/receipt.pdf`;
    await db.query(
      "insert into storage.objects(bucket_id,name) values('loan-documents',$1)",
      [objectPath],
    );
    const p = {
      loan_id: id,
      payment_id: null,
      filename: "receipt.pdf",
      object_path: objectPath,
      mime_type: "application/pdf",
      size_bytes: 4194304,
    };
    await expect(
      db.query("select public.register_document($1::jsonb)", [
        JSON.stringify({ ...p, size_bytes: 4194305 }),
      ]),
    ).rejects.toThrow("documents_vercel_upload_limit");
    await db.query("select public.register_document($1::jsonb)", [
      JSON.stringify(p),
    ]);
    expect(
      (
        await db.query(
          "delete from storage.objects where name=$1 returning id",
          [objectPath],
        )
      ).rows,
    ).toHaveLength(0);
    await asUser(bob);
    expect(
      (
        await db.query("select * from storage.objects where name=$1", [
          objectPath,
        ])
      ).rows,
    ).toHaveLength(0);
    await expect(
      db.query(
        "insert into storage.objects(bucket_id,name) values('loan-documents',$1)",
        [`${bob}/${id}/bad.pdf`],
      ),
    ).rejects.toThrow("row-level security");
    await expect(
      db.query("select public.register_document($1::jsonb)", [
        JSON.stringify(p),
      ]),
    ).rejects.toThrow("unavailable");
    await db.exec("reset role");
    const bucket = await db.query<{ public: boolean; file_size_limit: string }>(
      "select public, file_size_limit from storage.buckets",
    );
    expect(bucket.rows[0].public).toBe(false);
    expect(Number(bucket.rows[0].file_size_limit)).toBe(4194304);
  });
  it("denies anonymous calls to data and mutation functions", async () => {
    await db.exec(
      "reset role;set role anon;select set_config('request.jwt.claim.sub','',false)",
    );
    await expect(db.query("select * from public.loans")).rejects.toThrow(
      "permission denied",
    );
    await expect(save()).rejects.toThrow("permission denied");
  });
});
