import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { AppShell, Card } from "@/components/AppShell";
import { LangText } from "@/components/Lang";
import { supabase } from "@/integrations/supabase/client";
import { downloadCsv, ranked, rowToSession, useQuizzes, type ResponseRow } from "@/lib/learnplay";
import { getLang, sessionLangs } from "@/lib/i18n";
import { TeamAnalytics } from "@/components/TeamAnalytics";

export const Route = createFileRoute("/_authenticated/analytics")({
  head: () => ({
    meta: [
      { title: "Analytics — LearnNPlay" },
      { name: "description", content: "Attendance, scores, question difficulty and language breakdowns for your sessions." },
      { property: "og:title", content: "Analytics — LearnNPlay" },
      { property: "og:description", content: "See which questions tripped people up and export the results." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: AnalyticsPage,
});

function AnalyticsPage() {
  const { quizzes } = useQuizzes();
  const sessionsQ = useQuery({
    queryKey: ["sessions-history"],
    queryFn: async () => {
      const { data, error } = await supabase.from("live_sessions").select("*").order("created_at", { ascending: false }).limit(50);
      if (error) throw error;
      return (data ?? []).map((r) => rowToSession(r as never));
    },
  });
  const sessions = sessionsQ.data ?? [];
  const [selected, setSelected] = useState<string | null>(null);
  const [tab, setTab] = useState<"individual" | "team" | "questions">("individual");
  useEffect(() => {
    if (!selected && sessions[0]) setSelected(sessions[0].id);
  }, [sessions, selected]);
  const session = sessions.find((s) => s.id === selected) ?? null;

  const detailQ = useQuery({
    queryKey: ["session-detail", selected],
    enabled: !!selected,
    queryFn: async () => {
      const [p, r] = await Promise.all([
        supabase.from("participants").select("id, name, avatar, score, lang, joined_at, team, best_streak").eq("session_id", selected!),
        supabase.from("responses").select("participant_id, question_index, choice, is_correct, points").eq("session_id", selected!),
      ]);
      if (p.error) throw p.error;
      if (r.error) throw r.error;
      return { participants: p.data ?? [], responses: (r.data ?? []) as ResponseRow[] };
    },
  });
  const participants = detailQ.data?.participants ?? [];
  const responses = detailQ.data?.responses ?? [];
  const quiz = quizzes.find((q) => q.id === session?.quizId) ?? null;
  const langs = session ? sessionLangs(session.languages) : [];
  const base = langs[0] ?? "en";
  const board = ranked(participants);
  const totalQ = session?.questions.length ?? 0;
  const teamSession = !!session && session.competitionMode !== "individual";
  useEffect(() => {
    setTab(session?.competitionMode === "team" ? "team" : "individual");
  }, [session?.id, session?.competitionMode]);
  const view = teamSession ? (session!.competitionMode === "team" && tab === "individual" ? "team" : tab) : "individual";

  const perQuestion = (session?.questions ?? []).map((q, i) => {
    const rs = responses.filter((r) => r.question_index === i);
    const correct = rs.filter((r) => r.is_correct).length;
    return { q, answered: rs.length, pct: rs.length ? Math.round((correct / rs.length) * 100) : null };
  });
  const answeredBy = (pid: string) => responses.filter((r) => r.participant_id === pid);

  function exportCsv() {
    if (!session) return;
    const header = ["Rank", "Name", "Preferred language", "Score", "Answered", "Correct", ...perQuestion.map((_, i) => `Q${i + 1}`)];
    const rows = board.map((p, i) => {
      const rs = answeredBy(p.id);
      return [
        String(i + 1),
        p.name,
        getLang(p.lang ?? base).name,
        String(p.score),
        `${rs.length}/${totalQ}`,
        String(rs.filter((r) => r.is_correct).length),
        ...perQuestion.map((_, qi) => {
          const r = rs.find((x) => x.question_index === qi);
          return r ? (r.is_correct ? `✓ ${r.points}` : "✗") : "—";
        }),
      ];
    });
    downloadCsv(`learnnplay-${session.title.replace(/\W+/g, "-")}-${session.pin}.csv`, [
      ["Session", session.title],
      ["Languages", langs.map((l) => getLang(l).name).join(" + ")],
      ["Date", new Date(session.createdAt).toLocaleString()],
      ["Participants", String(participants.length)],
      [],
      header,
      ...rows,
    ]);
  }

  return (
    <AppShell
      subtitle="Reports"
      title="Analytics"
      action={
        <button onClick={exportCsv} disabled={!session} className="rounded-2xl border border-border bg-surface px-5 py-3 text-sm font-semibold disabled:opacity-40">
          Export report
        </button>
      }
    >
      {sessions.length === 0 ? (
        <Card>
          <p className="text-sm text-muted-foreground">{sessionsQ.isLoading ? "Loading…" : "Run a live session to see attendance, scores and language breakdowns here."}</p>
        </Card>
      ) : (
        <div className="grid gap-4 lg:grid-cols-3">
          <Card className="lg:col-span-3">
            <div className="flex flex-wrap items-center gap-3">
              <label htmlFor="sess" className="text-sm font-semibold">Session</label>
              <select id="sess" value={selected ?? ""} onChange={(e) => setSelected(e.target.value)} className="min-w-0 flex-1 rounded-xl border border-border bg-background px-3 py-2 text-sm">
                {sessions.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.title} · {new Date(s.createdAt).toLocaleDateString()} · PIN {s.pin} · {s.status}
                  </option>
                ))}
              </select>
            </div>
            <div className="mt-4 grid grid-cols-2 gap-3 md:grid-cols-4">
              <Stat label="Attendance" value={String(participants.length)} />
              <Stat label="Questions" value={String(totalQ)} />
              <Stat label="Avg. score" value={String(participants.length ? Math.round(participants.reduce((a, p) => a + p.score, 0) / participants.length) : 0)} />
              <Stat
                label="Correct rate"
                value={responses.length ? `${Math.round((responses.filter((r) => r.is_correct).length / responses.length) * 100)}%` : "—"}
              />
            </div>
          </Card>

          {teamSession ? (
            <div className="lg:col-span-3 inline-flex w-fit flex-wrap gap-1 rounded-2xl bg-secondary p-1" role="tablist">
              {([
                ...(session!.competitionMode === "both" ? [["individual", "Individual performance"]] : []),
                ["team", "Team performance"],
                ["questions", "Question performance"],
              ] as const).map(([id, label]) => (
                <button key={id} role="tab" aria-selected={view === id} onClick={() => setTab(id as typeof tab)}
                  className={`rounded-xl px-3 py-1.5 text-sm font-semibold ${view === id ? "bg-primary text-primary-foreground" : ""}`}>
                  {label}
                </button>
              ))}
            </div>
          ) : null}

          {teamSession && view === "team" && session ? (
            <TeamAnalytics session={session} players={participants} responses={responses} base={base} />
          ) : null}

          {view !== "team" ? (
          <>
          <Card className={view === "questions" ? "lg:col-span-3" : "lg:col-span-2"}>
            <h2 className="font-display text-lg font-bold">Question difficulty</h2>
            <div className="mt-4 space-y-3">
              {perQuestion.map(({ q, pct, answered }, i) => (
                <div key={q.id ?? i}>
                  <div className="mb-1.5 grid grid-cols-[minmax(0,1fr)_auto] gap-3 text-sm">
                    <LangText lang={base} className="truncate font-medium">{i + 1}. {q.prompt}<span className="ml-2 rounded-full bg-secondary px-2 py-0.5 text-[10px] font-bold uppercase text-muted-foreground">{(q as { difficulty?: string }).difficulty ?? "medium"}</span></LangText>
                    <span className="shrink-0 tabular-nums text-muted-foreground">{pct === null ? "no answers" : `${pct}% · ${answered}`}</span>
                  </div>
                  <div className="h-3 overflow-hidden rounded-full bg-secondary">
                    <div className={`grow-bar h-full rounded-full ${pct !== null && pct < 50 ? "bg-primary" : "bg-mint"}`} style={{ width: `${pct ?? 0}%` }} />
                  </div>
                </div>
              ))}
            </div>
          </Card>

          {view === "individual" ? (
          <>
          <Card>
            <h2 className="font-display text-lg font-bold">Leaderboard</h2>
            <div className="mt-4 space-y-2">
              {board.length === 0 ? <p className="text-sm text-muted-foreground">Nobody joined this session.</p> : null}
              {board.slice(0, 10).map((p, i) => (
                <div key={p.id} className="flex items-center gap-3 rounded-2xl bg-background px-3 py-2.5">
                  <span className="w-4 font-display font-bold text-muted-foreground">{i + 1}</span>
                  <span className="text-lg">{p.avatar}</span>
                  <span className="min-w-0 flex-1 truncate text-sm font-semibold">{p.name}</span>
                  <span className="text-[10px] font-bold uppercase text-muted-foreground">{p.lang}</span>
                  <span className="font-display font-bold tabular-nums">{p.score}</span>
                </div>
              ))}
            </div>
          </Card>

          <Card className="lg:col-span-3">
            <h2 className="font-display text-lg font-bold">By preferred language</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Session languages: {langs.map((l) => getLang(l).name).join(" + ")} · one shared scoring system{quiz ? "" : ""}
            </p>
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              {langs.map((code) => {
                const group = participants.filter((p) => (p.lang ?? base) === code);
                const ids = new Set(group.map((p) => p.id));
                const rs = responses.filter((r) => ids.has(r.participant_id));
                const avg = group.length ? Math.round(group.reduce((a, p) => a + p.score, 0) / group.length) : 0;
                return (
                  <div key={code} className="rounded-2xl bg-background p-4">
                    <p className="text-sm font-semibold" lang={code} style={{ fontFamily: getLang(code).font }}>
                      {getLang(code).name} · {getLang(code).native}
                    </p>
                    <p className="mt-2 text-sm text-muted-foreground">
                      <span className="font-display text-2xl font-bold text-foreground">{group.length}</span> participants · avg{" "}
                      <span className="font-semibold text-foreground tabular-nums">{avg}</span> pts · correct{" "}
                      <span className="font-semibold text-foreground">{rs.length ? `${Math.round((rs.filter((r) => r.is_correct).length / rs.length) * 100)}%` : "—"}</span>
                    </p>
                  </div>
                );
              })}
            </div>
          </Card>
          </>
          ) : null}
          </>
          ) : null}
        </div>
      )}
    </AppShell>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl bg-background p-4">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="mt-1 font-display text-2xl font-bold">{value}</p>
    </div>
  );
}
