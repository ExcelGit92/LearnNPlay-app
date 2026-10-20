import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Lock, Plus, Shuffle, Trash2, Unlock } from "lucide-react";
import { Card } from "@/components/AppShell";
import { TeamBadge, TeamIconTile } from "@/components/TeamBadge";
import { assignParticipantTeam, distributeTeams } from "@/lib/live.functions";
import { updateLiveSession, useOrgId, type LiveSession, type Participant } from "@/lib/learnplay";
import { useQueryClient } from "@tanstack/react-query";
import { saveTeamTemplate, teamsFromTemplate, useTeamTemplates } from "@/lib/teamTemplates";
import {
  COLOR_LABEL,
  ICON_KEYS,
  TEAM_COLORS,
  TEAM_ICONS,
  gami,
  makeTeam,
  teamBg,
  type CompetitionMode,
  type Gamification,
  type Team,
  type TeamScoring,
  type TeamSettings,
} from "@/lib/teams";

const MODE_LABEL: Record<CompetitionMode, string> = {
  individual: "Individual",
  team: "Team",
  both: "Individual + Team",
};

const SCORING_LABEL: Record<TeamScoring, string> = {
  total: "Total points (sum of all members)",
  average: "Average points (balanced for unequal teams)",
  accuracy: "Accuracy percentage",
};

