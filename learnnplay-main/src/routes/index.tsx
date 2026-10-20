import { createFileRoute, Link } from "@tanstack/react-router";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "LearnNPlay — Turn any deck into a live quiz" },
      {
        name: "description",
        content:
          "Upload a PPT or PDF, let AI draft the questions, and run a scored, bilingual live training session your team actually remembers.",
      },
      { property: "og:title", content: "LearnNPlay — Turn any deck into a live quiz" },
      {
        property: "og:description",
        content: "AI-generated quizzes, live PIN join, leaderboards and analytics for L&D teams.",
      },
    ],
  }),
  component: Landing,
});

function Landing() {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-6 py-5">
        <div className="flex min-w-0 items-center gap-2.5">
          <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-primary font-display text-lg font-bold text-primary-foreground">
            L
          </span>
          <span className="truncate font-display text-lg font-bold tracking-tight">LearnNPlay</span>
          <span className="ml-1 hidden rounded-full bg-primary/10 px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wider text-primary sm:inline">
            Trainer
          </span>
        </div>
        <nav className="hidden items-center gap-7 text-sm font-medium text-muted-foreground md:flex">
          <Link to="/dashboard">Dashboard</Link>
          <Link to="/create">Create</Link>
          <Link to="/library">Library</Link>
          <Link to="/analytics">Analytics</Link>
        </nav>
        <Link
          to="/join"
          className="shrink-0 rounded-full border border-border bg-surface px-3.5 py-2 text-sm font-semibold"
        >
          Join a session
        </Link>
      </header>

      <section className="mx-auto max-w-6xl px-6 pb-14 pt-10">
        <div className="flex items-center gap-2 text-sm font-semibold text-mint">
          <span className="pulse-dot size-2 rounded-full bg-mint" />
          Live session in progress · 42 joined
        </div>
        <h1 className="mt-5 max-w-3xl font-display text-[clamp(2.4rem,6vw,4.6rem)] font-bold leading-[1.02]">
          Turn any deck into a <span className="text-primary">live quiz</span> your team actually
          remembers.
        </h1>
        <p className="mt-5 max-w-xl text-lg text-muted-foreground">
          Upload a PPT or PDF, let AI build the questions, and run a scored, bilingual session — no
          slides to babysit.
        </p>
        <div className="mt-8 flex flex-wrap items-center gap-4">
          <Link
            to="/create"
            className="rounded-2xl bg-primary px-7 py-4 text-base font-semibold text-primary-foreground shadow-brand transition-colors hover:bg-primary-deep"
          >
            Start a live session
          </Link>
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <span className="grid size-9 place-items-center rounded-lg border border-border bg-surface font-display font-bold text-primary">
              QR
            </span>
            or join with PIN
            <Link
              to="/join"
              className="rounded-lg border border-border bg-surface px-2.5 py-1.5 font-display font-bold tracking-widest text-foreground"
            >
              4829
            </Link>
          </div>
        </div>
      </section>

      <section className="mx-auto grid max-w-6xl gap-5 px-6 pb-16 md:grid-cols-3">
        <div className="flex flex-col rounded-3xl border border-border bg-card p-6">
          <div className="grid size-11 place-items-center rounded-2xl bg-primary/10 font-display text-lg font-bold text-primary">
            1
          </div>
          <h3 className="mt-4 font-display text-xl font-bold">Upload &amp; auto-quiz</h3>
          <p className="mt-1.5 text-sm text-muted-foreground">
            Drop a deck, get 12 questions in 20 seconds.
          </p>
          <div className="mt-5 rounded-2xl border border-border bg-background p-4">
            <div className="flex items-center gap-3">
              <div className="grid size-10 shrink-0 place-items-center rounded-lg border border-border bg-surface text-xs font-bold text-muted-foreground">
                PPT
              </div>
              <div className="min-w-0 flex-1">
                <div className="truncate text-sm font-semibold">Q3-Onboarding.pptx</div>
                <div className="text-xs text-muted-foreground">18 slides · 4.2 MB</div>
              </div>
              <span className="shrink-0 rounded-full bg-mint/10 px-2 py-1 text-xs font-semibold text-mint">
                Ready
              </span>
            </div>
            <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-border">
              <div className="grow-bar h-full w-[85%] rounded-full bg-primary" />
            </div>
            <div className="mt-2 text-xs text-muted-foreground">AI generating 12 questions…</div>
          </div>
        </div>

        <div className="flex flex-col rounded-3xl border border-border bg-card p-6">
          <div className="grid size-11 place-items-center rounded-2xl bg-sun/15 font-display text-lg font-bold text-sun">
            2
          </div>
          <h3 className="mt-4 font-display text-xl font-bold">Join by PIN or QR</h3>
          <p className="mt-1.5 text-sm text-muted-foreground">
            Participants tap in from any phone.
          </p>
          <div className="mt-5 flex items-center gap-4 rounded-2xl border border-border bg-background p-4">
            <div className="grid size-24 shrink-0 place-items-center rounded-xl border border-border bg-surface">
              <QrMark />
            </div>
            <div className="min-w-0">
              <div className="text-xs text-muted-foreground">Session PIN</div>
              <div className="font-display text-3xl font-bold tracking-[0.25em]">4829</div>
              <div className="mt-1 truncate text-xs text-muted-foreground">learnnplay.app/join</div>
            </div>
          </div>
        </div>

        <div className="flex flex-col rounded-3xl border border-border bg-card p-6">
          <div className="grid size-11 place-items-center rounded-2xl bg-mint/15 font-display text-lg font-bold text-mint">
            3
          </div>
          <h3 className="mt-4 font-display text-xl font-bold">Leaderboard &amp; analytics</h3>
          <p className="mt-1.5 text-sm text-muted-foreground">
            Live scores and post-session insight.
          </p>
          <div className="mt-5 space-y-2.5">
            {[
              ["1", "Nadia R.", "1,240"],
              ["2", "Tanvir H.", "1,180"],
              ["3", "Sofia M.", "990"],
            ].map(([rank, name, score]) => (
              <div key={rank} className="flex items-center gap-3">
                <span className="w-4 font-display text-sm font-bold text-muted-foreground">
                  {rank}
                </span>
                <span className="flex-1 truncate text-sm font-semibold">{name}</span>
                <span className="text-xs font-bold text-muted-foreground">{score}</span>
              </div>
            ))}
          </div>
          <div className="mt-4 flex h-14 items-end gap-1.5">
            {[40, 60, 45, 90, 70].map((h, i) => (
              <div
                key={i}
                className="flex-1 rounded-t-md bg-primary"
                style={{ height: `${h}%`, opacity: 0.3 + h / 180 }}
              />
            ))}
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-6 pb-16">
        <div className="flex flex-col justify-between gap-6 rounded-3xl bg-ink p-8 text-ink-foreground md:flex-row md:items-center">
          <div>
            <div className="text-xs font-semibold uppercase tracking-widest text-sun">
              Bilingual by default
            </div>
            <div className="mt-2 font-display text-2xl font-bold">Every question, two languages.</div>
          </div>
          <div className="flex flex-wrap items-center gap-4">
            <div className="rounded-2xl bg-surface/10 px-5 py-4">
              <div className="text-xs text-ink-foreground/50">English</div>
              <div className="font-semibold">What is the first step?</div>
            </div>
            <div className="bn rounded-2xl bg-surface/10 px-5 py-4">
              <div className="text-xs text-ink-foreground/50">বাংলা</div>
              <div className="font-semibold">প্রথম ধাপ কী?</div>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}

function QrMark() {
  const cells = [
    1, 1, 0, 1, 1, 1, 0, 2, 0, 1, 0, 0, 1, 0, 0, 1, 0, 0, 0, 1, 1, 1, 0, 1, 1,
  ];
  return (
    <div className="grid grid-cols-5 gap-1">
      {cells.map((c, i) => (
        <span
          key={i}
          className={`size-3 ${c === 1 ? "bg-ink" : c === 2 ? "bg-primary" : "bg-surface"}`}
        />
      ))}
    </div>
  );
}
