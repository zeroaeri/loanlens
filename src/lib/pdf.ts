import { readFile } from "node:fs/promises";
import path from "node:path";
import { PDFDocument, rgb, type PDFPage } from "pdf-lib";
import fontkit from "@pdf-lib/fontkit";
import type { LoanRecord } from "./types";
import { recordText } from "./exports";

// A Node route renders a real, paginated PDF without an external processing service.
export async function createRecordPdf(loan: LoanRecord, now = new Date()) {
  const pdf = await PDFDocument.create();
  pdf.registerFontkit(fontkit);
  const font = await pdf.embedFont(
    await readFile(
      path.join(process.cwd(), "public/fonts/NotoSans-Regular.ttf"),
    ),
    { subset: true },
  );
  const bold = await pdf.embedFont(
    await readFile(
      path.join(process.cwd(), "public/fonts/NotoSans-Bold.ttf"),
    ),
    { subset: true },
  );
  pdf.setTitle("LoanLens personal record");
  pdf.setAuthor("LoanLens - user-entered information");
  const supported = new Set(font.getCharacterSet());
  let substitutions = false;
  const safe = (text: string) =>
    Array.from(text.normalize("NFC"))
      .map((c) => {
        if (c === "\n" || c === "\r" || c === "\t") return " ";
        if (supported.has(c.codePointAt(0)!)) return c;
        substitutions = true;
        return `[U+${c.codePointAt(0)!.toString(16).toUpperCase()}]`;
      })
      .join("");
  let page: PDFPage,
    y = 0;
  function newPage() {
    page = pdf.addPage([595.28, 841.89]);
    y = 780;
    page.drawText("LoanLens / PERSONAL RECORD", {
      x: 44,
      y,
      font: bold,
      size: 15,
      color: rgb(0.08, 0.35, 0.28),
    });
    y -= 25;
    page.drawText("User-entered information. Not a lender-issued statement.", {
      x: 44,
      y,
      font,
      size: 8,
      color: rgb(0.43, 0.48, 0.43),
    });
    y -= 32;
  }
  function line(text: string, heading = false) {
    const size = heading ? 13 : 9,
      face = heading ? bold : font,
      width = 507;
    const words = safe(text).split(/\s+/);
    let buffer = "";
    function draw(value: string) {
      if (y < 65) newPage();
      page.drawText(value, {
        x: 44,
        y,
        font: face,
        size,
        color: rgb(0.15, 0.24, 0.2),
      });
      y -= heading ? 22 : 15;
    }
    for (const word of words) {
      const candidate = buffer ? buffer + " " + word : word;
      if (face.widthOfTextAtSize(candidate, size) <= width) {
        buffer = candidate;
        continue;
      }
      if (buffer) {
        draw(buffer);
        buffer = "";
      }
      if (face.widthOfTextAtSize(word, size) > width) {
        for (const char of word) {
          if (face.widthOfTextAtSize(buffer + char, size) > width) {
            draw(buffer);
            buffer = "";
          }
          buffer += char;
        }
      } else buffer = word;
    }
    if (buffer) draw(buffer);
  }
  newPage();
  for (const section of recordText(loan, now)) {
    if (y < 130) newPage();
    y -= 10;
    line(section.heading, true);
    for (const value of section.lines) line(value);
    y -= 8;
  }
  if (substitutions)
    line(
      "Some characters outside the bundled font are shown as Unicode code points [U+...]. The CSV retains the original text.",
    );
  const pages = pdf.getPages();
  pages.forEach((p, i) => {
    p.drawLine({
      start: { x: 44, y: 43 },
      end: { x: 551, y: 43 },
      thickness: 0.5,
      color: rgb(0.8, 0.85, 0.8),
    });
    p.drawText(`Personal record | Page ${i + 1} of ${pages.length}`, {
      x: 44,
      y: 28,
      size: 8,
      font,
      color: rgb(0.45, 0.5, 0.45),
    });
  });
  return pdf.save();
}
