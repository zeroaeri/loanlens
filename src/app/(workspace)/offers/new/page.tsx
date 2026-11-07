import { PageHeading } from "@/components/ui";
import { OfferForm } from "@/components/offer-form";
export default function NewOffer() {
  return (
    <div className="readable">
      <PageHeading
        eyebrow="START WITH WHAT YOU KNOW"
        title="Bring an offer into focus."
        description="Manual entry · your terms, in your own record."
      />
      <OfferForm />
    </div>
  );
}
