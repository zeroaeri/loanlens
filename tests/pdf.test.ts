import { it, expect } from "vitest";
import { PDFDocument } from "pdf-lib";
import { writeFile, mkdir } from "node:fs/promises";
import { createRecordPdf } from "../src/lib/pdf";
import { demoRecords } from "../src/lib/demo";
it("produces a paginated PDF with Unicode money, long text, and retained voids", async () => {
  const l = demoRecords("2026-11-07")[0];
  l.lender = "FICTIONAL QA - Peña Cooperative";
  l.notes =
    "Fictional user-provided information. " +
    ("A long note with an unbroken reference " + "a".repeat(140) + "\n").repeat(
      8,
    );
  l.payments[0].voided_at = "2026-11-07T00:00Z";
  l.payments[0].void_reason = "Fictional correction for export testing";
  const bytes = await createRecordPdf(l, new Date("2026-11-07T00:00Z"));
  const pdf = await PDFDocument.load(bytes);
  expect(pdf.getPageCount()).toBeGreaterThanOrEqual(2);
  expect(pdf.getTitle()).toBe("LoanLens personal record");
  if (process.env.LOANLENS_PDF_QA === "yes") {
    await mkdir("tmp/pdfs", { recursive: true });
    await writeFile("tmp/pdfs/export-qa.pdf", bytes);
  }
});
