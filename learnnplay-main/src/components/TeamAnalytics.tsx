import { Fragment, useState } from "react";
import { Card } from "@/components/AppShell";
import { LangText } from "@/components/Lang";
import { TeamBadge } from "@/components/TeamBadge";
import { downloadCsv, type LiveSession, type ResponseRow } from "@/lib/learnplay";
import type { LangCode } from "@/lib/i18n";
import type { Team } from "@/lib/teams";

export type APlayer = { id: string; name: string; avatar: string; score: number; team?: string | null; best_streak?: number | null };

type TeamRow = Team & {
  number: number;
  rank: number;
  players: APlayer[];
  total: number;
  avg: number;
  correct: number;
  incorrect: number;
  answered: number;
  accuracy: number | null;
  longestStreak: number;
  perQ: { answered: number; correct: number; points: number }[];
};

/** Longest run of questions where the team's answering members were majority-correct. */
function longestTeamStreak(perQ: { answered: number; correct: number }[]) {
  let best = 0, cur = 0;
  for (const q of perQ) {
    if (q.answered && q.correct * 2 > q.answered) best = Math.max(best, ++cur);
    else cur = 0;
  }
  return best;
}

export function buildTeamRows(session: LiveSession, players: APlayer[], responses: ResponseRow[]): TeamRow[] {
  const nQ = session.questions.length;
  const rows = session.teams.map((t, i) => {
    const ps = players.filter((p) => p.team === t.id);
    const ids = new Set(ps.map((p) => p.id));
    const rs = responses.filter((r) => ids.has(r.participant_id));
    const correct = rs.filter((r) => r.is_correct).length;
    const perQ = Array.from({ length: nQ }, (_, qi) => {
      const q = rs.filter((r) => r.question_index === qi);
      return { answered: q.length, correct: q.filter((r) => r.is_correct).length, points: q.reduce((a, r) => a + r.points, 0) };
    });
    // Team score = sum of server-written participant scores (current "Total points" method).
    const total = ps.reduce((a, p) => a + p.score, 0);
    return {
      ...t, number: i + 1, rank: 0, players: ps, total,
      avg: ps.length ? Math.round(total / ps.length) : 0,
      correct, incorrect: rs.length - correct, answered: rs.length,
      accuracy: rs.length ? Math.round((correct / rs.length) * 100) : null,
      longestStreak: longestTeamStreak(perQ), perQ,
    };
  });
  const sorted = [...rows].sort((a, b) => b.total - a.total || (b.accuracy ?? -1) - (a.accuracy ?? -1));
  sorted.forEach((r, i) => (r.rank = i + 1));
  return sorted;
}

