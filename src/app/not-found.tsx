import Link from "next/link";
export default function NotFound() {
  return (
    <main id="main-content" className="setup-page">
      <div className="card">
        <h1>Record unavailable.</h1>
        <p>This record may not exist or may belong to another account.</p>
        <Link className="button primary" href="/dashboard">
          Back to your overview
        </Link>
      </div>
    </main>
  );
}
