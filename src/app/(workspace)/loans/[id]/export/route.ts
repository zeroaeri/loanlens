import { getLoan } from "@/lib/data";
import { createCsv } from "@/lib/exports";
import { createRecordPdf } from "@/lib/pdf";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const format = new URL(request.url).searchParams.get("format");
  if (format !== "csv" && format !== "pdf")
    return new Response("Use format=csv or format=pdf", { status: 400 });
  const loan = await getLoan((await params).id);
  const headers = {
    "Cache-Control": "private, no-store",
    "Content-Disposition": `attachment; filename="loanlens-${loan.id}.${format}"`,
    "X-Content-Type-Options": "nosniff",
  };
  if (format === "csv")
    return new Response(createCsv(loan), {
      headers: { ...headers, "Content-Type": "text/csv; charset=utf-8" },
    });
  return new Response(Buffer.from(await createRecordPdf(loan)), {
    headers: { ...headers, "Content-Type": "application/pdf" },
  });
}
