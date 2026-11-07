import type { ReactNode } from "react";
import Link from "next/link";
import { ArrowUpRight, Info, Search } from "lucide-react";

export function Brand() {
  return (
    <Link href="/" className="brand">
      <span className="brand-icon">
        <Search size={20} />
      </span>
      LoanLens<span className="brand-dot">.</span>
    </Link>
  );
}
export function PageHeading({
  eyebrow,
  title,
  description,
  action,
}: {
  eyebrow: string;
  title: string;
  description: string;
  action?: ReactNode;
}) {
  return (
    <header className="page-heading">
      <div>
        <div className="eyebrow">{eyebrow}</div>
        <h1>{title}</h1>
        <p>{description}</p>
      </div>
      {action}
    </header>
  );
}
export function Badge({
  children,
  tone = "neutral",
}: {
  children: ReactNode;
  tone?: "neutral" | "green" | "amber" | "red";
}) {
  return <span className={`badge ${tone}`}>{children}</span>;
}
export function Notice({ children }: { children: ReactNode }) {
  return (
    <div className="notice">
      <Info size={18} aria-hidden="true" />
      <div>{children}</div>
    </div>
  );
}
export function Empty({
  title,
  body,
  href,
  label,
}: {
  title: string;
  body: string;
  href?: string;
  label?: string;
}) {
  return (
    <div className="empty">
      <span className="empty-icon">
        <Search size={26} />
      </span>
      <h3>{title}</h3>
      <p>{body}</p>
      {href && (
        <Link className="button primary" href={href}>
          {label}
          <ArrowUpRight size={16} />
        </Link>
      )}
    </div>
  );
}
export function Field({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: ReactNode;
}) {
  return (
    <label className="field">
      <span>{label}</span>
      {children}
      {hint && <small>{hint}</small>}
    </label>
  );
}
export function Status({ message, ok }: { message: string; ok?: boolean }) {
  return message ? (
    <div
      role={ok ? "status" : "alert"}
      className={`form-message ${ok ? "success" : "failure"}`}
    >
      {message}
    </div>
  ) : null;
}
