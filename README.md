# LoanLens

A working Next.js application for understanding personal loan offers and maintaining borrower-entered repayment records in the Philippines. Stack: **Next.js 16.4.5 App Router, TypeScript, Tailwind CSS 4, Supabase Postgres/Auth/private Storage**.

## What is implemented

- Email/password sign-up, sign-in, confirmation callback, sign-out, and a small account/profile page.
- Manual draft and offer entry, unknown terms, agreement summary, and linked Philippine-law explanations.
- User-entered schedules, editable before activation. A preview generator supports known-total splitting and explicitly flat/add-on periodic interest.
- Two/three-offer comparisons with dated payment timelines and disclosed assumptions.
- Activation of a reviewed offer; contractual terms and installments then freeze.
- Dashboard, combined monthly/list calendar, partial and overdue installment states.
- Payment ledger with explicit installment applications, optional known principal/interest/fee components, visible unapplied excess, and retry protection.
- Corrections by voiding with a reason and recording a replacement; originals and evidence remain.
- Private PDF/JPEG/PNG attachments with server validation and owner-authorized, 60-second download links.
- Paginated PDF personal records and spreadsheet-safe CSV exports, including corrections.
- A **read-only fictional demo** at `/demo`, with no account or database needed. Demo data never enters your real workspace.

**Not yet connected to your Supabase account.** The app builds and the database migration is tested locally, but hosted Auth, email delivery, PostgREST relationship output, and actual Storage authorization must be verified against your project after setup. The optional live integration test below is provided for that purpose. Document extraction is intentionally deferred until the connected core passes its live walkthrough.

## Start locally

Use Node.js **22 or newer** (tested with Node 24) and npm. Run these from the project folder:

```bash
npm ci
cp .env.example .env.local
npm run dev
```

Open `http://localhost:3000`. You can immediately explore `/demo`. Personal routes go to `/setup` until the environment is configured; they never fall back to fake storage or demo records.

The development script accepts Next's normal `--port`/`--hostname` flags and also translates `--host`/`--strictPort` arguments from preview runners. Production is ordinary Next.js:

```bash
npm run build
npm start
```

## Connect your Supabase account

1. Create a **new Supabase project**. For testing, use a dedicated test project, not a project holding real financial records.
2. In Project Settings / API (or Connect), copy the **project URL** and **publishable key** into `.env.local`:

   ```dotenv
   NEXT_PUBLIC_SUPABASE_URL=https://YOUR_PROJECT.supabase.co
   NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=YOUR_PUBLISHABLE_KEY
   NEXT_PUBLIC_APP_URL=http://localhost:3000
   ```

   These two Supabase values are public application identifiers. A publishable key does not grant ownership; RLS and authenticated JWTs do. **Do not add a service-role/secret key.** The application does not use one.

3. Apply every SQL file in `supabase/migrations/` in filename order, once each, using Supabase's SQL editor. The core migration creates the application tables, RPCs, ownership policies, and **private** `loan-documents` bucket. The follow-up migration sets the Vercel-compatible 4 MB upload limit. If you already applied the core migration, run only the new follow-up migration. The migration assumes Supabase's existing `auth` and `storage` schemas. Run it on a fresh project, not on arbitrary existing tables. Let migration failures surface; do not weaken RLS to work around them.
4. Alternatively, use the Supabase CLI to keep migration history:

   ```bash
   npx supabase init
   npx supabase login
   npx supabase link --project-ref YOUR_PROJECT_REF
   npx supabase db push
   ```

   Choose either the SQL-editor route or the CLI route for the initial application. If you use the editor first and later adopt CLI migrations, reconcile the remote migration history before pushing; do not blindly apply the same DDL twice.

5. Under **Authentication / URL Configuration**, set Site URL to `http://localhost:3000` and allow `http://localhost:3000/auth/callback`. For a hosted app, replace these with its exact HTTPS origin and callback; update `NEXT_PUBLIC_APP_URL` too. Avoid broad wildcard production redirects.
6. Enable the email/password provider. Keep email confirmation enabled for normal use. The app supports the standard PKCE `code` callback: retain Supabase's default confirmation-link template and open the confirmation link in the browser that initiated signup. Custom email templates using `token_hash` need a separate verification handler and are not supported here.
7. Restart the development server after setting environment values. Sign up, confirm the email, and sign in. If the default Supabase email service restricts recipients or hits its rate limit, configure your own SMTP delivery in Supabase. Do not treat an unreceived email as a successful account confirmation.
8. Check that `loan-documents` is **Private**, with 4 MB and PDF/JPEG/PNG restrictions. The migrations supply this configuration.

