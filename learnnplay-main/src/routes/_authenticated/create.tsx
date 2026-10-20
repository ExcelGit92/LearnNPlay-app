import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { generateQuizFromFile, runAssistantCommand } from "@/lib/quiz.functions";
import { AppShell, Card } from "@/components/AppShell";
import { LangText, LanguageSelect } from "@/components/Lang";
import {
  deleteGlossaryEntry,
  fromAiQuestions,
  isStale,
  saveQuiz,
  startLiveSession,
  toAiQuestions,
  upsertGlossaryEntry,
  useGlossary,
  useOrgId,
  type Question,
  type Quiz,
} from "@/lib/learnplay";
import {
  DISPLAY_MODES,
  getLang,
  hashSource,
  sessionLangs,
  STATUS_LABEL,
  type DisplayMode,
  type LanguageConfig,
  type LangCode,
  type TranslationStatus,
} from "@/lib/i18n";
import type { CompetitionMode } from "@/lib/teams";

const SESSION_MODES: { id: CompetitionMode; label: string; desc: string }[] = [
  { id: "individual", label: "Individual", desc: "Each participant competes individually." },
  { id: "team", label: "Team", desc: "Participants compete as teams." },
  { id: "both", label: "Individual + Team", desc: "Participants compete individually and as teams." },
];

