import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import QRCode from "qrcode";
import { AppShell, Card } from "@/components/AppShell";
import { LangText } from "@/components/Lang";
import {
  advanceSession,
  answerCounts,
  localized,
  ranked,
  updateLiveSession,
  useActiveHostSession,
  useCountdown,
  useLiveSession,
  useQuizzes,
  visibleLangs,
} from "@/lib/learnplay";
import { TeamLeaderboard, TeamPanel } from "@/components/TeamPanel";
import { TeamBadge } from "@/components/TeamBadge";
import { gami, teamStandings, teamStreak } from "@/lib/teams";
import { DISPLAY_MODES, getLang, sessionLangs } from "@/lib/i18n";

export const Route = createFileRoute("/_authenticated/host")({
  head: () => ({
    meta: [
      { title: "Live control panel — LearnNPlay" },
      {
        name: "description",
        content:
          "Run the live session: share the PIN or QR code, reveal answers and watch the leaderboard.",
      },
      { property: "og:title", content: "Live control panel — LearnNPlay" },
      {
        property: "og:description",
        content: "Projector-ready live quiz screen with real-time answers and scores.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: HostPage,
});

function HostPage() {
  const qc = useQueryClient();
  const active = useActiveHostSession();
  const { quizzes } = useQuizzes();
  const [sessionId, setSessionId] = useState<string | null>(null);
  useEffect(() => {
    if (active.data?.id) setSessionId(active.data.id);
  }, [active.data?.id]);
  const { session, participants, responses } = useLiveSession(sessionId, { withResponses: true });
  const quiz = quizzes.find((q) => q.id === session?.quizId) ?? null;
  const question = session && quiz ? quiz.questions[session.index] : null;
  const left = useCountdown(
    session?.questionStartedAt ?? 0,
    question?.seconds ?? 20,
    session?.status === "question",
  );
  const [qr, setQr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const joinUrl =
    typeof window !== "undefined" && session
      ? `${window.location.origin}/join?pin=${session.pin}`
      : "";

  useEffect(() => {
    if (!joinUrl) return;
    QRCode.toDataURL(joinUrl, { margin: 1, width: 240 })
      .then(setQr)
      .catch(() => setQr(null));
  }, [joinUrl]);

  if (active.isLoading || (sessionId && !session)) {
    return (
      <AppShell subtitle="Live session" title="Loading…">
        {null}
      </AppShell>
    );
  }

  if (!session || !quiz) {
    return (
      <AppShell subtitle="Live session" title="No session running">
        <Card>
          <p className="text-sm text-muted-foreground">
            Start a session from your library and the control panel will open here.
          </p>
          <Link
            to="/library"
            className="mt-4 inline-block rounded-2xl bg-primary px-5 py-3 text-sm font-bold text-primary-foreground"
          >
            Open library
          </Link>
        </Card>
      </AppShell>
    );
  }

  const board = ranked(participants);
  const langs = sessionLangs(session.languages);
  const base = langs[0]!;
  const shown = visibleLangs(session);
  const counts = question ? answerCounts(responses, session.index, question.options.length) : [];
  const answered = counts.reduce((a, b) => a + b, 0);
  const totalAnswers = answered || 1;
  const g = gami(session.gamification);
  const teamMode = session.competitionMode !== "individual" && session.teams.length > 0;
  const standings = teamMode
    ? teamStandings(session.teams, participants, session.teamSettings.scoring)
    : [];
  const lastQ = session.status === "question" ? session.index - 1 : session.index;
  const streaks = Object.fromEntries(
    standings.map((t) => [
      t.id,
      teamStreak(
        t.id,
        new Set(participants.filter((p) => p.team === t.id).map((p) => p.id)),
        responses,
        lastQ,
      ),
    ]),
  );
  const hotTeam =
    g.celebrations && session.status === "reveal"
      ? standings.find((t) => (streaks[t.id] ?? 0) >= 3)
      : undefined;
  const showIndividual = session.competitionMode !== "team" && g.individualLeaderboard;

  const actionLabel =
    session.status === "lobby"
      ? "Start quiz"
      : session.status === "question"
        ? "Reveal answer"
        : session.index + 1 >= quiz.questions.length
          ? "Finish session"
          : "Next question";

  async function act() {
    if (!session || !quiz) return;
    setBusy(true);
    try {
      await advanceSession(session, quiz);
    } finally {
      setBusy(false);
    }
  }

  return (
    <AppShell
      subtitle="Live control panel"
      title={quiz.title}
      action={
        session.status === "ended" ? (
          <div className="flex gap-2">
            <Link
              to="/analytics"
              className="rounded-2xl bg-primary px-5 py-3 text-sm font-bold text-primary-foreground"
            >
              View report
            </Link>
            <button
              onClick={() => {
                setSessionId(null);
                qc.invalidateQueries({ queryKey: ["active-session"] });
              }}
              className="rounded-2xl border border-border bg-surface px-5 py-3 text-sm font-semibold"
            >
              Close
            </button>
          </div>
        ) : (
          <button
            disabled={busy}
            onClick={act}
            className="rounded-2xl bg-primary px-5 py-3 text-sm font-bold text-primary-foreground shadow-brand transition-colors hover:bg-primary-deep disabled:opacity-50"
          >
            {actionLabel}
          </button>
        )
      }
    >
      <div className="grid gap-5 lg:grid-cols-3">
        <div className="space-y-5 lg:col-span-2">
          <div className="flex flex-wrap items-center gap-3 rounded-3xl bg-ink p-5 text-ink-foreground">
            <div className="rounded-2xl bg-surface/10 px-4 py-3">
              <p className="text-xs text-ink-foreground/50">Join PIN</p>
              <p className="font-display text-3xl font-bold tracking-[0.2em]">{session.pin}</p>
            </div>
            <div className="rounded-2xl bg-surface/10 px-4 py-3">
              <p className="text-xs text-ink-foreground/50">Joined</p>
              <p className="font-display text-3xl font-bold">{participants.length}</p>
            </div>
            <div className="rounded-2xl bg-surface/10 px-4 py-3">
              <p className="text-xs text-ink-foreground/50">Answered</p>
              <p className="font-display text-3xl font-bold">
                {session.status === "lobby" ? "—" : answered}
              </p>
            </div>
            {langs.length > 1 ? (
              <div className="flex flex-wrap gap-1 rounded-2xl bg-surface/10 p-1">
                {DISPLAY_MODES.map((m) => (
                  <button
                    key={m.id}
                    onClick={() => updateLiveSession(session.id, { display_mode: m.id })}
                    className={`rounded-xl px-2.5 py-1.5 text-xs font-semibold ${
                      session.displayMode === m.id
                        ? "bg-primary text-primary-foreground"
                        : "text-ink-foreground/70"
                    }`}
                  >
                    {m.id === "l1"
                      ? getLang(langs[0]).name
                      : m.id === "l2"
                        ? getLang(langs[1]).name
                        : m.id === "both"
                          ? "Both"
                          : "Their choice"}
                  </button>
                ))}
              </div>
            ) : null}
          </div>

          {session.status === "lobby" ? (
            <Card>
              <div className="grid gap-5 sm:grid-cols-[auto_minmax(0,1fr)]">
                {qr ? (
                  <img
                    src={qr}
                    alt={`QR code to join with PIN ${session.pin}`}
                    className="size-44 rounded-2xl border border-border"
                  />
                ) : null}
                <div className="min-w-0">
                  <h2 className="font-display text-lg font-bold">Waiting room</h2>
                  <p className="mt-1 text-sm text-muted-foreground">
                    Scan the QR code or open{" "}
                    <span className="font-semibold text-foreground break-all">
                      {joinUrl.replace(/^https?:\/\//, "").split("?")[0]}
                    </span>{" "}
                    and enter PIN {session.pin}.
                  </p>
                  <label className="mt-3 flex items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      className="accent-[var(--primary)]"
                      checked={session.allowLanguageChange}
                      onChange={(e) =>
                        updateLiveSession(session.id, { allow_language_change: e.target.checked })
                      }
                    />
                    Participants can switch language
                  </label>
                  <div className="mt-4 flex flex-wrap gap-2">
                    {participants.length === 0 ? (
                      <p className="text-sm text-muted-foreground">Nobody has joined yet.</p>
                    ) : (
                      participants.map((p) => (
                        <span
                          key={p.id}
                          className="rise-in rounded-full border border-border bg-background px-3 py-2 text-sm font-semibold"
                        >
                          {p.avatar} {p.name}
                          {langs.length > 1 && p.lang ? (
                            <span className="ml-1.5 text-[10px] font-bold uppercase text-muted-foreground">
                              {p.lang}
                            </span>
                          ) : null}
                        </span>
                      ))
                    )}
                  </div>
                </div>
              </div>
            </Card>
          ) : null}

          {session.status !== "ended" ? (
            <TeamPanel session={session} participants={participants} />
          ) : null}

          {hotTeam ? (
            <div className="rise-in flex items-center gap-3 rounded-3xl bg-sun/20 p-4 font-display font-bold">
              🔥 <TeamBadge team={hotTeam} /> has answered {streaks[hotTeam.id]} questions correctly
              in a row!
            </div>
          ) : null}

          {question && session.status !== "ended" && session.status !== "lobby" ? (
            <Card>
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                  Question {session.index + 1} of {quiz.questions.length}
                </span>
                <span className="rounded-full bg-ink px-3 py-1.5 font-display text-sm font-bold tabular-nums text-ink-foreground">
                  {session.status === "question"
                    ? `00:${String(left).padStart(2, "0")}`
                    : "Revealed"}
                </span>
              </div>
              <div className="mt-4 space-y-3">
                {shown.map((lang, li) => {
                  const t = localized(question, lang, base);
                  return (
                    <div key={lang} className={li > 0 ? "border-t border-border pt-3" : ""}>
                      {shown.length > 1 ? (
                        <p className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground">
                          {getLang(lang).name}
                        </p>
                      ) : null}
                      <LangText
                        as="h2"
                        lang={t.lang}
                        className={`font-bold leading-tight ${li === 0 ? "text-2xl md:text-3xl" : "text-xl text-muted-foreground md:text-2xl"}`}
                      >
                        {t.prompt}
                      </LangText>
                    </div>
                  );
                })}
              </div>

              <div className="mt-6 space-y-3">
                {question.options.map((opt, i) => {
                  const pct = Math.round(((counts[i] ?? 0) / totalAnswers) * 100);
                  const isCorrect = session.status === "reveal" && i === question.correct;
                  return (
                    <div key={i}>
                      <div className="mb-1.5 flex items-center justify-between gap-3 text-sm font-medium">
                        <span className={`min-w-0 ${isCorrect ? "font-bold text-mint" : ""}`}>
                          {String.fromCharCode(65 + i)} ·{" "}
                          {shown.map((lang, li) => {
                            const t = localized(question, lang, base);
                            return (
                              <span key={lang}>
                                {li > 0 ? <span className="text-muted-foreground"> / </span> : null}
                                <LangText lang={t.lang}>{t.options[i] ?? opt}</LangText>
                              </span>
                            );
                          })}
                        </span>
                        <span className="shrink-0 tabular-nums text-muted-foreground">
                          {session.status === "reveal" ? `${pct}%` : `${counts[i] ?? 0}`}
                        </span>
                      </div>
                      <div className="h-3 overflow-hidden rounded-full bg-secondary">
                        <div
                          className={`grow-bar h-full rounded-full ${isCorrect ? "bg-mint" : "bg-primary"}`}
                          style={{
                            width: `${session.status === "reveal" ? pct : Math.min(100, (counts[i] ?? 0) * 12)}%`,
                          }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
              {session.status === "reveal"
                ? shown.map((lang) => {
                    const t = localized(question, lang, base);
                    return t.explanation ? (
                      <LangText
                        key={lang}
                        as="p"
                        lang={t.lang}
                        className="mt-4 block rounded-xl bg-mint/10 p-3 text-sm"
                      >
                        {t.explanation}
                      </LangText>
                    ) : null;
                  })
                : null}
            </Card>
          ) : null}

          {session.status === "ended" ? (
            <Card>
              <h2 className="font-display text-2xl font-bold">🎉 Session complete</h2>
              <p className="mt-1 text-sm text-muted-foreground">
                {participants.length} participants · {quiz.questions.length} questions
              </p>
              {teamMode && g.podium && standings[0] ? (
                <div className="mt-4 rounded-3xl bg-ink p-6 text-center text-ink-foreground">
                  <p className="text-sm font-semibold uppercase tracking-widest text-ink-foreground/60">
                    Congratulations!
                  </p>
                  <div className="mt-3">
                    <TeamBadge team={standings[0]} number={standings[0].number} size="lg" />
                  </div>
                  <p className="mt-3 font-display text-2xl font-bold">
                    wins with {standings[0].points} points
                  </p>
                  <p className="text-sm text-ink-foreground/60">
                    {standings[0].accuracy}% accuracy · {standings[0].members} players
                  </p>
                </div>
              ) : null}
              {teamMode ? (
                <div className="mt-4">
                  <TeamLeaderboard standings={standings} streaks={streaks} />
                </div>
              ) : null}
              <div
                className={`mt-4 grid gap-3 sm:grid-cols-3 ${session.competitionMode === "team" || !g.podium ? "hidden" : ""}`}
              >
                {board.slice(0, 3).map((p, i) => (
                  <div
                    key={p.id}
                    className={`rounded-2xl p-4 text-center ${i === 0 ? "bg-sun text-accent-foreground" : "bg-secondary"}`}
                  >
                    <p className="text-3xl">{p.avatar}</p>
                    <p className="mt-1 truncate font-display font-bold">{p.name}</p>
                    <p className="text-sm tabular-nums">{p.score} pts</p>
                  </div>
                ))}
              </div>
            </Card>
          ) : null}
        </div>

        <div className="space-y-5">
          {teamMode && g.teamLeaderboard ? (
            <Card>
              <div className="flex items-center justify-between">
                <h2 className="font-display text-lg font-bold">Live team score</h2>
                <span className="text-xs font-semibold text-mint">Live</span>
              </div>
              <div className="mt-4">
                <TeamLeaderboard standings={standings} streaks={streaks} />
              </div>
            </Card>
          ) : null}
          {showIndividual ? (
            <Card>
              <div className="flex items-center justify-between">
                <h2 className="font-display text-lg font-bold">Leaderboard</h2>
                <span className="text-xs font-semibold text-mint">Live</span>
              </div>
              <div className="mt-4 space-y-2">
                {board.length === 0 ? (
                  <p className="text-sm text-muted-foreground">Scores appear once people answer.</p>
                ) : (
                  board.slice(0, 10).map((p, i) => (
                    <div
                      key={p.id}
                      className={`flex items-center gap-3 rounded-2xl px-3 py-2.5 ${i === 0 ? "bg-mint/15" : "bg-background"}`}
                    >
                      <span className="w-4 font-display font-bold text-muted-foreground">
                        {i + 1}
                      </span>
                      <span className="text-lg">{p.avatar}</span>
                      <span className="min-w-0 flex-1 truncate text-sm font-semibold">
                        {p.name}
                      </span>
                      {langs.length > 1 && p.lang ? (
                        <span className="text-[10px] font-bold uppercase text-muted-foreground">
                          {p.lang}
                        </span>
                      ) : null}
                      {(p.streak ?? 0) >= 2 ? (
                        <span className="text-xs font-bold">🔥{p.streak}</span>
                      ) : null}
                      <span className="font-display font-bold tabular-nums">{p.score}</span>
                    </div>
                  ))
                )}
              </div>
            </Card>
          ) : null}
        </div>
      </div>
    </AppShell>
  );
}
