import Link from "next/link";
import { Brand, Notice } from "@/components/ui";
export default function Setup() {
  return (
    <main id="main-content" className="setup-page">
      <Brand />
      <div className="card">
        <div className="eyebrow">CONNECT YOUR WORKSPACE</div>
        <h1>Ready for your Supabase project.</h1>
        <p>
          The interface and fictional demo run without credentials. Your
          personal records need your own database and authentication.
        </p>
        <ol className="setup-list">
          <li>Create a Supabase project.</li>
          <li>
            Copy <code>.env.example</code> to <code>.env.local</code> and enter
            the project URL and publishable key.
          </li>
          <li>
            Apply all SQL files in <code>supabase/migrations/</code> in filename
            order using the SQL editor, or use the Supabase CLI.
          </li>
          <li>
            Configure Auth’s Site URL and confirmation redirect URL, then
            restart Next.js.
          </li>
        </ol>
        <Notice>
          No service-role key is required. Full instructions and verification
          steps are in README.md.
        </Notice>
        <div className="hero-actions">
          <Link href="/demo" className="button primary">
            Explore fictional demo
          </Link>
          <Link href="/auth" className="button secondary">
            Try sign in
          </Link>
        </div>
      </div>
    </main>
  );
}
