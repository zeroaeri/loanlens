"use server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { requireUser } from "@/lib/data";
import { createClient } from "@/lib/supabase/server";
import {
  offerSchema,
  paymentSchema,
  type ActionResult,
} from "@/lib/validation";
import { todayPH } from "@/lib/dates";

function refresh(id: string) {
  revalidatePath("/dashboard");
  revalidatePath("/offers");
  revalidatePath("/calendar");
  revalidatePath("/compare");
  revalidatePath(`/loans/${id}`);
}
function invalid(error: z.ZodError): ActionResult {
  return {
    ok: false,
    message: error.issues
      .map((i) => `${i.path.join(".")}: ${i.message}`)
      .slice(0, 4)
      .join(" · "),
  };
}
export async function saveOffer(input: unknown): Promise<ActionResult> {
  const parsed = offerSchema.safeParse(input);
  if (!parsed.success) return invalid(parsed.error);
  const { supabase } = await requireUser();
  const { data, error } = await supabase.rpc("save_offer", {
    payload: parsed.data,
  });
  if (error)
    return {
      ok: false,
      message:
        "Offer could not be saved. Check that it is still a draft or offer and that the migration is installed.",
    };
  refresh(data);
  return { ok: true, message: "Offer saved.", id: data };
}
export async function activateLoan(id: string): Promise<ActionResult> {
  if (!z.uuid().safeParse(id).success)
    return { ok: false, message: "Invalid record." };
  const { supabase, userId } = await requireUser();
  const { data: l, error: readError } = await supabase
    .from("loans")
    .select(
      "id,principal_centavos,proceeds_centavos,disbursement_date,loan_terms(schedule_complete),installments(id)",
    )
    .eq("id", id)
    .eq("user_id", userId)
    .maybeSingle();
  if (readError || !l) return { ok: false, message: "Record unavailable." };
  if (
    l.principal_centavos == null ||
    l.proceeds_centavos == null ||
    !l.disbursement_date
  )
    return {
      ok: false,
      message:
        "Enter principal, actual proceeds, and the disbursement date first.",
    };
  const { error } = await supabase.rpc("activate_loan", { lid: id });
  if (error)
    return {
      ok: false,
      message:
        "Review the complete installment schedule and confirm it before activation.",
    };
  refresh(id);
  return {
    ok: true,
    message: "Loan activated. The saved terms and schedule are now frozen.",
  };
}
export async function recordPayment(input: unknown): Promise<ActionResult> {
  const parsed = paymentSchema.safeParse(input);
  if (!parsed.success) return invalid(parsed.error);
  if (parsed.data.paid_on > todayPH())
    return {
      ok: false,
      message: "Use the actual payment date, not a future date.",
    };
  const { supabase } = await requireUser();
  const { data, error } = await supabase.rpc("record_payment", {
    payload: parsed.data,
  });
  if (error)
    return {
      ok: false,
      message:
        "Payment was not saved. Refresh the page: an installment may already be paid, or the date may precede disbursement.",
    };
  refresh(parsed.data.loan_id);
  return {
    ok: true,
    message: "Payment recorded. Any unapplied amount remains visible.",
    id: data,
  };
}
export async function voidPayment(
  id: string,
  loanId: string,
  reason: string,
): Promise<ActionResult> {
  if (
    !z.uuid().safeParse(id).success ||
    !z.uuid().safeParse(loanId).success ||
    reason.trim().length < 3 ||
    reason.length > 1000
  )
    return {
      ok: false,
      message: "Give a correction reason of 3–1000 characters.",
    };
  const { supabase } = await requireUser();
  const { error } = await supabase.rpc("void_payment", {
    pid: id,
    reason: reason.trim(),
  });
  if (error)
    return {
      ok: false,
      message:
        "Correction could not be saved. The payment may already be voided.",
    };
  refresh(loanId);
  return {
    ok: true,
    message:
      "Original retained and voided. Record a replacement payment if needed.",
  };
}
export async function signOut() {
  const supabase = await createClient();
  const { error } = await supabase.auth.signOut({ scope: "local" });
  if (error) throw new Error("Unable to sign out. Try again.");
  redirect("/auth");
}
export async function saveProfile(form: FormData): Promise<void> {
  const name = z.string().trim().max(80).parse(form.get("display_name"));
  const { supabase, userId } = await requireUser();
  const { error } = await supabase
    .from("profiles")
    .update({ display_name: name })
    .eq("id", userId);
  if (error) throw new Error("Unable to update profile.");
  revalidatePath("/settings");
}
