import { Shell } from "@/components/shell";
import { Dashboard, RecordsList } from "@/components/dashboard";
import { Comparison } from "@/components/comparison";
import { RepaymentCalendar } from "@/components/calendar";
import { demoRecords } from "@/lib/demo";
import { todayPH } from "@/lib/dates";
export const dynamic = "force-dynamic";
export default async function Demo({
  searchParams,
}: {
  searchParams: Promise<{ view?: string }>;
}) {
  const today = todayPH(),
    loans = demoRecords(today),
    { view } = await searchParams;
  return (
    <Shell demo>
      {view === "offers" ? (
        <RecordsList loans={loans} demo />
      ) : view === "compare" ? (
        <Comparison loans={loans} demo />
      ) : view === "calendar" ? (
        <RepaymentCalendar loans={loans} today={today} demo />
      ) : (
        <Dashboard loans={loans} today={today} demo />
      )}
    </Shell>
  );
}
