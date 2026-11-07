import { RepaymentCalendar } from "@/components/calendar";
import { getLoans } from "@/lib/data";
import { todayPH } from "@/lib/dates";
export default async function CalendarPage() {
  return <RepaymentCalendar loans={await getLoans()} today={todayPH()} />;
}
