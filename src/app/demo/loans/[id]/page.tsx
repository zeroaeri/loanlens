import { notFound } from "next/navigation";
import { Shell } from "@/components/shell";
import { LoanDetail } from "@/components/loan-detail";
import { demoRecords } from "@/lib/demo";
import { todayPH } from "@/lib/dates";
export const dynamic = "force-dynamic";
export default async function DemoLoan({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const today = todayPH(),
    id = (await params).id,
    l = demoRecords(today).find((l) => l.id === id);
  if (!l) notFound();
  return (
    <Shell demo>
      <LoanDetail loan={l} today={today} demo />
    </Shell>
  );
}
