import { getLoan } from "@/lib/data";
import { todayPH } from "@/lib/dates";
import { LoanDetail } from "@/components/loan-detail";
export default async function LoanPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  return (
    <LoanDetail loan={await getLoan((await params).id)} today={todayPH()} />
  );
}
