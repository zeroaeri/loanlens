import { Dashboard } from "@/components/dashboard";
import { getLoans } from "@/lib/data";
import { todayPH } from "@/lib/dates";
export default async function DashboardPage() {
  return <Dashboard loans={await getLoans()} today={todayPH()} />;
}