export function TeamPanel({
  session,
  participants,
}: {
  session: LiveSession;
  participants: Participant[];
}) {
  const assign = useServerFn(assignParticipantTeam);
  const distribute = useServerFn(distributeTeams);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const lobby = session.status === "lobby";
  const teams = session.teams;
  const ts = session.teamSettings;
  const g = gami(session.gamification);
  const teamMode = session.competitionMode !== "individual";
  const { templates } = useTeamTemplates();
  const orgId = useOrgId();
  const qc = useQueryClient();
  const [tplPick, setTplPick] = useState("");
  const [tplName, setTplName] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const run = async (fn: () => Promise<unknown>) => {
    setError(null);
    setBusy(true);
    try {
      await fn();
    } catch (e) {
      console.error("[teams]", e);
      setError(e instanceof Error ? e.message : "Something went wrong.");
    } finally {
      setBusy(false);
    }
  };
  const saveTeams = (next: Team[]) => run(() => updateLiveSession(session.id, { teams: next }));
  const saveTs = (p: Partial<TeamSettings>) =>
    run(() => updateLiveSession(session.id, { team_settings: { ...ts, ...p } }));
  const saveG = (p: Partial<Gamification>) =>
    run(() => updateLiveSession(session.id, { gamification: { ...session.gamification, ...p } }));
  const patchTeam = (id: string, p: Partial<Team>) =>
    saveTeams(teams.map((t) => (t.id === id ? { ...t, ...p } : t)));

  return (
    <Card>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="font-display text-lg font-bold">Competition & gamification</h2>
        {teamMode && session.teamsLocked ? (
          <span className="inline-flex items-center gap-1 rounded-full bg-secondary px-3 py-1 text-xs font-bold">
            <Lock className="size-3" /> Teams locked
          </span>
        ) : null}
      </div>

      <p className="mt-2 text-sm text-muted-foreground">
        Session mode:{" "}
        <span className="font-bold text-foreground">{MODE_LABEL[session.competitionMode]}</span>
        {lobby ? " — chosen when the quiz was created." : ""}
      </p>

      {teamMode ? (
        <>
          {lobby ? (
            <div className="mt-4 rounded-2xl border border-border bg-background p-3">
              <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground">
                Team template
              </p>
              {templates.length ? (
                <div className="mt-2 flex flex-wrap gap-2">
                  <select
                    value={tplPick}
                    aria-label="Team template"
                    onChange={(e) => setTplPick(e.target.value)}
                    className="min-w-0 flex-1 rounded-lg border border-border bg-surface px-2 py-1.5 text-sm"
                  >
                    <option value="">Start with current/default teams</option>
                    {templates.map((t) => (
                      <option key={t.id} value={t.id}>
                        {t.name} ({t.teams.length} teams)
                      </option>
                    ))}
                  </select>
                  <button
                    disabled={!tplPick || busy || session.teamsLocked}
                    onClick={() => {
                      const tpl = templates.find((t) => t.id === tplPick);
                      if (!tpl) return;
                      setNotice(null);
                      run(async () => {
                        await updateLiveSession(session.id, {
                          teams: teamsFromTemplate(tpl),
                          team_settings: { ...ts, allowChoice: !!tpl.settings.allowChoice },
                        });
                        setNotice(`Applied "${tpl.name}". Changes here only affect this session.`);
                      });
                    }}
                    className="rounded-xl bg-primary px-3 py-1.5 text-sm font-bold text-primary-foreground disabled:opacity-50"
                  >
                    Apply team template
                  </button>
                </div>
              ) : (
                <p className="mt-2 text-sm text-muted-foreground">
                  No saved team templates yet.{" "}
                  <a href="/templates" className="font-semibold text-primary underline">
                    Create team template
                  </a>
                </p>
              )}
              {participants.some((p) => p.team) && tplPick ? (
                <p className="mt-2 text-xs text-muted-foreground">
                  Applying a template replaces the current teams — players already on a team will
                  need reassigning.
                </p>
              ) : null}
              {tplName === null ? (
                <button
                  onClick={() => {
                    setNotice(null);
                    setTplName("");
                  }}
                  className="mt-2 text-sm font-semibold text-primary underline"
                >
                  Save as team template
                </button>
              ) : (
                <div className="mt-2 flex flex-wrap gap-2">
                  <input
                    autoFocus
                    value={tplName}
                    maxLength={60}
                    placeholder="Template name"
                    onChange={(e) => setTplName(e.target.value)}
                    className="min-w-0 flex-1 rounded-lg border border-border bg-surface px-2 py-1.5 text-sm"
                  />
                  <button
                    disabled={busy || !orgId}
                    onClick={() =>
                      orgId &&
                      run(async () => {
                        await saveTeamTemplate(orgId, {
                          name: tplName,
                          teams: teams,
                          settings: { allowChoice: !!ts.allowChoice },
                        });
                        await qc.invalidateQueries({ queryKey: ["team-templates"] });
                        setNotice(`Saved "${tplName.trim()}" as a team template.`);
                        setTplName(null);
                      })
                    }
                    className="rounded-xl bg-primary px-3 py-1.5 text-sm font-bold text-primary-foreground disabled:opacity-50"
                  >
                    Save
                  </button>
                  <button
                    onClick={() => setTplName(null)}
                    className="rounded-xl border border-border px-3 py-1.5 text-sm font-semibold"
                  >
                    Cancel
                  </button>
                </div>
              )}
              {notice ? (
                <p className="mt-2 text-sm font-semibold text-foreground">{notice}</p>
              ) : null}
            </div>
          ) : null}
          <div className="mt-4 space-y-2">
            {teams.map((t, i) => {
              const members = participants.filter((p) => p.team === t.id);
              return (
                <div key={t.id} className="rounded-2xl border border-border bg-background p-3">
                  <div className="flex flex-wrap items-center gap-2">
                    <TeamIconTile team={t} className="size-9" />
                    <span className="text-xs font-bold text-muted-foreground">#{i + 1}</span>
                    <input
                      defaultValue={t.name}
                      disabled={!lobby}
                      maxLength={24}
                      aria-label={`Team ${i + 1} name`}
                      onBlur={(e) =>
                        e.target.value.trim() &&
                        e.target.value !== t.name &&
                        patchTeam(t.id, { name: e.target.value.trim() })
                      }
                      className="min-w-0 flex-1 rounded-lg border border-border bg-surface px-2 py-1 text-sm font-semibold"
                    />
                    <select
                      value={t.color}
                      disabled={!lobby}
                      aria-label="Team color"
                      onChange={(e) => patchTeam(t.id, { color: e.target.value as Team["color"] })}
                      className="rounded-lg border border-border bg-surface px-2 py-1 text-sm"
                    >
                      {TEAM_COLORS.map((c) => (
                        <option key={c} value={c}>
                          {COLOR_LABEL[c]}
                        </option>
                      ))}
                    </select>
                    <span className="text-xs text-muted-foreground">{members.length} players</span>
                    {lobby && teams.length > 1 ? (
                      <button
                        aria-label={`Remove ${t.name}`}
                        onClick={() => saveTeams(teams.filter((x) => x.id !== t.id))}
                        className="rounded-lg p-1.5 text-muted-foreground hover:bg-secondary"
                      >
                        <Trash2 className="size-4" />
                      </button>
                    ) : null}
                  </div>
                  {lobby ? (
                    <div className="mt-2 flex flex-wrap gap-1">
                      {ICON_KEYS.map((k) => {
                        const Icon = TEAM_ICONS[k];
                        return (
                          <button
                            key={k}
                            aria-label={k}
                            title={k}
                            onClick={() => patchTeam(t.id, { icon: k })}
                            className="grid size-7 place-items-center rounded-lg"
                            style={t.icon === k ? teamBg(t.color) : undefined}
                          >
                            <Icon className="size-4" />
                          </button>
                        );
                      })}
                    </div>
                  ) : null}
                </div>
              );
            })}
          </div>

          <div className="mt-3 flex flex-wrap gap-2">
            {teams.length < 8 ? (
              <button
                onClick={() => saveTeams([...teams, makeTeam(teams.length)])}
                className="inline-flex items-center gap-1 rounded-xl border border-border px-3 py-2 text-sm font-semibold"
              >
                <Plus className="size-4" /> Add team
              </button>
            ) : null}
            <button
              disabled={busy || session.teamsLocked}
              onClick={() =>
                run(() => distribute({ data: { sessionId: session.id, onlyUnassigned: false } }))
              }
              className="inline-flex items-center gap-1 rounded-xl border border-border px-3 py-2 text-sm font-semibold disabled:opacity-50"
            >
              <Shuffle className="size-4" /> Randomize teams
            </button>
            <button
              disabled={busy}
              onClick={() =>
                run(() => distribute({ data: { sessionId: session.id, onlyUnassigned: true } }))
              }
              className="rounded-xl border border-border px-3 py-2 text-sm font-semibold disabled:opacity-50"
            >
              Balance unassigned
            </button>
            <button
              onClick={() =>
                run(() => updateLiveSession(session.id, { teams_locked: !session.teamsLocked }))
              }
              className="inline-flex items-center gap-1 rounded-xl bg-ink px-3 py-2 text-sm font-semibold text-ink-foreground"
            >
              {session.teamsLocked ? (
                <>
                  <Unlock className="size-4" /> Unlock teams
                </>
              ) : (
                <>
                  <Lock className="size-4" /> Lock teams
                </>
              )}
            </button>
          </div>

          <label className="mt-3 flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              className="accent-[var(--primary)]"
              checked={!!ts.allowChoice}
              onChange={(e) => saveTs({ allowChoice: e.target.checked })}
            />
            Participants choose their own team (otherwise they're balanced automatically)
          </label>

          <div className="mt-3">
            <label className="flex items-center gap-2 text-sm font-semibold">
              Team scoring method
            </label>
            <select
              value={ts.scoring ?? "total"}
              disabled={!lobby}
              onChange={(e) => saveTs({ scoring: e.target.value as TeamScoring })}
              className="mt-1 w-full rounded-lg border border-border bg-surface px-2 py-1.5 text-sm"
            >
              <option value="total">{SCORING_LABEL.total}</option>
              <option value="average">{SCORING_LABEL.average}</option>
              <option value="accuracy">{SCORING_LABEL.accuracy}</option>
            </select>
            <p className="mt-1 text-xs text-muted-foreground">
              {ts.scoring === "average"
                ? "Average points balances scores when teams have different player counts."
                : ts.scoring === "accuracy"
                  ? "Ranks teams by answer accuracy, not points."
                  : "Total points sum all member scores (may favor larger teams)."}
            </p>
          </div>

          {participants.length ? (
            <div className="mt-4">
              <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground">
                Assign players
              </p>
              <div className="mt-2 grid gap-1.5 sm:grid-cols-2">
                {participants.map((p) => (
                  <div
                    key={p.id}
                    className="flex items-center gap-2 rounded-xl bg-background px-2 py-1.5 text-sm"
                  >
                    <span>{p.avatar}</span>
                    <span className="min-w-0 flex-1 truncate font-semibold">{p.name}</span>
                    <select
                      value={p.team ?? ""}
                      disabled={session.teamsLocked}
                      aria-label={`Team for ${p.name}`}
                      onChange={(e) =>
                        run(() =>
                          assign({
                            data: {
                              sessionId: session.id,
                              participantId: p.id,
                              team: e.target.value || null,
                            },
                          }),
                        )
                      }
                      className="max-w-[9rem] rounded-lg border border-border bg-surface px-1.5 py-1 text-xs"
                    >
                      <option value="">No team</option>
                      {teams.map((t, i) => (
                        <option key={t.id} value={t.id}>
                          #{i + 1} {t.name}
                        </option>
                      ))}
                    </select>
                  </div>
                ))}
              </div>
            </div>
          ) : null}
        </>
      ) : null}

      <div className="mt-5 border-t border-border pt-4">
        <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground">
          Gamification
        </p>
        <div className="mt-2 grid gap-2 sm:grid-cols-2">
          {(
            [
              ["speedBonus", "Speed bonus (extra points for fast correct answers)"],
              ["streakBonus", "Streak bonus (3+ correct in a row)"],
              ["celebrations", "Celebrations & streak call-outs"],
              ["podium", "Final podium & winner screen"],
              ["individualLeaderboard", "Individual leaderboard"],
              ["teamLeaderboard", "Team leaderboard"],
            ] as const
          ).map(([k, label]) => (
            <label key={k} className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                className="accent-[var(--primary)]"
                disabled={!lobby && (k === "speedBonus" || k === "streakBonus")}
                checked={g[k]}
                onChange={(e) => saveG({ [k]: e.target.checked })}
              />
              {label}
            </label>
          ))}
        </div>
        {g.speedBonus ? (
          <label className="mt-2 flex items-center gap-2 text-sm">
            Max speed bonus
            <input
              type="number"
              min={0}
              max={1000}
              step={50}
              defaultValue={g.maxSpeedBonus}
              disabled={!lobby}
              onBlur={(e) =>
                saveG({ maxSpeedBonus: Math.max(0, Math.min(1000, Number(e.target.value) || 0)) })
              }
              className="w-24 rounded-lg border border-border bg-surface px-2 py-1"
            />{" "}
            pts
          </label>
        ) : null}
        <label className="mt-3 flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            className="accent-[var(--primary)]"
            disabled={!lobby}
            checked={g.difficultyPoints}
            onChange={(e) => saveG({ difficultyPoints: e.target.checked })}
          />
          Difficulty-based points (Easy / Medium / Hard questions earn different points)
        </label>
        {g.difficultyPoints ? (
          <div className="mt-2 flex flex-wrap gap-3 text-sm">
            {(["pointsEasy", "pointsMedium", "pointsHard"] as const).map((k) => (
              <label key={k} className="flex items-center gap-1.5">
                {k === "pointsEasy" ? "Easy" : k === "pointsMedium" ? "Medium" : "Hard"}
                <input
                  type="number"
                  min={0}
                  max={5000}
                  step={50}
                  defaultValue={g[k]}
                  disabled={!lobby}
                  aria-label={`${k} points`}
                  onBlur={(e) =>
                    saveG({
                      [k]: Math.max(0, Math.min(5000, Math.round(Number(e.target.value) || 0))),
                    })
                  }
                  className="w-24 rounded-lg border border-border bg-surface px-2 py-1"
                />{" "}
                pts
              </label>
            ))}
            <p className="w-full text-xs text-muted-foreground">
              Questions without a difficulty count as Medium. Speed and streak bonuses are added on
              top.
            </p>
          </div>
        ) : null}
      </div>
      {error ? <p className="mt-3 text-sm font-semibold text-destructive">{error}</p> : null}
    </Card>
  );
}

export function TeamLeaderboard({
  standings,
  streaks,
}: {
  standings: (Team & { number: number; points: number; accuracy: number; members: number })[];
  streaks?: Record<string, number>;
}) {
  return (
    <div className="space-y-2">
      {standings.map((t, i) => (
        <div
          key={t.id}
          className={`flex items-center gap-3 rounded-2xl px-3 py-2.5 ${i === 0 ? "bg-mint/15" : "bg-background"}`}
        >
          <span className="w-4 font-display font-bold text-muted-foreground">{i + 1}</span>
          <TeamBadge team={t} number={t.number} size="sm" className="max-w-[45%]" />
          <span className="min-w-0 flex-1 truncate text-xs text-muted-foreground">
            {t.accuracy}% · {t.members} players
            {streaks?.[t.id] && streaks[t.id]! >= 2 ? ` · 🔥${streaks[t.id]}` : ""}
          </span>
          <span className="font-display font-bold tabular-nums">{t.points}</span>
        </div>
      ))}
    </div>
  );
}
