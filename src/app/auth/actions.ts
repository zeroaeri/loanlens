"use server";
import { redirect } from "next/navigation";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { isConfigured } from "@/lib/supabase/config";
export async function authenticate(
  _previous: { message: string; ok?: boolean },
  form: FormData,
): Promise<{ message: string; ok?: boolean }> {
  if (!isConfigured())
    return {
      message: "Connect your Supabase project first. See Setup or README.md.",
    };
  const parsed = z
    .object({
      email: z.email().max(254),
      password: z.string().min(10, "Use at least 10 characters.").max(128),
      mode: z.enum(["signin", "signup"]),
    })
    .safeParse(Object.fromEntries(form));
  if (!parsed.success) return { message: parsed.error.issues[0].message };
  const supabase = await createClient();
  const { email, password, mode } = parsed.data;
  if (mode === "signup") {
    const origin = process.env.NEXT_PUBLIC_APP_URL;
    if (!origin || !z.url().safeParse(origin).success)
      return { message: "Configure NEXT_PUBLIC_APP_URL before signing up." };
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: new URL("/auth/callback", origin).toString(),
      },
    });
    if (error)
      return {
        message:
          "Unable to create account. Check your details or try again later.",
      };
    if (!data.session)
      return {
        ok: true,
        message:
          "Check your email for a confirmation link. If already registered, sign in instead.",
      };
  } else {
    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });
    if (error)
      return {
        message:
          "Sign in failed. Check your email, password, and email confirmation.",
      };
  }
  redirect("/dashboard");
}
