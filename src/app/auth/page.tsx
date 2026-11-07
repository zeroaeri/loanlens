import { Brand } from "@/components/ui";
import { AuthForm } from "@/components/auth-form";
export default async function AuthPage({
  searchParams,
}: {
  searchParams: Promise<{ mode?: string; error?: string }>;
}) {
  const p = await searchParams;
  return (
    <main id="main-content" className="auth-layout">
      <aside className="auth-aside">
        <Brand />
        <h1>
          Your terms.
          <br />
          Your timeline.
          <br />A clearer picture.
        </h1>
        <p>
          Keep the details that matter close: the cash you receive, the payments
          ahead, and the records along the way.
        </p>
      </aside>
      <section className="auth-panel">
        <div>
          {p.error && (
            <div className="form-message failure" role="alert">
              Confirmation failed or expired. Request another confirmation
              through sign up, or sign in if already confirmed.
            </div>
          )}
          <AuthForm key={p.mode} signup={p.mode === "signup"} />
        </div>
      </section>
    </main>
  );
}
