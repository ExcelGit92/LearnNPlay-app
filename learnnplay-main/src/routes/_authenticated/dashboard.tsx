import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { AppShell, Card } from "@/components/AppShell";
import { startLiveSession, useActiveHostSession, useOrgId, useQuizzes } from "@/lib/learnplay";

export const Route = createFileRoute("/_authenticated/dashboard")({
  head: () => ({
    meta: [
      { title: "Trainer dashboard — LearnNPlay" },
      {
        name: "description",
        content: "Your sessions, question library and AI-generated quizzes in one workspace.",
      },
      { property: "og:title", content: "Trainer dashboard — LearnNPlay" },
      {
        property: "og:description",
        content: "Run live quizzes, track participation and review results.",
      },
    ],
  }),
  component: Dashboard,
});

function Dashboard() {
  const { quizzes } = useQuizzes();
  const { data: session } = useActiveHostSession();
  const orgId = useOrgId();
  const hydrated = true;
  const navigate = useNavigate();

  const totalQuestions = quizzes.reduce((n, q) => n + q.questions.length, 0);

  return (
    <AppShell
      subtitle="Trainer console"
      title="Welcome back"
      action={
        <Link
          to="/create"
          className="rounded-2xl bg-primary px-5 py-3 text-sm font-semibold text-primary-foreground shadow-brand transition-colors hover:bg-primary-deep"
        >
          New quiz
        </Link>
      }
    >
      <div className="space-y-5">
        {hydrated && session && session.status !== "ended" ? (
          <div className="rise-in flex flex-col justify-between gap-4 rounded-3xl bg-ink p-6 text-ink-foreground md:flex-row md:items-center">
            <div className="min-w-0">
              <div className="flex items-center gap-2 text-sm font-semibold text-mint">
                <span className="pulse-dot size-2 rounded-full bg-mint" /> Live now
              </div>
              <p className="mt-1 truncate font-display text-xl font-bold">{session.title}</p>
              <p className="text-sm text-ink-foreground/60">PIN {session.pin}</p>
            </div>
            <Link
              to="/host"
              className="shrink-0 rounded-2xl bg-sun px-5 py-3 text-center text-sm font-bold text-accent-foreground"
            >
              Open control panel
            </Link>
          </div>
        ) : null}

        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          <Stat label="Quizzes" value={String(quizzes.length)} note="in your library" />
          <Stat label="Questions" value={String(totalQuestions)} note="AI-assisted" tone="mint" />
          <Stat
            label="Bilingual quizzes"
            value={String(quizzes.filter((q) => q.languages?.mode === "dual").length)}
            note="two languages"
            tone="sun"
          />
          <Stat
            label="Live now"
            value={session ? "1" : "0"}
            note={session ? `PIN ${session.pin}` : "no session running"}
          />
        </div>

        <div className="grid gap-4 lg:grid-cols-5">
          <Card className="lg:col-span-3">
            <div className="flex items-center justify-between">
              <h2 className="font-display text-lg font-bold">Your quizzes</h2>
              <Link to="/library" className="text-sm font-semibold text-primary">
                Library
              </Link>
            </div>
            <div className="mt-4 divide-y divide-border">
              {quizzes.length === 0 ? (
                <p className="py-3 text-sm text-muted-foreground">
                  No quizzes yet — upload a deck to create your first one.
                </p>
              ) : null}
              {quizzes.map((quiz) => (
                <div key={quiz.id} className="flex items-center gap-4 py-3">
                  <div className="grid size-10 shrink-0 place-items-center rounded-xl bg-primary/10 font-display font-bold text-primary">
                    Q
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold">{quiz.title}</p>
                    <p className="truncate text-xs text-muted-foreground">
                      {quiz.questions.length} questions · {quiz.source}
                    </p>
                  </div>
                  <button
                    onClick={() => {
                      if (!orgId) return;
                      startLiveSession(orgId, quiz).then(() => navigate({ to: "/host" }));
                    }}
                    className="shrink-0 rounded-full bg-ink px-4 py-2 text-xs font-bold text-ink-foreground"
                  >
                    Go live
                  </button>
                </div>
              ))}
            </div>
          </Card>

          <Card className="lg:col-span-2">
            <h2 className="font-display text-lg font-bold">Upload a deck</h2>
            <p className="mt-1.5 text-sm text-muted-foreground">
              PPT, PPTX or PDF. AI drafts the questions, you edit them.
            </p>
            <Link
              to="/create"
              className="mt-5 block rounded-2xl border-2 border-dashed border-border p-6 text-center"
            >
              <p className="font-display font-bold">Choose a file</p>
              <p className="mt-1 text-xs text-muted-foreground">.pptx or .pdf up to 50 MB</p>
            </Link>
            <Link
              to="/join"
              className="mt-4 block rounded-2xl bg-secondary px-4 py-3 text-center text-sm font-semibold"
            >
              Open the participant view
            </Link>
          </Card>
        </div>
      </div>
    </AppShell>
  );
}

function Stat({
  label,
  value,
  note,
  tone = "primary",
}: {
  label: string;
  value: string;
  note: string;
  tone?: "primary" | "mint" | "sun";
}) {
  const toneClass = tone === "mint" ? "text-mint" : tone === "sun" ? "text-sun" : "text-primary";
  return (
    <Card className="p-5">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="mt-1 font-display text-3xl font-bold">{value}</p>
      <p className={`mt-1 text-xs font-semibold ${toneClass}`}>{note}</p>
    </Card>
  );
}
