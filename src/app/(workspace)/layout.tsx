import { requireUser } from "@/lib/data";
import { Shell } from "@/components/shell";
export const dynamic = "force-dynamic";
export default async function WorkspaceLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { email } = await requireUser();
  return <Shell email={email}>{children}</Shell>;
}
