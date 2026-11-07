"use client";
export default function ErrorPage({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <main id="main-content" className="setup-page">
      <div className="card">
        <h1>We couldn’t load this view.</h1>
        <p>
          Check your connection and Supabase setup, then try again. Your saved
          records have not been replaced.
        </p>
        {error.digest && <small>Reference: {error.digest}</small>}
        <p>
          <button className="button primary" onClick={reset}>
            Try again
          </button>
        </p>
      </div>
    </main>
  );
}
