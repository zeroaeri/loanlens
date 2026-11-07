import Link from "next/link";
import {
  ArrowUpRight,
  ArrowRight,
  Check,
  Layers3,
  CalendarDays,
  ReceiptText,
} from "lucide-react";
import { Brand } from "@/components/ui";
export default function Home() {
  return (
    <div className="landing">
      <header className="landing-nav">
        <Brand />
        <div>
          <Link href="/learn">Understand the fine print</Link>
          <Link className="button secondary" href="/auth">
            Sign in <ArrowUpRight size={16} />
          </Link>
        </div>
      </header>
      <main id="main-content" className="landing-main">
        <span className="pill">
          <span /> MADE FOR A CLEARER FINANCIAL PICTURE
        </span>
        <h1>
          Your loans.
          <br />A little more <em>clarity.</em>
        </h1>
        <p>
          Understand what you’re borrowing, see what’s coming,
          <br className="desktop-only" /> and keep every payment in one calm
          place.
        </p>
        <div className="hero-actions">
          <Link href="/auth?mode=signup" className="button primary">
            Start your workspace <ArrowRight size={18} />
          </Link>
          <Link href="/demo" className="button secondary">
            Explore the demo <ArrowUpRight size={17} />
          </Link>
        </div>
        <div className="hero-trust">
          <Check size={15} /> No bank connection needed <span>·</span> Built
          around your own records
        </div>
        <div className="landing-feature-grid">
          {[
            {
              icon: Layers3,
              n: "01",
              title: "Look beyond the rate",
              body: "Compare actual proceeds, fees, and every scheduled peso.",
            },
            {
              icon: CalendarDays,
              n: "02",
              title: "See the whole timeline",
              body: "Bring all your repayment dates into one clear calendar.",
            },
            {
              icon: ReceiptText,
              n: "03",
              title: "Keep a paper trail",
              body: "Save payments, attach evidence, and export your records.",
            },
          ].map(({ icon: Icon, n, title, body }) => (
            <article className="card" key={n}>
              <div className="feature-top">
                <Icon size={23} />
                <span>{n}</span>
              </div>
              <h2>{title}</h2>
              <p>{body}</p>
            </article>
          ))}
        </div>
        <div className="notice landing-note">
          A Philippine Credit Transactions project, built for everyday
          recordkeeping. LoanLens does not calculate a legally verified
          settlement amount.
        </div>
      </main>
      <footer className="landing-footer">
        LoanLens · Understand. Compare. Keep track.
      </footer>
    </div>
  );
}
