import Link from "next/link";
import { Brand, PageHeading, Notice } from "@/components/ui";
import { legalNotes } from "@/lib/education";
export default function Learn() {
  return (
    <main id="main-content" className="setup-page learn-page">
      <nav className="learn-nav">
        <Brand />
        <Link className="text-link" href="/dashboard">
          Your workspace ↗
        </Link>
      </nav>
      <PageHeading
        eyebrow="THE FINE PRINT, IN PLAIN LANGUAGE"
        title="Understand what you’re recording."
        description="Educational context for Philippine credit transactions · sources reviewed 7 November 2026."
      />
      <Notice>
        These explanations are separate from your entered contract terms. They
        do not decide whether a particular agreement is valid or what you
        legally owe.
      </Notice>
      <section className="card section-gap">
        {legalNotes.map((n) => (
          <details open key={n.id} id={n.id} className="explanation">
            <summary>{n.title}</summary>
            <p>{n.body}</p>
            <a href={n.url} target="_blank" rel="noreferrer">
              Read the source · {n.authority} ↗
            </a>
          </details>
        ))}
      </section>
    </main>
  );
}
