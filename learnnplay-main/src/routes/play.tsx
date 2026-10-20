import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { LangText } from "@/components/Lang";
import { getMyAnswer, setLiveLanguage, submitLiveAnswer } from "@/lib/live.functions";
import {
  localized,
  ranked,
  setSeat,
  useCountdown,
  useHydrated,
  useLiveSession,
  useSeat,
  visibleLangs,
} from "@/lib/learnplay";
import { getLang, sessionLangs } from "@/lib/i18n";
import { TeamBadge } from "@/components/TeamBadge";
import { gami, teamStandings } from "@/lib/teams";
import { setLiveTeam } from "@/lib/live.functions";

export const Route = createFileRoute("/play")({
  head: () => ({
    meta: [
      { title: "Playing — LearnNPlay" },
      {
        name: "description",
        content:
          "Answer live quiz questions from your phone in your language and watch your rank climb.",
      },
      { property: "og:title", content: "Playing — LearnNPlay" },
      {
        property: "og:description",
        content: "One question at a time, big tap targets, instant scoring.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: PlayPage,
});

const OPTION_TONES = [
  "bg-primary text-primary-foreground",
  "bg-surface text-foreground",
  "bg-sun text-accent-foreground",
  "bg-mint text-primary-foreground",
];

function PlayPage() {
  const hydrated = useHydrated();
  const seat = useSeat();
  const { session, participants, loading } = useLiveSession(seat?.sessionId ?? null);
  const submit = useServerFn(submitLiveAnswer);
  const changeLang = useServerFn(setLiveLanguage);
  const fetchMine = useServerFn(getMyAnswer);
  const changeTeam = useServerFn(setLiveTeam);
  const [mine, setMine] = useState<{ index: number; choice: number; points: number } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const me = participants.find((p) => p.id === seat?.participantId) ?? null;
  const question = session ? session.questions[session.index] : null;
  const left = useCountdown(
    session?.questionStartedAt ?? 0,
    question?.seconds ?? 20,
    session?.status === "question",
  );

  // Restore my answer after a refresh.
  useEffect(() => {
    if (!seat || !session || session.status === "lobby" || session.status === "ended") return;
    if (mine?.index === session.index) return;
    fetchMine({
      data: { participantId: seat.participantId, token: seat.token, questionIndex: session.index },
    })
      .then((r) => setMine(r ? { index: session.index, choice: r.choice, points: r.points } : null))
      .catch(() => {});
    setError(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [seat?.participantId, session?.index, session?.status]);

  if (!hydrated || (seat && loading)) return <Shell>Loading…</Shell>;

  if (!seat || !session || (!me && participants.length > 0)) {
    return (
      <Shell>
        <p className="font-display text-2xl font-bold">You're not in a session</p>
        <Link
          to="/join"
          onClick={() => setSeat(null)}
          className="mt-5 inline-block rounded-2xl bg-primary px-6 py-4 font-display font-bold text-primary-foreground"
        >
          Join with a PIN
        </Link>
      </Shell>
    );
  }
  if (!me) return <Shell>Loading…</Shell>;

  const board = ranked(participants);
  const myRank = board.findIndex((p) => p.id === me.id) + 1;
  const langs = sessionLangs(session.languages);
  const base = langs[0]!;
  const shown = visibleLangs(session, me.lang);
  const teamMode = session.competitionMode !== "individual" && session.teams.length > 0;
  const myTeamIdx = session.teams.findIndex((t) => t.id === me.team);
  const myTeam = myTeamIdx >= 0 ? session.teams[myTeamIdx]! : null;
  const standings = teamMode
    ? teamStandings(session.teams, participants, session.teamSettings.scoring)
    : [];
  const teamRank = myTeam ? standings.findIndex((t) => t.id === myTeam.id) + 1 : 0;
  const g = gami(session.gamification);
  const teamLine = teamMode ? (
    myTeam ? (
      <p className="mt-3 flex items-center justify-center gap-2 text-sm font-semibold">
        You are on <TeamBadge team={myTeam} number={myTeamIdx + 1} />
      </p>
    ) : (
      <p className="mt-3 text-sm text-ink-foreground/60">The trainer will place you on a team.</p>
    )
  ) : null;
  const canSwitch = langs.length > 1 && session.allowLanguageChange;

  const langSwitcher = canSwitch ? (
    <div className="flex gap-1.5">
      {langs.map((l) => (
        <button
          key={l}
          onClick={() =>
            changeLang({
              data: { participantId: seat.participantId, token: seat.token, lang: l },
            }).catch(() => {})
          }
          lang={l}
          style={{ fontFamily: getLang(l).font }}
          className={`rounded-full px-3 py-1 text-xs font-semibold ${me.lang === l ? "bg-primary text-primary-foreground" : "bg-surface/10"}`}
        >
          {getLang(l).native}
        </button>
      ))}
    </div>
  ) : null;

  if (session.status === "lobby") {
    return (
      <Shell>
        <p className="text-6xl">{me.avatar}</p>
        <p className="mt-3 font-display text-2xl font-bold">You're in, {me.name}!</p>
        <p className="mt-1 text-sm text-ink-foreground/60">
          Waiting for the trainer to start {session.title}.
        </p>
        {teamLine}
        {teamMode && session.teamSettings.allowChoice && !session.teamsLocked ? (
          <div className="mt-4 flex flex-wrap justify-center gap-2">
            {session.teams.map((t, i) => (
              <button
                key={t.id}
                aria-pressed={me.team === t.id}
                onClick={() =>
                  changeTeam({
                    data: { participantId: seat.participantId, token: seat.token, team: t.id },
                  }).catch(() => {})
                }
                className={`rounded-full ${me.team === t.id ? "ring-4 ring-primary" : "opacity-80"}`}
              >
                <TeamBadge team={t} number={i + 1} size="sm" />
              </button>
            ))}
          </div>
        ) : null}
        {teamMode && session.teamsLocked ? (
          <p className="mt-2 text-xs text-ink-foreground/50">Teams locked</p>
        ) : null}
        {langSwitcher ? <div className="mt-5">{langSwitcher}</div> : null}
      </Shell>
    );
  }

  if (session.status === "ended") {
    return (
      <Shell>
        <p className="text-6xl">{myRank === 1 ? "🏆" : "🎉"}</p>
        <p className="mt-3 font-display text-3xl font-bold">#{myRank}</p>
        <p className="mt-1 text-lg font-semibold">{me.score} points</p>
        {myTeam && g.podium ? (
          <p className="mt-3 flex items-center gap-2 text-sm font-semibold">
            <TeamBadge team={myTeam} /> finished #{teamRank} of {standings.length}
            {teamRank === 1 ? " — Congratulations!" : ""}
          </p>
        ) : null}
        <div className="mt-6 w-full max-w-sm space-y-2">
          {board.slice(0, 5).map((p, i) => (
            <div
              key={p.id}
              className={`flex items-center gap-3 rounded-2xl px-4 py-3 ${p.id === me.id ? "bg-primary text-primary-foreground" : "bg-surface/10"}`}
            >
              <span className="w-4 font-display font-bold">{i + 1}</span>
              <span className="text-lg">{p.avatar}</span>
              <span className="min-w-0 flex-1 truncate text-left text-sm font-semibold">
                {p.name}
              </span>
              <span className="font-display font-bold tabular-nums">{p.score}</span>
            </div>
          ))}
        </div>
      </Shell>
    );
  }

  if (!question) return <Shell>Waiting…</Shell>;

  const myAnswer = mine?.index === session.index ? mine : null;
  const answered = myAnswer !== null;
  const revealed = session.status === "reveal";
  const correctIdx = revealed ? session.revealedCorrect : null;

  async function answer(i: number) {
    if (!seat || answered || revealed || !session) return;
    setMine({ index: session.index, choice: i, points: 0 });
    try {
      const r = await submit({
        data: { participantId: seat.participantId, token: seat.token, choice: i },
      });
      setMine({ index: r.questionIndex, choice: i, points: r.points });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Answer not saved.");
    }
  }

  return (
    <div className="flex min-h-screen flex-col bg-ink px-5 pb-8 pt-6 text-ink-foreground">
      <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3">
        <div className="flex min-w-0 items-center gap-2">
          <span className="text-2xl">{me.avatar}</span>
          <span className="truncate text-sm font-semibold">{me.name}</span>
          {myTeam ? <TeamBadge team={myTeam} size="sm" /> : null}
        </div>
        <span className="shrink-0 rounded-full bg-surface/10 px-3 py-1.5 font-display text-sm font-bold tabular-nums">
          {revealed ? "Time's up" : `00:${String(left).padStart(2, "0")}`}
        </span>
      </div>

      <div className="mt-6 flex flex-wrap items-center justify-between gap-2">
        <p className="text-xs font-semibold uppercase tracking-[0.14em] text-ink-foreground/50">
          Question {session.index + 1} of {session.questions.length}
        </p>
        {langSwitcher}
      </div>
      <div className="mt-2 space-y-2">
        {shown.map((lang, li) => {
          const t = localized(question, lang, base);
          return (
            <LangText
              key={lang}
              as="h1"
              lang={t.lang}
              className={
                li === 0
                  ? "block text-2xl font-bold leading-tight"
                  : "block text-base text-ink-foreground/70"
              }
            >
              {t.prompt}
            </LangText>
          );
        })}
      </div>

      <div className="mt-6 grid gap-3">
        {question.options.map((opt, i) => {
          const chosen = myAnswer?.choice === i;
          const correct = correctIdx === i;
          return (
            <button
              key={i}
              disabled={answered || revealed}
              onClick={() => answer(i)}
              className={`rounded-2xl px-5 py-5 text-start font-display text-lg font-bold transition-opacity ${OPTION_TONES[i % OPTION_TONES.length]} ${
                revealed && !correct ? "opacity-30" : ""
              } ${answered && !chosen && !revealed ? "opacity-30" : ""} ${correct ? "ring-4 ring-mint" : ""}`}
            >
              <span className="flex gap-3">
                <span className="shrink-0">{String.fromCharCode(65 + i)}</span>
                <span className="min-w-0 flex-1">
                  {shown.map((lang, li) => {
                    const t = localized(question, lang, base);
                    return (
                      <LangText
                        key={lang}
                        lang={t.lang}
                        className={li === 0 ? "block" : "block text-sm font-semibold opacity-80"}
                      >
                        {t.options[i] ?? opt}
                      </LangText>
                    );
                  })}
                </span>
              </span>
              {chosen ? <span className="mt-1 block text-sm font-semibold">your pick</span> : null}
            </button>
          );
        })}
      </div>

      {revealed && myAnswer ? (
        <p className="mt-4 rounded-2xl bg-surface/10 p-4 text-center font-display text-lg font-bold">
          {myAnswer.choice === correctIdx ? `Correct! +${myAnswer.points}` : "Not this time"}
          {g.celebrations && myAnswer.choice === correctIdx && (me.streak ?? 0) >= 3 ? (
            <span className="block text-sm">🔥 {me.streak} in a row!</span>
          ) : null}
        </p>
      ) : null}
      {error ? <p className="mt-3 text-sm font-semibold text-sun">{error}</p> : null}

      <div className="mt-auto flex items-center justify-between rounded-2xl bg-surface/10 px-5 py-4">
        <div>
          <p className="text-xs text-ink-foreground/50">Your rank</p>
          <p className="font-display text-2xl font-bold leading-none">#{myRank}</p>
        </div>
        {myTeam ? (
          <div className="text-center">
            <p className="text-xs text-ink-foreground/50">Team rank</p>
            <p className="font-display text-2xl font-bold leading-none">#{teamRank}</p>
          </div>
        ) : null}
        <div className="text-right">
          <p className="text-xs text-ink-foreground/50">Score</p>
          <p className="font-display text-2xl font-bold leading-none tabular-nums">{me.score}</p>
        </div>
      </div>
    </div>
  );
}

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div className="grid min-h-screen place-items-center bg-ink px-6 text-center text-ink-foreground">
      <div className="flex flex-col items-center">{children}</div>
    </div>
  );
}
