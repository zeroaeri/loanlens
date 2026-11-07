"use client";
import Link from "next/link";
import { useActionState } from "react";
import { authenticate } from "@/app/auth/actions";
import { Field, Status } from "./ui";
export function AuthForm({ signup }: { signup: boolean }) {
  const [state, action, pending] = useActionState(authenticate, {
    message: "",
  });
  return (
    <div>
      <div className="eyebrow">YOUR PERSONAL WORKSPACE</div>
      <h1>{signup ? "A clearer picture starts here." : "Welcome back."}</h1>
      <p>
        {signup
          ? "Create an account to save your offers and repayment records."
          : "Sign in to pick up where you left off."}
      </p>
      <form action={action}>
        <input type="hidden" name="mode" value={signup ? "signup" : "signin"} />
        <Field label="Email address">
          <input
            type="email"
            autoComplete="email"
            name="email"
            required
            maxLength={254}
            placeholder="you@example.com"
          />
        </Field>
        <Field label="Password" hint="At least 10 characters.">
          <input
            type="password"
            name="password"
            autoComplete={signup ? "new-password" : "current-password"}
            required
            minLength={10}
            maxLength={128}
          />
        </Field>
        <Status message={state.message} ok={state.ok} />
        <button disabled={pending} className="button primary">
          {pending ? "Please wait…" : signup ? "Create account" : "Sign in"}
        </button>
      </form>
      <p className="auth-switch">
        {signup ? "Already have an account?" : "New to LoanLens?"}{" "}
        <Link href={signup ? "/auth" : "/auth?mode=signup"}>
          {signup ? "Sign in" : "Create an account"}
        </Link>
      </p>
      <p className="auth-switch">
        <Link href="/demo">Explore fictional demo</Link> ·{" "}
        <Link href="/setup">Setup help</Link>
      </p>
    </div>
  );
}
