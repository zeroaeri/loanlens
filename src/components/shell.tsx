"use client";
import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import {
  LayoutDashboard,
  Files,
  GitCompareArrows,
  CalendarDays,
  BookOpen,
  Settings2,
  LogOut,
  ArrowUpRight,
  ShieldCheck,
} from "lucide-react";
import type { ReactNode } from "react";
import { Brand } from "./ui";
import { signOut } from "@/app/actions";

export function Shell({
  children,
  email,
  demo = false,
}: {
  children: ReactNode;
  email?: string;
  demo?: boolean;
}) {
  const path = usePathname(),
    search = useSearchParams();
  const items = [
    { href: "/dashboard", label: "Overview", icon: LayoutDashboard },
    { href: "/offers", label: "My records", icon: Files },
    { href: "/compare", label: "Compare offers", icon: GitCompareArrows },
    { href: "/calendar", label: "Repayment calendar", icon: CalendarDays },
    { href: "/learn", label: "The fine print", icon: BookOpen },
  ];
  const activeHref = demo ? `/${search.get("view") ?? "dashboard"}` : path;
  return (
    <div className="app-shell">
      <aside className="sidebar">
        <Brand />
        <div className="workspace-label">YOUR MONEY, IN FOCUS</div>
        <nav aria-label="Main navigation">
          {items.map(({ href, label, icon: Icon }) => (
            <Link
              key={href}
              href={
                demo
                  ? href === "/learn"
                    ? "/learn"
                    : `/demo${href === "/dashboard" ? "" : `?view=${href.slice(1)}`}`
                  : href
              }
              aria-current={activeHref === href ? "page" : undefined}
              className={activeHref === href ? "nav-item selected" : "nav-item"}
            >
              <Icon size={19} />
              {label}
            </Link>
          ))}
        </nav>
        <div className="sidebar-bottom">
          <div className="privacy-note">
            <ShieldCheck size={22} />
            <strong>A little clarity goes a long way.</strong>
            <p>
              Your terms. Your timeline.
              <br />
              Your records, together.
            </p>
          </div>
          {!demo && (
            <Link href="/settings" className="nav-item">
              <Settings2 size={18} />
              Account
            </Link>
          )}
          <div className="profile">
            <span className="avatar">
              {demo ? "D" : (email?.[0] ?? "Y").toUpperCase()}
            </span>
            <div>
              <strong>{demo ? "Demo workspace" : "Personal workspace"}</strong>
              <small>{demo ? "Fictional presentation data" : email}</small>
            </div>
            {!demo && (
              <form action={signOut}>
                <button className="icon-button" aria-label="Sign out">
                  <LogOut size={17} />
                </button>
              </form>
            )}
          </div>
        </div>
      </aside>
      <div className="main-wrap">
        <div className="topbar">
          <span>
            Personal loan workspace <span className="topbar-divider">/</span>{" "}
            <b>Philippines</b>
          </span>
          <span className="currency-indicator">
            PHP <span>₱</span>
          </span>
        </div>
        {demo && (
          <div className="demo-banner">
            <span>
              <strong>DEMO</strong> Fictional data · explore without an account.
              Changes are not saved here.
            </span>
            <Link href="/auth">
              Create your workspace <ArrowUpRight size={15} />
            </Link>
          </div>
        )}
        <main id="main-content" className="main-content">
          {children}
        </main>
        <footer className="app-footer">
          <span>
            LoanLens <span className="footer-dot">•</span> A clearer view of
            borrowing.
          </span>
          <span>User-entered records · No lender verification</span>
        </footer>
      </div>
    </div>
  );
}
