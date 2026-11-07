import "server-only";
import { cache } from "react";
import { redirect, notFound } from "next/navigation";
import { z } from "zod";
import { createClient } from "./supabase/server";
import { isConfigured } from "./supabase/config";
import type { LoanRecord } from "./types";

export const requireUser = cache(async () => {
  if (!isConfigured()) redirect("/setup");
  const supabase = await createClient();
  const { data, error } = await supabase.auth.getClaims();
  if (error || !data?.claims?.sub) redirect("/auth");
  return {
    supabase,
    userId: data.claims.sub,
    email: String(data.claims.email ?? ""),
  };
});
const selection =
  "*, loan_terms(*), installments(*), payments(*, payment_allocations(installment_id, amount_centavos)), documents(*), correction_history(*)";
export async function getLoans(): Promise<LoanRecord[]> {
  const { supabase, userId } = await requireUser();
  const { data, error } = await supabase
    .from("loans")
    .select(selection)
    .eq("user_id", userId)
    .order("created_at", { ascending: false });
  if (error)
    throw new Error(
      "Unable to load records. Check your connection and that the database migration has been applied.",
    );
  return data as LoanRecord[];
}
export async function getLoan(id: string): Promise<LoanRecord> {
  if (!z.uuid().safeParse(id).success) notFound();
  const { supabase, userId } = await requireUser();
  const { data, error } = await supabase
    .from("loans")
    .select(selection)
    .eq("id", id)
    .eq("user_id", userId)
    .maybeSingle();
  if (error) throw new Error("Unable to load this record. Please try again.");
  if (!data) notFound();
  return data as LoanRecord;
}
