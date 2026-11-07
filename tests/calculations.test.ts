import { describe, it, expect } from "vitest";
import { centavos, splitCentavos, MAX_CENTAVOS } from "../src/lib/money";
import { addMonths, addDays, isDate, todayPH } from "../src/lib/dates";
import {
  generateSchedule,
  installmentState,
  suggestAllocations,
  totals,
  cashFlowDifference,
} from "../src/lib/calculations";
import { paymentSchema, offerSchema } from "../src/lib/validation";
import { csvCell, createCsv, recordText } from "../src/lib/exports";
import { demoRecords } from "../src/lib/demo";
import { detectFile, safeFilename } from "../src/lib/uploads";

describe("centavo arithmetic and schedule assumptions", () => {
  it("does not count withheld charges twice and does not invent unknown costs", () => {
    const l = demoRecords("2026-11-07")[2];
    expect(cashFlowDifference(l)).toBe(510000);
    expect(cashFlowDifference({ ...l, withheld_centavos: 999999 })).toBe(
      510000,
    );
    expect(cashFlowDifference({ ...l, upfront_paid_centavos: 10000 })).toBe(
      520000,
    );
    expect(
      cashFlowDifference({ ...l, upfront_paid_centavos: null }),
    ).toBeNull();
  });
  it("parses decimal text exactly without binary float multiplication", () => {
    expect(centavos("0.29")).toBe(29);
    expect(centavos("1234.5")).toBe(123450);
    expect(centavos("0")).toBe(0);
    expect(centavos("1000000000")).toBe(MAX_CENTAVOS);
  });
  it.each(["1.001", "-1", "1,000", "1e3", "NaN", "1000000000.01", ""])(
    "rejects ambiguous or excessive input %s",
    (v) => expect(() => centavos(v)).toThrow(),
  );
  it("splits with a stable centavo remainder and preserves the exact total", () => {
    expect(splitCentavos(100, 3)).toEqual([34, 33, 33]);
    for (let n = 1; n <= 360; n++) {
      const parts = splitCentavos(123456789, n);
      expect(parts.reduce((s, a) => s + a, 0)).toBe(123456789);
      expect(Math.max(...parts) - Math.min(...parts)).toBeLessThanOrEqual(1);
    }
  });
  it("flat interest rounds once, then splits; uses rate per installment period", () => {
    const rows = generateSchedule({
      method: "flat-periodic",
      principal: "1000.01",
      rate: "1.2345",
      count: 3,
      firstDue: "2026-01-31",
      frequency: "monthly",
      total: "",
    });
    expect(rows.reduce((s, i) => s + i.amount_centavos, 0)).toBe(103705);
    expect(rows.map((r) => r.due_date)).toEqual([
      "2026-01-31",
      "2026-02-28",
      "2026-03-31",
    ]);
  });
  it("splits known totals and supports weekly/fortnightly dates", () => {
    const base = {
      method: "equal-total" as const,
      total: "100",
      principal: "",
      rate: "",
      count: 3,
      firstDue: "2026-12-25",
      frequency: "weekly" as const,
    };
    expect(generateSchedule(base).map((r) => r.due_date)).toEqual([
      "2026-12-25",
      "2027-01-01",
      "2027-01-08",
    ]);
    expect(
      generateSchedule({ ...base, frequency: "fortnightly" })[1].due_date,
    ).toBe("2027-01-08");
    expect(() => generateSchedule({ ...base, total: "0.01" })).toThrow();
  });
});
describe("Philippine calendar dates", () => {
  it("clamps each month against the original day, including leap years", () => {
    expect(addMonths("2024-01-31", 1)).toBe("2024-02-29");
    expect(addMonths("2024-01-31", 2)).toBe("2024-03-31");
    expect(addMonths("2026-01-31", -1)).toBe("2025-12-31");
  });
  it("rejects impossible dates rather than normalizing them silently", () => {
    expect(isDate("2026-02-29")).toBe(false);
    expect(isDate("2024-02-29")).toBe(true);
    expect(isDate("2026-13-01")).toBe(false);
    expect(() => addDays("2199-12-31", 1)).toThrow();
  });
  it("uses Manila midnight and includes today without prematurely declaring overdue", () => {
    expect(todayPH(new Date("2026-11-07T16:00:00Z"))).toBe("2026-11-08");
    expect(todayPH(new Date("2026-11-07T15:59:59Z"))).toBe("2026-11-07");
    const l = demoRecords("2026-11-07")[0],
      i = l.installments[2];
    expect(installmentState(i, [], i.due_date).status).toBe("Scheduled");
  });
});
describe("payment allocation and corrections", () => {
  const l = demoRecords("2026-11-07")[0];
  it("shows partial overdue amounts and ignores voided entries", () => {
    const i = l.installments[1];
    expect(installmentState(i, l.payments, "2026-11-07")).toMatchObject({
      remaining: 235000,
      status: "Overdue · partial",
    });
    expect(
      totals(
        l.installments,
        l.payments.map((p) => ({ ...p, voided_at: "2026-11-07" })),
      ).recorded,
    ).toBe(0);
  });
  it("preserves overpayments as unapplied money", () => {
    const one = [l.installments[0]];
    const applications = suggestAllocations(1000000, one, []);
    expect(applications[0].amount_centavos).toBe(470000);
    const p = {
      ...l.payments[0],
      amount_centavos: 1000000,
      payment_allocations: applications,
    };
    expect(totals(one, [p])).toMatchObject({
      remaining: 0,
      unapplied: 530000,
      recorded: 1000000,
    });
  });
  it("rejects over-allocation, duplicate installments, and excessive known components", () => {
    const p = {
      ...l.payments[0],
      request_id: crypto.randomUUID(),
      allocations: [
        { installment_id: l.installments[0].id, amount_centavos: 9000000 },
      ],
    };
    expect(paymentSchema.safeParse({ ...p, allocations: [] }).success).toBe(
      true,
    );
    expect(paymentSchema.safeParse(p).success).toBe(false);
    expect(
      paymentSchema.safeParse({
        ...p,
        allocations: [
          { installment_id: l.installments[0].id, amount_centavos: 1 },
          { installment_id: l.installments[0].id, amount_centavos: 1 },
        ],
      }).success,
    ).toBe(false);
    expect(
      paymentSchema.safeParse({
        ...p,
        allocations: [],
        principal_centavos: 99999999,
      }).success,
    ).toBe(false);
  });
  it("accepts unknown principal and other fields in a draft", () => {
    const { loan_terms, ...x } = demoRecords("2026-11-07")[2];
    const input = {
      ...x,
      status: "draft",
      principal_centavos: null,
      proceeds_centavos: null,
      terms: loan_terms,
      installments: [],
    };
    expect(
      offerSchema.safeParse({
        ...input,
        terms: { ...loan_terms, schedule_complete: false },
      }).success,
    ).toBe(true);
  });
});
describe("exports and uploads", () => {
  it("escapes quotes/newlines and neutralizes spreadsheet formulas", () => {
    expect(csvCell('a,"b"\nc')).toBe('"a,""b""\nc"');
    expect(csvCell(' =HYPERLINK("x")')).toMatch(/^"'/);
    expect(csvCell("@SUM(A1)")).toMatch(/^"'/);
  });
  it("includes caveats, voided history, unknown components and exact centavos", () => {
    const l = demoRecords("2026-11-07")[0];
    const csv = createCsv(l, new Date("2026-11-07T00:00Z"));
    expect(csv).toContain("not independently verified");
    expect(csv).toContain("7050.00");
    const sections = recordText(l);
    expect(
      sections
        .find((s) => s.heading === "Payment-history statement")
        ?.lines.join(" "),
    ).toContain("Known principal Unknown");
  });
  it("checks file signatures instead of trusting a claimed extension", () => {
    expect(detectFile(new TextEncoder().encode("%PDF-1.7"))).toBe(
      "application/pdf",
    );
    expect(detectFile(new TextEncoder().encode("<script>"))).toBeNull();
    expect(detectFile(new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10]))).toBe(
      "image/png",
    );
    expect(safeFilename("../../x\r\n.pdf")).not.toContain("/");
  });
});
