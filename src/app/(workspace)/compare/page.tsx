import { Comparison } from "@/components/comparison";
import { getLoans } from "@/lib/data";
export default async function ComparePage() {
  return <Comparison loans={await getLoans()} />;
}
