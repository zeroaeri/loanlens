import { requireUser } from "@/lib/data";
import { PageHeading, Field } from "@/components/ui";
import { saveProfile, signOut } from "@/app/actions";
export default async function Settings() {
  const { supabase, userId, email } = await requireUser();
  const { data } = await supabase
    .from("profiles")
    .select("display_name")
    .eq("id", userId)
    .single();
  return (
    <>
      <PageHeading
        eyebrow="PERSONAL WORKSPACE"
        title="Your account."
        description="Your records are linked to your Supabase Auth account."
      />
      <section className="card readable">
        <form action={saveProfile}>
          <div className="form-grid">
            <Field label="Display name">
              <input
                name="display_name"
                maxLength={80}
                defaultValue={data?.display_name ?? ""}
              />
            </Field>
            <Field label="Account email">
              <input readOnly value={email} />
            </Field>
          </div>
          <div className="form-actions section-gap">
            <button className="button primary">Save profile</button>
          </div>
        </form>
        <form action={signOut} className="section-gap">
          <button className="button secondary">Sign out of this device</button>
        </form>
      </section>
    </>
  );
}
