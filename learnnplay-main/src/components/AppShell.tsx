import { Link } from "@tanstack/react-router";
import type { ReactNode } from "react";
import { supabase } from "@/integrations/supabase/client";

const NAV = [
  { to: "/dashboard", label: "Dashboard", short: "Home" },
  { to: "/create", label: "Create", short: "Create" },
  { to: "/library", label: "Library", short: "Library" },
  { to: "/templates", label: "Team templates", short: "Teams" },
  { to: "/analytics", label: "Analytics", short: "Stats" },
] as const;

export function AppShell({
  title,
  subtitle,
  action,
  children,
}: {
  title: string;
  subtitle?: string;
  action?: ReactNode;
  children: ReactNode;
}) {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <div className="mx-auto flex max-w-7xl">
        {/* Desktop sidebar */}
        <aside className="sticky top-0 hidden h-screen w-60 shrink-0 flex-col gap-1 border-r border-border bg-surface px-4 py-5 md:flex">
          <Link to="/" className="flex items-center gap-2.5 px-2 py-2">
            <span className="grid size-9 place-items-center rounded-xl bg-primary font-display text-lg font-bold text-primary-foreground">
              L
            </span>
            <span className="font-display text-lg font-bold tracking-tight">LearnNPlay</span>
          </Link>
          <nav className="mt-5 flex flex-col gap-1">
            {NAV.map((item) => (
              <Link
                key={item.to}
                to={item.to}
                className="rounded-xl px-3 py-2.5 text-sm font-medium text-muted-foreground transition-colors hover:bg-secondary"
                activeProps={{ className: "bg-ink text-ink-foreground font-semibold" }}
              >
                {item.label}
              </Link>
            ))}
          </nav>
          <div className="mt-auto rounded-2xl border border-border bg-background p-3">
            <p className="text-xs text-muted-foreground">Participants join at</p>
            <Link to="/join" className="font-display text-base font-bold text-primary">
              /join
            </Link>
            <button
              onClick={() => supabase.auth.signOut()}
              className="mt-3 block text-xs font-semibold text-muted-foreground hover:text-foreground"
            >
              Sign out
            </button>
          </div>
        </aside>

        {/* Main */}
        <div className="min-w-0 flex-1 pb-24 md:pb-0">
          <header className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-4 px-5 py-5 sm:flex sm:flex-wrap sm:justify-between md:px-8">
            <div className="min-w-0">
              {subtitle ? (
                <p className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                  {subtitle}
                </p>
              ) : null}
              <h1 className="truncate font-display text-2xl font-bold md:text-3xl">{title}</h1>
            </div>
            <div className="shrink-0">{action}</div>
          </header>
          <main className="px-5 pb-12 md:px-8">{children}</main>
        </div>
      </div>

      {/* Mobile bottom nav */}
      <nav className="fixed inset-x-0 bottom-0 z-20 grid grid-cols-5 border-t border-border bg-surface md:hidden">
        {NAV.map((item) => (
          <Link
            key={item.to}
            to={item.to}
            className="py-3 text-center text-xs font-medium text-muted-foreground"
            activeProps={{ className: "text-primary font-bold" }}
          >
            {item.short}
          </Link>
        ))}
      </nav>
    </div>
  );
}

export function Card({ children, className = "" }: { children: ReactNode; className?: string }) {
  return (
    <div className={`rounded-3xl border border-border bg-card p-6 ${className}`}>{children}</div>
  );
}
