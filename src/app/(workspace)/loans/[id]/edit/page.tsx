import { notFound } from "next/navigation";
import { getLoan } from "@/lib/data";
import { OfferForm } from "@/components/offer-form";
import { PageHeading } from "@/components/ui";
export default async function Edit({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const l = await getLoan((await params).id);
  if (l.status === "active") notFound();
  return (
    <div className="readable">
      <PageHeading
        eyebrow="YOUR SAVED TERMS"
        title="Refine this offer."
        description="Updating an offer is saved in its correction history."
      />
      <OfferForm loan={l} />
    </div>
  );
}