export function TeamAnalytics({ session, players, responses, base }: { session: LiveSession; players: APlayer[]; responses: ResponseRow[]; base: LangCode }) {
  const rows = buildTeamRows(session, players, responses);
  const [open, setOpen] = useState<string | null>(null);
  const [qTeam, setQTeam] = useState<string>("all");
  const assigned = players.filter((p) => rows.some((r) => r.id === p.team));
  const unassigned = players.length - assigned.length;
  const nQ = session.questions.length;
  const active = rows.filter((r) => r.players.length);
  const winner = active[0] && active[0].total > 0 ? active[0] : null;
  const withAcc = active.filter((r) => r.accuracy !== null);
  const bestAcc = withAcc.length ? withAcc.reduce((a, b) => ((b.accuracy ?? 0) > (a.accuracy ?? 0) ? b : a)) : null;
  const weakest = withAcc.length > 1 ? withAcc.reduce((a, b) => ((b.accuracy ?? 0) < (a.accuracy ?? 0) ? b : a)) : null;
  const longest = active.length ? active.reduce((a, b) => (b.longestStreak > a.longestStreak ? b : a)) : null;
  const totalPts = rows.reduce((a, r) => a + r.total, 0);
  const maxTotal = Math.max(1, ...rows.map((r) => r.total));

  if (!rows.length)
    return <Card className="lg:col-span-3"><p className="text-sm text-muted-foreground">This session used team mode but no teams were saved.</p></Card>;

  const modeLabel = session.competitionMode === "both" ? "Individual + Team" : "Team";
  const meta = [["Session", session.title], ["Date", new Date(session.createdAt).toLocaleString()], ["Competition mode", modeLabel], []];
  const slug = `${session.title.replace(/\W+/g, "-")}-${session.pin}`;
  const exportTeams = () =>
    downloadCsv(`learnnplay-teams-${slug}.csv`, [
      ...meta,
      ["Final rank", "Team number", "Team", "Players", "Total points", "Avg points per player", "Accuracy", "Correct", "Incorrect", "Questions answered", "Longest streak"],
      ...rows.map((r) => [String(r.rank), String(r.number), r.name, String(r.players.length), String(r.total), String(r.avg), r.accuracy === null ? "—" : `${r.accuracy}%`, String(r.correct), String(r.incorrect), String(r.answered), String(r.longestStreak)]),
    ]);
  const indRank = new Map([...players].sort((a, b) => b.score - a.score).map((p, i) => [p.id, i + 1]));
  const exportMembers = () =>
    downloadCsv(`learnnplay-team-members-${slug}.csv`, [
      ...meta,
      ["Team", "Player", "Correct", "Incorrect", "Accuracy", "Points", "Longest streak", "Individual rank"],
      ...rows.flatMap((r) =>
        r.players.map((p) => {
          const rs = responses.filter((x) => x.participant_id === p.id);
          const c = rs.filter((x) => x.is_correct).length;
          return [r.name, p.name, String(c), String(rs.length - c), rs.length ? `${Math.round((c / rs.length) * 100)}%` : "—", String(p.score), String(p.best_streak ?? 0), String(indRank.get(p.id) ?? "")];
        }),
      ),
    ]);
  const exportQuestions = () =>
    downloadCsv(`learnnplay-team-questions-${slug}.csv`, [
      ...meta,
      ["Question number", "Question ID", "Question", "Team", "Members answered", "Correct", "Incorrect", "Accuracy", "Points earned"],
      ...session.questions.flatMap((q, qi) =>
        rows.map((r) => {
          const s = r.perQ[qi]!;
          return [String(qi + 1), q.id ?? "", q.prompt, r.name, String(s.answered), String(s.correct), String(s.answered - s.correct), s.answered ? `${Math.round((s.correct / s.answered) * 100)}%` : "—", String(s.points)];
        }),
      ),
    ]);

  return (
    <>
      <Card className="lg:col-span-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="font-display text-lg font-bold">Team performance</h2>
          <div className="flex flex-wrap gap-2">
            {[["Teams CSV", exportTeams], ["Members CSV", exportMembers], ["Questions CSV", exportQuestions]].map(([l, f]) => (
              <button key={l as string} onClick={f as () => void} className="rounded-xl border border-border bg-surface px-3 py-2 text-xs font-semibold">{l as string}</button>
            ))}
          </div>
        </div>
        {winner ? (
          <div className="mt-4 flex flex-wrap items-center gap-3 rounded-2xl bg-ink p-4 text-ink-foreground">
            <span className="text-sm font-semibold uppercase tracking-widest text-ink-foreground/60">Winning team</span>
            <TeamBadge team={winner} number={winner.number} size="lg" />
            <span className="font-display text-xl font-bold tabular-nums">{winner.total} pts</span>
          </div>
        ) : null}
        <div className="mt-4 grid grid-cols-2 gap-3 md:grid-cols-4">
          <Stat label="Teams" value={String(rows.length)} />
          <Stat label="Players" value={`${assigned.length}${unassigned ? ` (+${unassigned} no team)` : ""}`} />
          <Stat label="Questions" value={String(nQ)} />
          <Stat label="Total team points" value={String(totalPts)} />
          <Stat label="Avg. team score" value={String(active.length ? Math.round(totalPts / active.length) : 0)} />
          <Stat label="Highest score" value={active[0] ? `${active[0].total} · ${active[0].name}` : "—"} />
          <Stat label="Highest accuracy" value={bestAcc ? `${bestAcc.accuracy}% · ${bestAcc.name}` : "—"} />
          <Stat label="Longest streak" value={longest && longest.longestStreak ? `${longest.longestStreak} · ${longest.name}` : "—"} />
          {(() => {
            const bestAvg = [...rows].filter((r) => r.players.length).sort((x, y) => y.avg - x.avg)[0];
            return <Stat label="Best avg. points per player" value={bestAvg ? `${bestAvg.avg} · ${bestAvg.name}` : "—"} />;
          })()}
        </div>
      </Card>

      <Card className="lg:col-span-3">
        <h2 className="font-display text-lg font-bold">Team leaderboard</h2>
        <div className="mt-4 overflow-x-auto">
          <table className="w-full min-w-[720px] text-sm">
            <thead className="text-left text-xs uppercase tracking-wider text-muted-foreground">
              <tr>{["Rank", "Team", "Players", "Points", "Avg / player", "Accuracy", "Correct", "Answered", "Streak", ""].map((h) => <th key={h} className="px-2 py-2 font-semibold">{h}</th>)}</tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <Fragment key={r.id}>
                  <tr className="border-t border-border">
                    <td className="px-2 py-2.5 font-display font-bold">{r.rank}</td>
                    <td className="px-2 py-2.5"><TeamBadge team={r} number={r.number} size="sm" /></td>
                    <td className="px-2 py-2.5 tabular-nums">{r.players.length}</td>
                    <td className="px-2 py-2.5 font-display font-bold tabular-nums">{r.total}</td>
                    <td className="px-2 py-2.5 tabular-nums">{r.avg}</td>
                    <td className="px-2 py-2.5 tabular-nums">{r.accuracy === null ? "—" : `${r.accuracy}%`}</td>
                    <td className="px-2 py-2.5 tabular-nums">{r.correct}</td>
                    <td className="px-2 py-2.5 tabular-nums">{r.answered}</td>
                    <td className="px-2 py-2.5 tabular-nums">{r.longestStreak}</td>
                    <td className="px-2 py-2.5 text-right">
                      <button onClick={() => setOpen(open === r.id ? null : r.id)} aria-expanded={open === r.id} className="rounded-lg border border-border px-2 py-1 text-xs font-semibold">
                        {open === r.id ? "Hide" : "Details"}
                      </button>
                    </td>
                  </tr>
                  {open === r.id ? (
                    <tr>
                      <td colSpan={10} className="bg-background px-3 py-3">
                        <p className="text-xs text-muted-foreground">
                          Final rank #{r.rank} · {r.total} pts · {r.correct} correct · {r.incorrect} incorrect · avg {r.avg} pts per player
                        </p>
                        {r.players.length === 0 ? <p className="mt-2 text-sm text-muted-foreground">No players on this team.</p> : null}
                        <div className="mt-2 grid gap-1.5 sm:grid-cols-2">
                          {[...r.players].sort((a, b) => b.score - a.score).map((p) => {
                            const rs = responses.filter((x) => x.participant_id === p.id);
                            const c = rs.filter((x) => x.is_correct).length;
                            return (
                              <div key={p.id} className="flex items-center gap-2 rounded-xl bg-card px-3 py-2">
                                <span>{p.avatar}</span>
                                <span className="min-w-0 flex-1 truncate font-semibold">{p.name}</span>
                                <span className="text-xs text-muted-foreground">{rs.length ? `${c}/${rs.length} correct` : "no answers"}</span>
                                <span className="font-display font-bold tabular-nums">{p.score}</span>
                              </div>
                            );
                          })}
                        </div>
                      </td>
                    </tr>
                  ) : null}
                </Fragment>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      <Card className="lg:col-span-3">
        <h2 className="font-display text-lg font-bold">Team vs team</h2>
        <div className="mt-2 flex flex-wrap gap-2 text-xs">
          {active[0] ? <span className="rounded-full bg-mint/15 px-3 py-1 font-semibold">Strongest team: {active[0].name}</span> : null}
          {bestAcc ? <span className="rounded-full bg-mint/15 px-3 py-1 font-semibold">Best accuracy: {bestAcc.name}</span> : null}
          {weakest && weakest.id !== bestAcc?.id ? <span className="rounded-full bg-secondary px-3 py-1 font-semibold">Needs support: {weakest.name}</span> : null}
        </div>
        <div className="mt-4 space-y-3">
          {rows.map((r) => (
            <div key={r.id} className="grid grid-cols-[9rem_minmax(0,1fr)_auto] items-center gap-3 text-sm">
              <TeamBadge team={r} size="sm" className="max-w-full" />
              <div className="h-3 overflow-hidden rounded-full bg-secondary">
                <div className="grow-bar h-full rounded-full" style={{ width: `${(r.total / maxTotal) * 100}%`, backgroundColor: `var(--team-${r.color})` }} />
              </div>
              <span className="tabular-nums text-muted-foreground">{r.total} pts · {r.accuracy ?? "—"}{r.accuracy === null ? "" : "%"}</span>
            </div>
          ))}
        </div>
      </Card>

      <Card className="lg:col-span-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="font-display text-lg font-bold">Question-by-question team performance</h2>
          <select value={qTeam} onChange={(e) => setQTeam(e.target.value)} aria-label="Filter by team" className="rounded-xl border border-border bg-background px-3 py-2 text-sm">
            <option value="all">All teams</option>
            {rows.map((r) => <option key={r.id} value={r.id}>#{r.number} {r.name}</option>)}
          </select>
        </div>
        {nQ === 0 ? <p className="mt-3 text-sm text-muted-foreground">No questions in this session.</p> : null}
        <div className="mt-4 space-y-4">
          {session.questions.map((q, qi) => (
            <div key={q.id ?? qi} className="rounded-2xl bg-background p-3">
              <LangText lang={base} className="block truncate text-sm font-semibold">{qi + 1}. {q.prompt}</LangText>
              <div className="mt-2 grid gap-1.5">
                {rows.filter((r) => qTeam === "all" || r.id === qTeam).map((r) => {
                  const s = r.perQ[qi]!;
                  const pct = s.answered ? Math.round((s.correct / s.answered) * 100) : null;
                  return (
                    <div key={r.id} className="grid grid-cols-[8rem_minmax(0,1fr)_auto] items-center gap-3 text-xs">
                      <TeamBadge team={r} size="sm" className="max-w-full" />
                      <div className="h-2 overflow-hidden rounded-full bg-secondary">
                        <div className="h-full rounded-full bg-mint" style={{ width: `${pct ?? 0}%` }} />
                      </div>
                      <span className="tabular-nums text-muted-foreground">
                        {s.answered ? `${s.correct}/${s.answered} · ${pct}% · ${s.points} pts` : "no answers"}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      </Card>
    </>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl bg-background p-4">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="mt-1 truncate font-display text-xl font-bold">{value}</p>
    </div>
  );
}