export const Route = createFileRoute("/_authenticated/create")({
  head: () => ({
    meta: [
      { title: "Upload a deck — LearnNPlay" },
      {
        name: "description",
        content: "Upload a PPT or PDF and turn it into an editable, timed quiz in any two languages.",
      },
      { property: "og:title", content: "Upload a deck — LearnNPlay" },
      {
        property: "og:description",
        content: "Draft synchronized bilingual questions from your training content; edit and go live.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: CreatePage,
});

const STATUS_TONE: Record<TranslationStatus, string> = {
  not_translated: "bg-secondary text-muted-foreground",
  ai_translated: "bg-sun/15 text-foreground",
  reviewed: "bg-primary/10 text-primary",
  approved: "bg-mint/15 text-mint",
  needs_update: "bg-destructive/10 text-destructive",
};

function CreatePage() {
  const [fileName, setFileName] = useState<string | null>(null);
  const [filePath, setFilePath] = useState<string | null>(null);
  const [status, setStatus] = useState<"idle" | "reading" | "ready" | "generating">("idle");
  const [error, setError] = useState<string | null>(null);
  const [count, setCount] = useState(8);
  const [difficulty, setDifficulty] = useState<"easy" | "medium" | "hard" | "mixed">("mixed");
  const [types, setTypes] = useState<Array<"mcq" | "truefalse">>(["mcq", "truefalse"]);
  const [seconds, setSeconds] = useState(20);
  const [points, setPoints] = useState(1000);
  const [scenario, setScenario] = useState(true);
  const [explanations, setExplanations] = useState(true);
  const [hints, setHints] = useState(false);
  const [grounding, setGrounding] = useState<"strict" | "general">("strict");
  const [competitionMode, setCompetitionMode] = useState<CompetitionMode>("individual");
  const [langs, setLangs] = useState<LanguageConfig>({ mode: "dual", primary: "en", secondary: "bn" });
  const [quiz, setQuiz] = useState<Quiz | null>(null);
  const [view, setView] = useState<"l1" | "l2" | "both">("both");
  const [displayMode, setDisplayMode] = useState<DisplayMode>("both");
  const [allowChange, setAllowChange] = useState(true);
  const [saving, setSaving] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const navigate = useNavigate();
  const orgId = useOrgId();
  const qc = useQueryClient();
  const generateFn = useServerFn(generateQuizFromFile);

  async function handleFile(file: File) {
    setError(null);
    setQuiz(null);
    const lower = file.name.toLowerCase();
    if (lower.endsWith(".ppt")) return setError("Old .ppt files can't be read. Please save the deck as .pptx or PDF.");
    if (!lower.endsWith(".pptx") && !lower.endsWith(".pdf")) return setError("Please choose a .pptx or .pdf file.");
    if (file.size > 50 * 1024 * 1024) return setError("That file is over 50 MB.");
    if (!orgId) return setError("Your workspace is still loading — try again in a moment.");
    setFileName(file.name);
    setStatus("reading");
    const path = `${orgId}/${crypto.randomUUID()}-${file.name.replace(/[^\w.\-]+/g, "_")}`;
    const { error: upErr } = await supabase.storage.from("training-files").upload(path, file, file.type ? { contentType: file.type } : {});
    if (upErr) {
      setStatus("idle");
      return setError(`Upload failed: ${upErr.message}`);
    }
    setFilePath(path);
    setStatus("ready");
  }

  async function generate() {
    if (!fileName || !filePath) return;
    setStatus("generating");
    setError(null);
    try {
      const res = await generateFn({
        data: {
          filePath,
          fileName,
          languages: { mode: langs.mode, primary: langs.primary, secondary: langs.secondary ?? null },
          count,
          difficulty,
          types,
          seconds,
          points,
          scenario,
          explanations,
          hints,
          grounding,
        },
      });
      setQuiz({
        id: crypto.randomUUID(),
        title: res.ai.title || fileName,
        source: fileName,
        createdAt: Date.now(),
        languages: langs,
        filePath,
        extractedText: res.extracted,
        settings: { competitionMode, grounding, topics: res.ai.topics, objectives: res.ai.objectives, plan: res.ai.plan },
        questions: fromAiQuestions(res.ai.questions, res.langs),
      });
      setDisplayMode(langs.mode === "dual" ? "both" : "l1");
      setView("both");
      setStatus("ready");
    } catch (e) {
      setStatus("ready");
      setError(e instanceof Error ? e.message : "Generation failed.");
    }
  }

  async function persist(): Promise<Quiz | null> {
    if (!quiz || !orgId) return null;
    setSaving(true);
    try {
      const withMode: Quiz = { ...quiz, settings: { ...quiz.settings, competitionMode } };
      const id = await saveQuiz(orgId, withMode);
      const saved = { ...withMode, id };
      setQuiz(saved);
      qc.invalidateQueries({ queryKey: ["quizzes"] });
      return saved;
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not save.");
      return null;
    } finally {
      setSaving(false);
    }
  }

  function patch(id: string, changes: Partial<Question>) {
    setQuiz((q) =>
      q ? { ...q, questions: q.questions.map((x) => (x.id === id ? { ...x, ...changes } : x)) } : q,
    );
  }

  function patchTr(q: Question, lang: LangCode, changes: Partial<NonNullable<Question["translations"]>[string]>) {
    const cur = q.translations?.[lang] ?? {
      prompt: "",
      options: q.options.map(() => ""),
      status: "not_translated" as TranslationStatus,
      sourceHash: "",
    };
    const next = { ...cur, ...changes };
    // A manual edit counts as trainer review and syncs with the current source.
    if (("prompt" in changes || "options" in changes) && !("status" in changes)) {
      next.status = "reviewed";
      next.sourceHash = hashSource(q.prompt, q.options);
    }
    patch(q.id, { translations: { ...q.translations, [lang]: next } });
  }

  const active = quiz?.languages ?? langs;
  const [l1, l2] = sessionLangs(active);
  const dual = !!l2;

  return (
    <AppShell subtitle="AI quiz generator" title="Upload. Generate. Play.">
      <div className="grid gap-5 lg:grid-cols-5">
        <div className="space-y-5 lg:col-span-2">
          <Card>
            <h2 className="font-display text-lg font-bold">1 · Languages</h2>
            <div className="mt-3 grid grid-cols-2 gap-2 rounded-2xl bg-secondary p-1">
              {(["single", "dual"] as const).map((m) => (
                <button
                  key={m}
                  onClick={() => setLangs({ ...langs, mode: m, secondary: langs.secondary ?? "bn" })}
                  className={`rounded-xl py-2 text-sm font-semibold ${
                    langs.mode === m ? "bg-surface shadow-sm" : "text-muted-foreground"
                  }`}
                >
                  {m === "single" ? "Single language" : "Dual language"}
                </button>
              ))}
            </div>
            <div className="mt-3 grid gap-3 sm:grid-cols-2">
              <div>
                <label htmlFor="l1" className="text-xs font-semibold text-muted-foreground">
                  Language 1
                </label>
                <LanguageSelect
                  id="l1"
                  className="mt-1 w-full"
                  value={langs.primary}
                  exclude={langs.mode === "dual" ? langs.secondary : undefined}
                  onChange={(c) => setLangs({ ...langs, primary: c })}
                />
              </div>
              {langs.mode === "dual" ? (
                <div>
                  <label htmlFor="l2" className="text-xs font-semibold text-muted-foreground">
                    Language 2
                  </label>
                  <LanguageSelect
                    id="l2"
                    className="mt-1 w-full"
                    value={langs.secondary ?? "bn"}
                    exclude={langs.primary}
                    onChange={(c) => setLangs({ ...langs, secondary: c })}
                  />
                </div>
              ) : null}
            </div>
            {quiz ? (
              <p className="mt-3 text-xs text-muted-foreground">
                Changing languages applies the next time you generate.
              </p>
            ) : null}
          </Card>

          <Card>
            <h2 className="font-display text-lg font-bold">2 · Session mode</h2>
            <div className="mt-3 grid gap-2">
              {SESSION_MODES.map((m) => (
                <button
                  key={m.id}
                  onClick={() => setCompetitionMode(m.id)}
                  aria-pressed={competitionMode === m.id}
                  className={`rounded-2xl border px-4 py-3 text-left transition-colors ${
                    competitionMode === m.id
                      ? "border-primary bg-primary/5 shadow-sm"
                      : "border-border bg-background hover:border-primary/50"
                  }`}
                >
                  <p className="text-sm font-bold">{m.label}</p>
                  <p className="mt-0.5 text-xs text-muted-foreground">{m.desc}</p>
                </button>
              ))}
            </div>
            {competitionMode !== "individual" ? (
              <p className="mt-3 text-xs text-muted-foreground">
                Two starter teams are created automatically — you can rename, recolor and rebalance them in the waiting room.
              </p>
            ) : null}
          </Card>

          <Card>
            <h2 className="font-display text-lg font-bold">3 · Training content</h2>
            <input
              ref={inputRef}
              type="file"
              accept=".pptx,.pdf"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) handleFile(f);
                e.target.value = "";
              }}
            />
            <button
              onClick={() => inputRef.current?.click()}
              className="mt-4 w-full rounded-2xl border-2 border-dashed border-border p-6 text-center transition-colors hover:border-primary"
            >
              <p className="font-display font-bold">{fileName ?? "Choose a PPT or PDF"}</p>
              <p className="mt-1 text-xs text-muted-foreground">.pptx or .pdf, up to 50 MB</p>
            </button>

            {fileName ? (
              <div className="mt-4 rounded-2xl border border-border bg-background p-4">
                <div className="flex items-center gap-3">
                  <div className="grid size-10 shrink-0 place-items-center rounded-lg border border-border bg-surface text-xs font-bold text-muted-foreground">
                    {fileName.toLowerCase().endsWith(".pdf") ? "PDF" : "PPT"}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold">{fileName}</p>
                    <p className="text-xs text-muted-foreground">
                      {status === "reading" ? "Uploading securely…" : status === "generating" ? "AI is reading your content and writing questions…" : "Uploaded — ready to generate"}
                    </p>
                  </div>
                  {status === "ready" ? (
                    <span className="shrink-0 rounded-full bg-mint/10 px-2 py-1 text-xs font-semibold text-mint">
                      Ready
                    </span>
                  ) : null}
                </div>
                <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-border">
                  <div
                    className="h-full rounded-full bg-primary transition-all duration-700"
                    style={{ width: status === "reading" ? "35%" : status === "generating" ? "75%" : "100%" }}
                  />
                </div>
              </div>
            ) : null}

            <div className="mt-5 space-y-4">
              <div>
                <label className="text-sm font-semibold" htmlFor="count">
                  Questions to generate: {count}
                </label>
                <input id="count" type="range" min={3} max={20} value={count}
                  onChange={(e) => setCount(Number(e.target.value))} className="mt-2 w-full accent-[var(--primary)]" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <label className="text-xs font-semibold text-muted-foreground">
                  Difficulty
                  <select value={difficulty} onChange={(e) => setDifficulty(e.target.value as typeof difficulty)}
                    className="mt-1 w-full rounded-xl border border-border bg-background px-3 py-2 text-sm text-foreground">
                    <option value="mixed">Mixed</option>
                    <option value="easy">Easy</option>
                    <option value="medium">Medium</option>
                    <option value="hard">Hard</option>
                  </select>
                </label>
                <label className="text-xs font-semibold text-muted-foreground">
                  Source mode
                  <select value={grounding} onChange={(e) => setGrounding(e.target.value as typeof grounding)}
                    className="mt-1 w-full rounded-xl border border-border bg-background px-3 py-2 text-sm text-foreground">
                    <option value="strict">Uploaded content only</option>
                    <option value="general">Content + general knowledge</option>
                  </select>
                </label>
                <label className="text-xs font-semibold text-muted-foreground">
                  Timer (seconds)
                  <input type="number" min={5} max={300} value={seconds} onChange={(e) => setSeconds(Number(e.target.value))}
                    className="mt-1 w-full rounded-xl border border-border bg-background px-3 py-2 text-sm text-foreground" />
                </label>
                <label className="text-xs font-semibold text-muted-foreground">
                  Points per question
                  <input type="number" min={100} max={5000} step={100} value={points} onChange={(e) => setPoints(Number(e.target.value))}
                    className="mt-1 w-full rounded-xl border border-border bg-background px-3 py-2 text-sm text-foreground" />
                </label>
              </div>
              <div className="flex flex-wrap gap-x-4 gap-y-2 text-sm">
                {([["mcq", "Multiple choice"], ["truefalse", "True / False"]] as const).map(([t, label]) => (
                  <label key={t} className="flex items-center gap-2">
                    <input type="checkbox" className="accent-[var(--primary)]" checked={types.includes(t)}
                      onChange={(e) => setTypes(e.target.checked ? [...types, t] : types.filter((x) => x !== t).length ? types.filter((x) => x !== t) : types)} />
                    {label}
                  </label>
                ))}
                <label className="flex items-center gap-2"><input type="checkbox" className="accent-[var(--primary)]" checked={scenario} onChange={(e) => setScenario(e.target.checked)} />Scenario / practical</label>
                <label className="flex items-center gap-2"><input type="checkbox" className="accent-[var(--primary)]" checked={explanations} onChange={(e) => setExplanations(e.target.checked)} />Explanations</label>
                <label className="flex items-center gap-2"><input type="checkbox" className="accent-[var(--primary)]" checked={hints} onChange={(e) => setHints(e.target.checked)} />Hints</label>
              </div>
            </div>

            <button
              disabled={status !== "ready" || !filePath}
              onClick={generate}
              className="mt-5 w-full rounded-2xl bg-primary py-3.5 text-sm font-bold text-primary-foreground shadow-brand transition-colors hover:bg-primary-deep disabled:opacity-40 disabled:shadow-none"
            >
              {status === "generating"
                ? "Generating… this can take a minute"
                : langs.mode === "dual"
                  ? `Generate ${getLang(langs.primary).name} + ${getLang(langs.secondary).name} quiz`
                  : "Generate quiz"}
            </button>
            {error ? <p className="mt-3 rounded-xl bg-destructive/10 p-3 text-sm text-destructive">{error}</p> : null}
            <p className="mt-3 text-xs text-muted-foreground">
              Both language versions share one question, the same options and the same correct answer.
            </p>
          </Card>

          <GlossaryCard />
        </div>

        <div className="space-y-4 lg:col-span-3">
          {!quiz ? (
            <Card className="grid min-h-60 place-items-center text-center">
              <div>
                <p className="font-display text-lg font-bold">No questions yet</p>
                <p className="mt-1 text-sm text-muted-foreground">
                  Pick your languages, upload a deck and generate to see an editable quiz here.
                </p>
              </div>
            </Card>
          ) : (
            <>
              <Card>
                <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3">
                  <input
                    value={quiz.title}
                    onChange={(e) => setQuiz({ ...quiz, title: e.target.value })}
                    className="min-w-0 rounded-xl border border-border bg-background px-3 py-2 font-display text-lg font-bold"
                  />
                  <span className="shrink-0 text-sm text-muted-foreground">
                    {quiz.questions.length} questions
                  </span>
                </div>
                {dual ? (
                  <div className="mt-3 flex flex-wrap gap-2">
                    {(["l1", "l2", "both"] as const).map((v) => (
                      <button
                        key={v}
                        onClick={() => setView(v)}
                        className={`rounded-full px-3 py-1.5 text-xs font-semibold ${
                          view === v ? "bg-ink text-ink-foreground" : "bg-secondary text-muted-foreground"
                        }`}
                      >
                        {v === "l1" ? getLang(l1).name : v === "l2" ? getLang(l2).name : "Both"}
                      </button>
                    ))}
                  </div>
                ) : null}
              </Card>

              <AssistantCard quiz={quiz} onChange={setQuiz} />

              {quiz.settings?.plan ? (
                <Card>
                  <h3 className="font-display font-bold">Session plan</h3>
                  <p className="mt-2 whitespace-pre-wrap text-sm text-muted-foreground">{quiz.settings.plan}</p>
                </Card>
              ) : null}

              {quiz.questions.map((q, qi) => {
                const tr = l2 ? q.translations?.[l2] : undefined;
                const stale = l2 ? isStale(q, l2) : false;
                const showL1 = !dual || view !== "l2";
                const showL2 = dual && view !== "l1" && l2;
                return (
                  <Card key={q.id} className="rise-in">
                    <div className="grid grid-cols-[minmax(0,1fr)_auto] items-start gap-3">
                      <p className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                        Question {qi + 1} · {q.kind === "mcq" ? "Multiple choice" : "True / False"}
                        {q.style && q.style !== "knowledge" ? ` · ${q.style}` : ""}
                        {q.sourceRef ? ` · ${q.sourceRef}` : ""}
                      </p>
                      <div className="flex shrink-0 items-center gap-2">
                        <select
                          aria-label={`Question ${qi + 1} difficulty`}
                          value={q.difficulty ?? "medium"}
                          onChange={(e) => patch(q.id, { difficulty: e.target.value as "easy" | "medium" | "hard" })}
                          className="rounded-xl border border-border bg-background px-2 py-2 text-sm"
                        >
                          <option value="easy">Easy</option>
                          <option value="medium">Medium</option>
                          <option value="hard">Hard</option>
                        </select>
                        <input
                          type="number"
                          min={5}
                          max={120}
                          value={q.seconds}
                          onChange={(e) => patch(q.id, { seconds: Number(e.target.value) })}
                          className="w-16 rounded-xl border border-border bg-background px-2 py-2 text-sm"
                        />
                        <span className="text-xs text-muted-foreground">sec</span>
                      </div>
                    </div>

                    <div className={`mt-3 grid gap-4 ${showL1 && showL2 ? "xl:grid-cols-2" : ""}`}>
                      {showL1 ? (
                        <div className="min-w-0">
                          <p className="mb-1 text-xs font-bold text-muted-foreground">{getLang(l1).name}</p>
                          <textarea
                            lang={l1}
                            dir={getLang(l1).dir}
                            style={{ fontFamily: getLang(l1).font }}
                            value={q.prompt}
                            onChange={(e) => patch(q.id, { prompt: e.target.value })}
                            rows={2}
                            className="w-full resize-none rounded-xl border border-border bg-background px-3 py-2 text-sm font-semibold"
                          />
                          <div className="mt-2 grid gap-2">
                            {q.options.map((opt, oi) => (
                              <div
                                key={oi}
                                className={`flex items-center gap-2 rounded-xl border px-3 py-2 ${
                                  oi === q.correct ? "border-mint bg-mint/10" : "border-border bg-background"
                                }`}
                              >
                                <button
                                  onClick={() => patch(q.id, { correct: oi })}
                                  className={`size-5 shrink-0 rounded-full border-2 ${
                                    oi === q.correct ? "border-mint bg-mint" : "border-border"
                                  }`}
                                  aria-label={`Mark option ${oi + 1} correct`}
                                />
                                <input
                                  lang={l1}
                                  dir={getLang(l1).dir}
                                  style={{ fontFamily: getLang(l1).font }}
                                  value={opt}
                                  onChange={(e) => {
                                    const options = [...q.options];
                                    options[oi] = e.target.value;
                                    patch(q.id, { options });
                                  }}
                                  className="min-w-0 flex-1 bg-transparent text-sm outline-none"
                                />
                              </div>
                            ))}
                          </div>
                        </div>
                      ) : null}

                      {showL2 && l2 ? (
                        <div className="min-w-0">
                          <div className="mb-1 flex items-center justify-between gap-2">
                            <p className="text-xs font-bold text-muted-foreground">{getLang(l2).name}</p>
                            <select
                              aria-label="Translation status"
                              value={tr?.status ?? "not_translated"}
                              onChange={(e) => patchTr(q, l2, { status: e.target.value as TranslationStatus })}
                              className={`rounded-full px-2 py-1 text-[11px] font-semibold ${
                                STATUS_TONE[stale ? "needs_update" : (tr?.status ?? "not_translated")]
                              }`}
                            >
                              {Object.entries(STATUS_LABEL).map(([k, v]) => (
                                <option key={k} value={k}>
                                  {v}
                                </option>
                              ))}
                            </select>
                          </div>
                          {stale ? (
                            <div className="mb-2 rounded-xl border border-destructive/30 bg-destructive/5 p-2.5 text-xs">
                              <p className="font-semibold">
                                The {getLang(l1).name} text changed — this translation may be outdated.
                              </p>
                              <div className="mt-2 flex flex-wrap gap-1.5">
                                <button
                                  onClick={() => patchTr(q, l2, { status: "needs_update" })}
                                  className="rounded-lg bg-surface px-2 py-1 font-semibold"
                                >
                                  Mark for re-translation
                                </button>
                                <button
                                  onClick={() =>
                                    document.getElementById(`tr-${q.id}`)?.focus()
                                  }
                                  className="rounded-lg bg-surface px-2 py-1 font-semibold"
                                >
                                  Edit manually
                                </button>
                                <button
                                  onClick={() =>
                                    patchTr(q, l2, {
                                      status: "reviewed",
                                      sourceHash: hashSource(q.prompt, q.options),
                                    })
                                  }
                                  className="rounded-lg bg-surface px-2 py-1 font-semibold"
                                >
                                  Keep existing
                                </button>
                              </div>
                            </div>
                          ) : null}
                          <textarea
                            id={`tr-${q.id}`}
                            lang={l2}
                            dir={getLang(l2).dir}
                            style={{ fontFamily: getLang(l2).font }}
                            value={tr?.prompt ?? ""}
                            placeholder={`${getLang(l2).native} — not translated yet`}
                            onChange={(e) => patchTr(q, l2, { prompt: e.target.value })}
                            rows={2}
                            className="w-full resize-none rounded-xl border border-border bg-background px-3 py-2 text-sm font-semibold"
                          />
                          <div className="mt-2 grid gap-2">
                            {q.options.map((opt, oi) => (
                              <div
                                key={oi}
                                className={`flex items-center gap-2 rounded-xl border px-3 py-2 ${
                                  oi === q.correct ? "border-mint bg-mint/10" : "border-border bg-background"
                                }`}
                              >
                                <span className="w-4 shrink-0 text-xs font-bold text-muted-foreground">
                                  {String.fromCharCode(65 + oi)}
                                </span>
                                <input
                                  lang={l2}
                                  dir={getLang(l2).dir}
                                  style={{ fontFamily: getLang(l2).font }}
                                  value={tr?.options[oi] ?? ""}
                                  placeholder={opt}
                                  onChange={(e) => {
                                    const options = q.options.map((_, k) => tr?.options[k] ?? "");
                                    options[oi] = e.target.value;
                                    patchTr(q, l2, { options });
                                  }}
                                  className="min-w-0 flex-1 bg-transparent text-sm outline-none"
                                />
                              </div>
                            ))}
                          </div>
                        </div>
                      ) : null}
                    </div>

                    <button
                      onClick={() =>
                        setQuiz({ ...quiz, questions: quiz.questions.filter((x) => x.id !== q.id) })
                      }
                      className="mt-3 text-xs font-semibold text-muted-foreground hover:text-destructive"
                    >
                      Remove question
                    </button>
                  </Card>
                );
              })}

              <Card>
                <h3 className="font-display font-bold">Live session options</h3>
                <div className="mt-3 flex flex-wrap gap-2">
                  {DISPLAY_MODES.filter((m) => dual || m.id === "l1").map((m) => (
                    <button
                      key={m.id}
                      onClick={() => setDisplayMode(m.id)}
                      className={`rounded-full px-3 py-1.5 text-xs font-semibold ${
                        displayMode === m.id ? "bg-ink text-ink-foreground" : "bg-secondary text-muted-foreground"
                      }`}
                    >
                      {m.id === "l1"
                        ? `${getLang(l1).name} only`
                        : m.id === "l2" && l2
                          ? `${getLang(l2).name} only`
                          : m.label}
                    </button>
                  ))}
                </div>
                {dual ? (
                  <label className="mt-3 flex items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      checked={allowChange}
                      onChange={(e) => setAllowChange(e.target.checked)}
                      className="accent-[var(--primary)]"
                    />
                    Participants can switch language during the session
                  </label>
                ) : null}
              </Card>

              <div className="flex flex-wrap gap-3">
                <button
                  onClick={() =>
                    setQuiz({
                      ...quiz,
                      questions: [
                        ...quiz.questions,
                        {
                          id: crypto.randomUUID(),
                          kind: "mcq",
                          points: 1000,
                          prompt: "New question",
                          options: ["Option A", "Option B", "Option C", "Option D"],
                          correct: 0,
                          seconds: 20,
                          translations: {},
                        },
                      ],
                    })
                  }
                  className="rounded-2xl border border-border bg-surface px-5 py-3 text-sm font-semibold"
                >
                  Add question
                </button>
                <button
                  disabled={saving}
                  onClick={async () => {
                    if (await persist()) navigate({ to: "/library" });
                  }}
                  className="rounded-2xl border border-border bg-surface px-5 py-3 text-sm font-semibold"
                >
                  Save to library
                </button>
                <button
                  disabled={saving}
                  onClick={async () => {
                    const saved = await persist();
                    if (!saved || !orgId) return;
                    try {
                      await startLiveSession(orgId, saved, { displayMode, allowLanguageChange: allowChange });
                      qc.invalidateQueries({ queryKey: ["active-session"] });
                      navigate({ to: "/host" });
                    } catch (e) {
                      setError(e instanceof Error ? e.message : "Could not start the session.");
                    }
                  }}
                  className="rounded-2xl bg-primary px-5 py-3 text-sm font-bold text-primary-foreground shadow-brand transition-colors hover:bg-primary-deep"
                >
                  Start live session
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </AppShell>
  );
}

function GlossaryCard() {
  const glossary = useGlossary();
  const orgId = useOrgId();
  const qc = useQueryClient();
  const [term, setTerm] = useState("");
  const [lang, setLang] = useState<LangCode>("bn");
  const [value, setValue] = useState("");
  const refresh = () => qc.invalidateQueries({ queryKey: ["glossary"] });

  async function add() {
    if (!term.trim() || !orgId) return;
    const existing = glossary.find((g) => g.term.toLowerCase() === term.trim().toLowerCase());
    await upsertGlossaryEntry(orgId, {
      ...(existing ? { id: existing.id } : {}),
      term: existing?.term ?? term.trim(),
      translations: { ...(existing?.translations ?? {}), [lang]: value.trim() },
    });
    setTerm("");
    setValue("");
    refresh();
  }

  return (
    <Card>
      <h2 className="font-display text-lg font-bold">Organization glossary</h2>
      <p className="mt-1 text-xs text-muted-foreground">
        The AI uses these approved terms when generating and translating. Leave the translation empty to keep a
        brand or scientific name unchanged.
      </p>
      <div className="mt-3 grid gap-2">
        <input value={term} onChange={(e) => setTerm(e.target.value)} placeholder="Term, e.g. Paracetamol"
          className="rounded-xl border border-border bg-background px-3 py-2 text-sm" />
        <div className="grid grid-cols-[auto_minmax(0,1fr)] gap-2">
          <LanguageSelect value={lang} onChange={setLang} exclude="en" />
          <input lang={lang} dir={getLang(lang).dir} value={value} onChange={(e) => setValue(e.target.value)} placeholder="Approved translation"
            className="min-w-0 rounded-xl border border-border bg-background px-3 py-2 text-sm" />
        </div>
        <button onClick={add} className="rounded-xl bg-ink py-2 text-sm font-semibold text-ink-foreground">Add term</button>
      </div>
      {glossary.length ? (
        <ul className="mt-3 space-y-1.5">
          {glossary.map((g) => (
            <li key={g.id} className="flex items-start justify-between gap-2 rounded-xl bg-background px-3 py-2 text-sm">
              <div className="min-w-0">
                <p className="font-semibold">{g.term}</p>
                {Object.entries(g.translations).map(([code, t]) => (
                  <p key={code} className="text-xs text-muted-foreground">
                    {getLang(code).name}: <LangText lang={code}>{t || "(keep as is)"}</LangText>
                  </p>
                ))}
              </div>
              <button onClick={async () => { await deleteGlossaryEntry(g.id); refresh(); }}
                className="text-xs text-muted-foreground hover:text-destructive">Remove</button>
            </li>
          ))}
        </ul>
      ) : null}
    </Card>
  );
}

const SUGGESTIONS = [
  "Translate this quiz into Bangla.",
  "Make this session English + Arabic.",
  "Make the questions harder.",
  "Create more scenario-based questions.",
  "Create better distractors.",
  "Create a pre-test and post-test.",
];

function AssistantCard({ quiz, onChange }: { quiz: Quiz; onChange: (q: Quiz) => void }) {
  const run = useServerFn(runAssistantCommand);
  const [command, setCommand] = useState("");
  const [busy, setBusy] = useState(false);
  const [reply, setReply] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  async function send(text: string) {
    if (!text.trim() || busy) return;
    setBusy(true);
    setErr(null);
    setReply(null);
    const cfg = quiz.languages ?? { mode: "single" as const, primary: "en" };
    try {
      const { ai } = await run({
        data: {
          command: text,
          languages: { mode: cfg.mode, primary: cfg.primary, secondary: cfg.secondary ?? null },
          title: quiz.title,
          sourceText: quiz.extractedText ?? null,
          grounding: quiz.settings?.grounding ?? "strict",
          questions: toAiQuestions(quiz.questions, sessionLangs(cfg)),
        },
      });
      const next: LanguageConfig =
        ai.languages.mode === "dual" && ai.languages.secondary && ai.languages.secondary !== ai.languages.primary
          ? { mode: "dual", primary: ai.languages.primary, secondary: ai.languages.secondary }
          : { mode: "single", primary: ai.languages.primary };
      onChange({
        ...quiz,
        title: ai.title || quiz.title,
        languages: next,
        settings: { ...quiz.settings, plan: ai.plan ?? quiz.settings?.plan ?? null },
        questions: fromAiQuestions(ai.questions, sessionLangs(next), quiz.questions),
      });
      setReply(ai.reply);
      setCommand("");
    } catch (e) {
      setErr(e instanceof Error ? e.message : "The assistant couldn't finish that.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card>
      <h3 className="font-display font-bold">AI Assistant</h3>
      <p className="mt-1 text-xs text-muted-foreground">Tell it what to change — it edits this quiz in place. Review before saving.</p>
      <div className="mt-3 flex flex-wrap gap-1.5">
        {SUGGESTIONS.map((s) => (
          <button key={s} disabled={busy} onClick={() => send(s)}
            className="rounded-full bg-secondary px-3 py-1.5 text-xs font-semibold text-muted-foreground hover:text-foreground disabled:opacity-50">
            {s}
          </button>
        ))}
      </div>
      <form onSubmit={(e) => { e.preventDefault(); send(command); }} className="mt-3 flex gap-2">
        <input value={command} onChange={(e) => setCommand(e.target.value)} disabled={busy}
          placeholder='e.g. "Keep pharmaceutical terms in English but translate explanations into Bangla"'
          className="min-w-0 flex-1 rounded-xl border border-border bg-background px-3 py-2 text-sm" />
        <button disabled={busy || !command.trim()} className="shrink-0 rounded-xl bg-primary px-4 py-2 text-sm font-bold text-primary-foreground disabled:opacity-40">
          {busy ? "Working…" : "Apply"}
        </button>
      </form>
      {busy ? <p className="mt-2 text-xs text-muted-foreground">Updating your quiz — this can take up to a minute.</p> : null}
      {reply ? <p className="mt-2 rounded-xl bg-mint/10 p-3 text-sm">{reply}</p> : null}
      {err ? <p className="mt-2 rounded-xl bg-destructive/10 p-3 text-sm text-destructive">{err}</p> : null}
    </Card>
  );
}
