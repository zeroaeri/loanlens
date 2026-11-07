import { RecordsList } from "@/components/dashboard";
import { getLoans } from "@/lib/data";
export default async function OffersPage() {
  return <RecordsList loans={await getLoans()} />;
}