No paid AI service, extraction provider, bank integration, or service-role key is required for the core.

## Deploy with GitHub and Vercel

1. Extract the source and push the **project contents** to GitHub. Keep `package.json`, `src/`, and `next.config.ts` at the repository root. If you keep them inside a `LoanLens/` subfolder, set that folder as Vercel's Root Directory. `.gitignore` excludes local credentials, dependencies, generated builds, and temporary files. Commit `.env.example`, never `.env.local` or test-account passwords.
2. Import the repository into Vercel with framework preset **Next.js**. Use Node.js 24.x (or a supported version >=22). Keep the detected Next.js build/output settings; build command is `npm run build`. No static export, custom start command, or `vercel.json` is required.
3. Add these **Production** environment variables in Vercel before deploying:

   | Variable                               | Value                                                       |
   | -------------------------------------- | ----------------------------------------------------------- |
   | `NEXT_PUBLIC_SUPABASE_URL`             | Your Supabase project URL                                   |
   | `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | Your Supabase publishable key                               |
   | `NEXT_PUBLIC_APP_URL`                  | Exact production origin, e.g. `https://YOUR_APP.vercel.app` |

   Use your assigned production domain rather than guessing one. If necessary, deploy once to obtain it, update the app URL, and redeploy. Public Next.js environment variables are read at build time, so changing them requires a new deployment. Do not copy the live-test passwords into Vercel.

4. Apply all committed SQL migrations in your Supabase project; Vercel does **not** run them. In Supabase Auth / URL Configuration, set Site URL to the same production origin and allow its exact `/auth/callback` URL. Retain localhost as an additional redirect only if you still develop locally.
5. Redeploy after environment changes. First check `/demo`, then complete signup, confirmation, offer save, activation, payment, attachment, and PDF/CSV export using fictional records in your own account. Run the optional live isolation test against a separate test project before relying on real financial data. A successful Vercel build alone does not verify Supabase connectivity.

For branch previews, prefer a separate test Supabase project and preview-specific environment variables. Keep `NEXT_PUBLIC_APP_URL` and the authorized callback aligned with the exact preview origin. Avoid sharing production financial records with experimental preview deployments.

Uploads are capped at **4 MiB (4,194,304 bytes, displayed as 4 MB)**, leaving room for multipart fields below Vercel Functions' 4.5 MB request-body limit. Raising Next.js's body-size setting does not raise Vercel's limit. The follow-up migration restricts new document metadata and bucket uploads; any older larger evidence already registered remains readable. Existing file records are not removed.

