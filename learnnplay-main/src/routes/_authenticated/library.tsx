import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { AppShell, Card } from "@/components/AppShell";
import { LangText } from "@/components/Lang";
import { useQueryClient } from "@tanstack/react-query";
import {
  deleteQuiz,
  isStale,
  localized,
  startLiveSession,
  useOrgId,
  useQuizzes,
  type Quiz,
} from "@/lib/learnplay";
import { getLang, LANGUAGES, sessionLangs, STATUS_LABEL, type TranslationStatus } from "@/lib/i18n";

function quizStatuses(quiz: Quiz): Set<TranslationStatus> {
  const [, l2] = sessionLangs(quiz.languages);
  const out = new Set<TranslationStatus>();
  if (!l2) return out;
  quiz.questions.forEach((q) => {
    out.add(isStale(q, l2) ? "needs_update" : (q.translations?.[l2]?.status ?? "not_translated"));
  });
  return out;
}

export const Route = createFileRoute("/_authenticated/library")({
  head: () => ({
    meta: [
      { title: "Question library — LearnNPlay" },
      {
        name: "description",
        content: "Every quiz and question you have created, ready to reuse in a live session.",
      },
      { property: "og:title", content: "Question library — LearnNPlay" },
      {
        property: "og:description",
        content: "Reuse saved quizzes and question banks across your training sessions.",
      },
    ],
  }),
  component: LibraryPage,
});

function LibraryPage() {
  const { quizzes, loading } = useQuizzes();
  const hydrated = true;
  const orgId = useOrgId();
  const qc = useQueryClient();
  const navigate = useNavigate();
  const [fLang, setFLang] = useState("");
  const [fPrimary, setFPrimary] = useState("");
  const [fSecondary, setFSecondary] = useState("");
  const [fBilingual, setFBilingual] = useState(false);
  const [fStatus, setFStatus] = useState("");

  const filtered = quizzes.filter((quiz) => {
    const langs = sessionLangs(quiz.languages);
    if (fLang && !langs.includes(fLang)) return false;
    if (fPrimary && langs[0] !== fPrimary) return false;
    if (fSecondary && langs[1] !== fSecondary) return false;
    if (fBilingual && langs.length < 2) return false;
    if (fStatus && !quizStatuses(quiz).has(fStatus as TranslationStatus)) return false;
    return true;
  });
  const sel = "rounded-xl border border-border bg-surface px-3 py-2 text-sm";
  const langOpts = LANGUAGES.map((l) => (
    <option key={l.code} value={l.code}>
      {l.name}
    </option>
  ));

  return (
    <AppShell
      subtitle="Question bank"
      title="Library"
      action={
        <Link
          to="/create"
          className="rounded-2xl bg-primary px-5 py-3 text-sm font-semibold text-primary-foreground shadow-brand"
        >
          New quiz
        </Link>
      }
    >
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <select
          aria-label="Language"
          value={fLang}
          onChange={(e) => setFLang(e.target.value)}
          className={sel}
        >
          <option value="">Any language</option>
          {langOpts}
        </select>
        <select
          aria-label="Primary language"
          value={fPrimary}
          onChange={(e) => setFPrimary(e.target.value)}
          className={sel}
        >
          <option value="">Any primary</option>
          {langOpts}
        </select>
        <select
          aria-label="Secondary language"
          value={fSecondary}
          onChange={(e) => setFSecondary(e.target.value)}
          className={sel}
        >
          <option value="">Any secondary</option>
          {langOpts}
        </select>
        <select
          aria-label="Translation status"
          value={fStatus}
          onChange={(e) => setFStatus(e.target.value)}
          className={sel}
        >
          <option value="">Any status</option>
          {Object.entries(STATUS_LABEL).map(([k, v]) => (
            <option key={k} value={k}>
              {v}
            </option>
          ))}
        </select>
        <label className="flex items-center gap-2 text-sm font-medium">
          <input
            type="checkbox"
            checked={fBilingual}
            onChange={(e) => setFBilingual(e.target.checked)}
            className="accent-[var(--primary)]"
          />
          Bilingual only
        </label>
      </div>
      {loading ? <p className="text-sm text-muted-foreground">Loading…</p> : null}
      {!loading && filtered.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          {quizzes.length
            ? "No quizzes match these filters."
            : "Your library is empty — create a quiz from a deck."}
        </p>
      ) : null}
      <div className="grid gap-4 md:grid-cols-2">
        {filtered.map((quiz) => (
          <Card key={quiz.id}>
            <div className="grid grid-cols-[minmax(0,1fr)_auto] items-start gap-3">
              <div className="min-w-0">
                <h2 className="truncate font-display text-lg font-bold">{quiz.title}</h2>
                <p className="truncate text-xs text-muted-foreground">
                  {quiz.questions.length} questions · from {quiz.source} ·{" "}
                  {sessionLangs(quiz.languages)
                    .map((l) => getLang(l).name)
                    .join(" + ")}
                </p>
              </div>
              <span className="shrink-0 rounded-full bg-secondary px-3 py-1 text-xs font-semibold">
                {hydrated ? new Date(quiz.createdAt).toLocaleDateString() : ""}
              </span>
            </div>

            <ul className="mt-4 space-y-2">
              {quiz.questions.slice(0, 3).map((q, i) => (
                <li key={q.id} className="rounded-xl border border-border bg-background p-3">
                  <p className="text-sm font-semibold">
                    {i + 1}. {q.prompt}
                  </p>
                  {sessionLangs(quiz.languages)[1] ? (
                    <LangText
                      as="p"
                      lang={
                        localized(
                          q,
                          sessionLangs(quiz.languages)[1]!,
                          sessionLangs(quiz.languages)[0]!,
                        ).lang
                      }
                      className="text-xs text-muted-foreground"
                    >
                      {
                        localized(
                          q,
                          sessionLangs(quiz.languages)[1]!,
                          sessionLangs(quiz.languages)[0]!,
                        ).prompt
                      }
                    </LangText>
                  ) : null}
                  <p className="mt-1 text-xs text-mint">
                    Correct: {q.options[q.correct]} · {q.seconds}s
                  </p>
                </li>
              ))}
              {quiz.questions.length > 3 ? (
                <li className="text-xs text-muted-foreground">
                  +{quiz.questions.length - 3} more questions
                </li>
              ) : null}
            </ul>

            <div className="mt-4 flex flex-wrap gap-2">
              <button
                onClick={() => {
                  if (!orgId) return;
                  startLiveSession(orgId, quiz).then(() => {
                    qc.invalidateQueries({ queryKey: ["active-session"] });
                    navigate({ to: "/host" });
                  });
                }}
                className="rounded-2xl bg-ink px-4 py-2.5 text-sm font-bold text-ink-foreground"
              >
                Go live
              </button>
              <button
                onClick={async () => {
                  if (!confirm(`Delete "${quiz.title}"?`)) return;
                  await deleteQuiz(quiz.id);
                  qc.invalidateQueries({ queryKey: ["quizzes"] });
                }}
                className="rounded-2xl border border-border px-4 py-2.5 text-sm font-semibold text-muted-foreground hover:text-destructive"
              >
                Delete
              </button>
            </div>
          </Card>
        ))}
      </div>
    </AppShell>
  );
}