Official references: [Vercel Functions limits](https://vercel.com/docs/functions/limitations), [Vercel environment variables](https://vercel.com/docs/environment-variables), and [Next.js environment variables](https://nextjs.org/docs/app/guides/environment-variables).

## Architecture and important decisions

Server Components read through `src/lib/data.ts`. Server Actions validate inputs with Zod, verify identity, and call narrow transactional Postgres functions. Each call uses the requesting user's session and the public project key. There is no shared administrator client.

`src/proxy.ts` refreshes Supabase session cookies using `getClaims()` and preserves the SDK's response cookies/cache headers. Protected data functions and actions independently verify claims. Proxy is not the authorization boundary. Authenticated responses use private/no-store caching.

The SQL functions are `SECURITY DEFINER` with an empty `search_path`, fully qualified relations, explicit `auth.uid()` ownership checks, and restricted execute grants. This allows atomic financial writes while denying direct REST inserts/updates/deletes on financial tables. RLS still controls direct reads. **Do not grant generic table write permissions** to make a client call work.

The `record_payment` function locks the parent loan, validates every application, inserts payment/applications/audit event in one transaction, and rolls everything back on any error. Reusing the same request UUID with the same payload returns the original payment; reusing it with different values fails. This protects against an exact network retry, not someone deliberately submitting the same payment through a fresh form.

### Database map

| Table                 | Purpose                                                                                      |
| --------------------- | -------------------------------------------------------------------------------------------- |
| `profiles`            | Account display name; automatically created for new Auth users                               |
| `loans`               | Draft/offer/active lifecycle, lender, principal, actual proceeds, deductions, dates          |
| `loan_terms`          | Entered interest, penalties, prepayment and security wording; complete-schedule confirmation |
| `installments`        | Saved contractual dates and amounts; frozen on activation                                    |
| `payments`            | User-recorded payment, optional components, idempotency key, void information                |
| `payment_allocations` | Applications of a payment to one or more installments                                        |
| `documents`           | Private object metadata and optional payment association                                     |
| `correction_history`  | Append-only record of offer changes, activation, payments and corrections                    |

Every child record carries the owner and parent identifiers. Composite foreign keys prevent cross-owner and cross-loan links even if a UUID is known. Private objects use `user_id/loan_id/random-id.ext`; Storage policies require the owner and an owned loan. Registered evidence has no overwrite or normal delete path. Only unregistered orphans can be removed for failed-upload cleanup.

Files are validated on the server for size, claimed MIME type, and matching PDF/PNG/JPEG signatures. This is format validation, **not malware scanning**. Files are offered as downloads rather than embedded as trusted HTML. Supabase's bucket type/size restrictions also apply to direct Storage requests. A signed download URL is a bearer capability valid for 60 seconds, so someone deliberately sharing it shares temporary access. URLs are not included in exports.

### Where to read the code

| File / directory                                  | What to explain in a presentation                                          |
| ------------------------------------------------- | -------------------------------------------------------------------------- |
| `src/lib/money.ts`, `dates.ts`, `calculations.ts` | Exact centavos, calendar dates, rounding and ledger semantics              |
| `src/lib/validation.ts`                           | Validation shared by the server's mutation entry points                    |
| `src/lib/data.ts`, `supabase/`, `src/proxy.ts`    | Identity checks, ownership, cookies and transactions                       |
| `src/components/offer-form.tsx`                   | Manual entry and review-before-use schedule generator                      |
| `src/components/comparison.tsx`                   | Side-by-side entered cash flows and assumptions                            |
| `src/components/loan-actions.tsx`                 | Payment entry, reviewed applications, voids and attachments                |
| `src/lib/exports.ts`, `pdf.ts`                    | Record exports and pagination; no external processing                      |
| `tests/`                                          | Financial, date, SQL isolation, export and optional live integration tests |

## Money, dates, and calculation assumptions

### Units and limits

All stored money uses Postgres `bigint` **integer centavos**. Text input is parsed using `BigInt`, not `parseFloat(value) * 100`. Each input amount is capped at ₱1 billion, and a schedule is capped at 360 rows. This keeps the per-loan sums used by JavaScript within safe integer bounds. Server validation and database checks reject negative or excessive amounts. Aggregate dashboards are intended for individual borrowers, not unbounded institutional datasets.

Contractual dates use Postgres `date` and ISO `YYYY-MM-DD` strings, with no implicit host-timezone parsing. The supported entry range is 1900–2199. Today, payment month, and overdue status use **Asia/Manila**. Audit timestamps use `timestamptz`; display uses Philippine time. An installment due today is not overdue yet. Payment dates must be on/after disbursement and not in the future.

### Supported generator methods

1. **Known repayment total:** split the supplied total over N installments. No interest method is inferred.
2. **Flat/add-on per installment period:** `interest = principal × (periodic percentage / 100) × N`; round the total interest once to the nearest centavo, half up; add it to principal; then split the total. Extra centavos are assigned to the earliest installments.

For monthly schedules, every due date is anchored to the **original first due day**; a missing day clamps to that month's end. January 31 → February 28 → March 31. Weekly means 7 days; fortnightly means 14 days. No business-day/holiday adjustment is inferred.

The periodic rate must match the installment period explicitly chosen by the user. There is no automatic annual/monthly conversion. The generator does not calculate reducing-balance amortization, irregular daily accrual, compounding, balloon payments, grace periods, legal interest, penalties, or prepayment adjustments. Those contractual schedules can be entered manually. Preview fields do not silently overwrite entered contract terms. Generated dates and amounts must be reviewed before being used and saved.

### What each figure means

| Figure                               | Exact meaning                                                                                                                    |
| ------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------- |
| Principal                            | Stated original loan amount entered by the user                                                                                  |
| Actual cash received                 | Net proceeds entered directly, after any withheld deductions                                                                     |
| Withheld deductions                  | Informational amount already reflected in proceeds; never added again                                                            |
| Separately paid upfront charges      | Additional outgoing cash; excludes withheld charges and charges inside installments                                              |
| Scheduled repayments                 | Sum of saved installments; a subtotal if the schedule is unconfirmed                                                             |
| Payments recorded                    | Non-voided actual-payment entries; not lender-verified acknowledgment                                                            |
| Applied to schedule                  | Sum of installment applications from non-voided payments                                                                         |
| Scheduled amount remaining           | Saved scheduled amount less applications, capped at zero per installment                                                         |
| Unapplied money                      | Payment amount not assigned to installments; retained, not discarded or netted silently                                          |
| Overdue scheduled amount             | Unpaid installment portions with a due date before Philippine today                                                              |
| Net scheduled outflow above proceeds | Repayments + separately paid upfront charges − actual proceeds; shown only when required amounts and complete schedule are known |

The comparison cash-flow difference is not an APR, an effective annual rate, or a legal assessment of cost. It excludes unknown and contingent charges. Known principal/interest/fee payment components describe part of the same payment; they are not added on top. Component fields do not produce a calculated principal balance. Payment applications are the user's bookkeeping instructions, not a determination under Civil Code Articles 1252–1254.

Early applications do not change future installment amounts, presume an interest rebate, or calculate lender acceptance. Paying all scheduled amounts does not generate a clearance certificate. Confirm a settlement amount with the lender when needed.

## Verification

```bash
npm run typecheck
npm test
npm run build
```

`npm test` runs without credentials or Docker. It uses PGlite (an embedded PostgreSQL engine), loads the **actual committed migrations unchanged**, and creates only small platform scaffolds for `auth`/`storage`. It then impersonates two authenticated roles and an anonymous role to exercise real PostgreSQL policies and functions. It checks rollback, owner-only reads, child relationships, direct-write denial, cross-loan allocation rejection, partial/excess payments, corrections, retry protection, and private-file path isolation.

The local tests **do not emulate** Supabase's Auth email delivery, JWT service, PostgREST response shapes, Storage HTTP service, or signed-URL implementation. Those need the separate test below and an end-to-end browser walkthrough. Desktop demo browser QA covers navigation, adding a third comparison column, monthly/list calendar navigation, overdue partial amounts, a loan summary, and expandable educational terms. Responsive CSS is implemented; mobile-device QA remains to be performed.

### Optional real Supabase access-isolation test

Use a dedicated disposable **test project** with the migration applied. Create two **confirmed** test accounts and add these variables to your ignored `.env.local`:

```dotenv
LOANLENS_RUN_LIVE_TESTS=yes
LOANLENS_TEST_EMAIL_A=YOUR_TEST_EMAIL_A
LOANLENS_TEST_PASSWORD_A=YOUR_TEST_PASSWORD_A
LOANLENS_TEST_EMAIL_B=YOUR_TEST_EMAIL_B
LOANLENS_TEST_PASSWORD_B=YOUR_TEST_PASSWORD_B
```

Run:

```bash
npm run test:live
```

The test refuses to run unless explicitly enabled and configured. It signs in with the public key, creates a **TEST ONLY** loan and payment, checks exact retry behavior, verifies nested relationship shapes, attempts unauthorized record/file reads and writes from the second account, tests owner signed downloads and public-download denial, and voids the fictional payment. The labeled loan, payment, audit history, and test document remain for inspection. It is not automatically run by `npm test` and has **not** been run in the supplied environment.

Also test the browser routes: while signed into account B, open the exact `/loans/ACCOUNT_A_LOAN_UUID`, `/loans/ACCOUNT_A_LOAN_UUID/export?format=pdf`, and `/documents/ACCOUNT_A_DOCUMENT_UUID` URLs. They should return record-unavailable/404, never account A's content. Repeat while signed out. Authentication can redirect to sign-in; it must not send private data before that redirect.

### PDF inspection

The exporter bundles Noto Sans and its license, wraps long text/references, paginates, and repeats a personal-record disclaimer on each page. Unsupported glyphs are represented as Unicode code points; the CSV retains original text. To generate a fictional QA specimen:

```bash
LOANLENS_PDF_QA=yes npm test -- tests/pdf.test.ts
```

It writes `tmp/pdfs/export-qa.pdf` (ignored). Inspect the pages after modifying the exporter. CSV exports use UTF-8 with BOM, quote every cell, escape embedded quotes/newlines, and prefix potential spreadsheet formulas with an apostrophe. This deliberately makes formula-like user text literal.

## Short presentation walkthrough

1. Open `/demo`. Explain principal vs proceeds and why scheduled remaining is not an independently verified debt balance.
2. Compare Cedar, Mango, and Acacia. Discuss cash received, installment sizes, duration, and the fact that withheld charges are not counted twice. There is no “best” badge.
3. Open the calendar, switch to List, and go to the previous month. Show a partially paid overdue installment.
4. With your **configured** real test account, create a draft called “Class presentation - fictional offer.” Save with unknown fields, then edit it with principal ₱10,000, actual proceeds ₱9,500, withheld deductions ₱500, separately paid upfront charges ₱0, and a past disbursement date.
5. Enter a known repayment total of ₱11,000 over four monthly installments, preview it, review the rows, and confirm the complete schedule. Save the offer. Discuss the separate entered interest and penalty wording.
6. Activate it. Record ₱1,000, suggest the earliest application, review, and save. Show the partial status and unchanged contractual amounts.
7. Upload a fictional receipt and explain that it is user-provided evidence, not lender verification. Void an intentional payment mistake with a reason, then record its replacement.
8. Export PDF and CSV. Point out the assumptions, export time, original/voided entries, and correction history.

## Scope boundaries and next milestones

- Document extraction/OCR is **not implemented**. PDFs and images are stored as private evidence only. No uploaded text is treated as instructions or sent to an AI service. Phase two should add source passage/page tracking, fully editable proposed values, and explicit confirmation before creating records. Manual entry stays available.
- Active schedule amendments/restructuring, reassignment of existing unapplied money without a correcting entry, closing/archiving loans, document deletion, and account deletion are not implemented. Before activation, review carefully. After activation, corrections to payments use void-and-replace. Do not edit the SQL tables manually to simulate amendments.
- There is no lender portal/acknowledgment, bank sync, payment execution, registration/perfection service, income-date feature, reminder scheduler, or legal-validity scoring.
- PDF output lists audit events; full before/after snapshots are in the CSV. Attachments remain private and are not bundled into exports.
- Pagination of large personal datasets, app-level rate limiting beyond Supabase Auth's controls, malware scanning, and further mobile/accessibility review are future hardening work. No production deployment or live integration certification is claimed.

## References checked for implementation

- [Next.js Proxy convention](https://nextjs.org/docs/app/api-reference/file-conventions/proxy)
- [Next.js data security and server authorization](https://nextjs.org/docs/app/guides/data-security)
- [Supabase SSR client and cookie handling](https://supabase.com/docs/guides/auth/server-side/creating-a-client)
- [Supabase Storage access control](https://supabase.com/docs/guides/storage/security/access-control)
- [Private buckets](https://supabase.com/docs/guides/storage/buckets/fundamentals)
- [Short-lived signed URLs](https://supabase.com/docs/reference/javascript/file-buckets-createsignedurl)
- [Civil Code text, Arts. 1933, 1953, 1956, 1252–1254, 2047, 2209](https://www.lawphil.net/statutes/repacts/ra1949/ra_386_1949.html)
- [Personal Property Security Act, Secs. 4–6 and 11–12, Supreme Court E-Library](https://elibrary.judiciary.gov.ph/thebookshelf/showdocs/2/86594)

Educational summaries in `src/lib/education.ts` were checked on 7 November 2026. They identify their source provisions and make no automatic conclusion about a particular agreement.
# loanlens
