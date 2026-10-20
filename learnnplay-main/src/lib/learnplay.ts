import { useCallback, useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import {
  DEFAULT_LANGS,
  hashSource,
  sessionLangs,
  type DisplayMode,
  type GlossaryEntry,
  type LangCode,
  type LanguageConfig,
  type Translation,
} from "./i18n";
import type { AiQuestion, AiQuiz } from "./quiz-ai.server";
import { makeTeam, type CompetitionMode, type Gamification, type Team, type TeamSettings } from "./teams";

/* ---------------------------------- types ---------------------------------- */

export type QuestionKind = "mcq" | "truefalse";

export type Question = {
  id: string;
  kind: QuestionKind;
  prompt: string;
  /** Legacy single Bangla field — migrated into translations.bn on read. */
  promptBn?: string;
  options: string[];
  correct: number;
  seconds: number;
  points?: number;
  explanation?: string | null;
  hint?: string | null;
  style?: "knowledge" | "scenario" | "practical";
  difficulty?: "easy" | "medium" | "hard";
  sourceRef?: string | null;
  /** Localized versions of this same question, keyed by language code. */
  translations?: Record<LangCode, Translation>;
};

export type QuizSettings = {
  competitionMode?: CompetitionMode;
  grounding?: "strict" | "general";
  topics?: string[];
  objectives?: string[];
  plan?: string | null;
};

export type Quiz = {
  id: string;
  title: string;
  source: string;
  createdAt: number;
  languages?: LanguageConfig;
  questions: Question[];
  filePath?: string | null;
  extractedText?: string | null;
  settings?: QuizSettings;
};

/** What participants receive: no correct answers. */
export type PublicQuestion = Omit<Question, "correct">;

export type Participant = {
  id: string;
  name: string;
  avatar: string;
  score: number;
  lang?: LangCode | undefined;
  joinedAt?: string;
  team?: string | null;
  streak?: number;
  best_streak?: number;
  correct_count?: number;
  answered_count?: number;
  total_ms?: number;
};

export type LiveSession = {
  id: string;
  pin: string;
  quizId: string | null;
  title: string;
  status: "lobby" | "question" | "reveal" | "ended";
  index: number;
  questionStartedAt: number;
  displayMode: DisplayMode;
  allowLanguageChange: boolean;
  languages: LanguageConfig;
  questions: PublicQuestion[];
  revealedCorrect: number | null;
  createdAt: string;
  competitionMode: CompetitionMode;
  teams: Team[];
  teamsLocked: boolean;
  teamSettings: TeamSettings;
  gamification: Gamification;
};

export type ResponseRow = {
  participant_id: string;
  question_index: number;
  choice: number;
  is_correct: boolean;
  points: number;
};

export const AVATARS = ["🦊", "🐼", "🦉", "🐙", "🦋", "🐝", "🦁", "🐬", "🌵", "🚀", "🎧", "⚡"];

export const uid = () => Math.random().toString(36).slice(2, 10);
export const makePin = () => String(Math.floor(100000 + Math.random() * 900000));

/* --------------------------- localized question API -------------------------- */

export function normalizeQuestion<Q extends PublicQuestion>(q: Q): Q {
  if (q.translations || !q.promptBn) return q;
  return {
    ...q,
    translations: {
      bn: { prompt: q.promptBn, options: q.options, status: "ai_translated", sourceHash: hashSource(q.prompt, q.options) },
    },
  };
}

/** Text of a question in a given language, falling back to the base language. */
export function localized(
  q: PublicQuestion,
  lang: LangCode,
  base: LangCode,
): { prompt: string; options: string[]; explanation: string | null; hint: string | null; lang: LangCode; fallback: boolean } {
  const src = { prompt: q.prompt, options: q.options, explanation: q.explanation ?? null, hint: q.hint ?? null, lang: base, fallback: false };
  if (lang === base) return src;
  const t = normalizeQuestion(q).translations?.[lang];
  if (!t || !t.prompt.trim()) return { ...src, fallback: true };
  return {
    prompt: t.prompt,
    options: q.options.map((o, i) => (t.options[i]?.trim() ? t.options[i]! : o)),
    explanation: t.explanation ?? q.explanation ?? null,
    hint: t.hint ?? q.hint ?? null,
    lang,
    fallback: false,
  };
}

/** True when the base text changed after this translation was produced. */
export function isStale(q: Question, lang: LangCode): boolean {
  const t = q.translations?.[lang];
  return !!t && t.status !== "not_translated" && t.sourceHash !== hashSource(q.prompt, q.options);
}

/** Which language versions to render for this viewer under the session's display mode. */
export function visibleLangs(session: Pick<LiveSession, "languages" | "displayMode">, pref?: LangCode): LangCode[] {
  const langs = sessionLangs(session.languages);
  const [l1, l2] = langs;
  switch (session.displayMode ?? "both") {
    case "l1":
      return [l1!];
    case "l2":
      return [l2 ?? l1!];
    case "preferred":
      return pref && langs.includes(pref) ? [pref] : langs;
    default:
      return langs;
  }
}

export function ranked<P extends { score: number }>(participants: P[]): P[] {
  return [...participants].sort((a, b) => b.score - a.score);
}

/** Converts an AI quiz (versions per language) into the app's linked-translation model. */
export function fromAiQuestions(ai: AiQuestion[], langs: LangCode[], previous: Question[] = []): Question[] {
  const base = langs[0]!;
  return ai.map((q) => {
    const v = (code: string) => q.versions.find((x) => x.lang === code) ?? null;
    const src = v(base) ?? q.versions[0]!;
    const optionCount = Math.max(2, src.options.length);
    const options = src.options.slice(0, optionCount);
    const prev = q.id ? previous.find((p) => p.id === q.id) : undefined;
    const translations: Record<LangCode, Translation> = {};
    for (const code of langs.slice(1)) {
      const t = v(code);
      translations[code] = t
        ? {
            prompt: t.prompt,
            options: options.map((_, i) => t.options[i] ?? ""),
            explanation: t.explanation ?? undefined,
            hint: t.hint ?? undefined,
            status: "ai_translated",
            sourceHash: hashSource(src.prompt, options),
          }
        : { prompt: "", options: options.map(() => ""), status: "not_translated", sourceHash: "" };
    }
    return {
      id: prev?.id ?? crypto.randomUUID(),
      kind: q.kind,
      prompt: src.prompt,
      options,
      correct: Math.min(Math.max(0, q.correct), options.length - 1),
      seconds: Math.min(300, Math.max(5, q.seconds || 20)),
      points: Math.min(5000, Math.max(100, q.points || 1000)),
      explanation: src.explanation,
      hint: src.hint,
      style: q.style,
      difficulty: q.difficulty,
      sourceRef: q.source_ref,
      translations,
    };
  });
}

/** Shapes current questions for the AI assistant (versions per language). */
export function toAiQuestions(questions: Question[], langs: LangCode[]): AiQuestion[] {
  const base = langs[0]!;
  return questions.map((q) => ({
    id: q.id,
    kind: q.kind,
    style: q.style ?? "knowledge",
    difficulty: q.difficulty ?? "medium",
    correct: q.correct,
    seconds: q.seconds,
    points: q.points ?? 1000,
    source_ref: q.sourceRef ?? null,
    versions: langs.map((code) => {
      const t = localized(q, code, base);
      return { lang: code, prompt: t.fallback ? "" : t.prompt, options: t.fallback ? [] : t.options, explanation: t.explanation, hint: t.hint };
    }),
  }));
}

export type { AiQuiz };

/* ---------------------------------- auth ---------------------------------- */

export function useAuthUser() {
  const [state, setState] = useState<{ loading: boolean; userId: string | null; email: string | null }>({
    loading: true,
    userId: null,
    email: null,
  });
  useEffect(() => {
    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) =>
      setState({ loading: false, userId: s?.user.id ?? null, email: s?.user.email ?? null }),
    );
    supabase.auth.getSession().then(({ data }) =>
      setState({ loading: false, userId: data.session?.user.id ?? null, email: data.session?.user.email ?? null }),
    );
    return () => sub.subscription.unsubscribe();
  }, []);
  return state;
}

export function useOrgId(): string | null {
  const { data } = useQuery({
    queryKey: ["org"],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("ensure_my_org");
      if (error) throw error;
      return data as string;
    },
    staleTime: Infinity,
  });
  return data ?? null;
}

/* --------------------------------- quizzes --------------------------------- */

type QuizRow = {
  id: string;
  title: string;
  source: string;
  created_at: string;
  languages: unknown;
  questions: unknown;
  file_path: string | null;
  extracted_text: string | null;
  settings: unknown;
};

function rowToQuiz(r: QuizRow): Quiz {
  return {
    id: r.id,
    title: r.title,
    source: r.source,
    createdAt: new Date(r.created_at).getTime(),
    languages: (r.languages as LanguageConfig) ?? DEFAULT_LANGS,
    questions: ((r.questions as Question[]) ?? []).map(normalizeQuestion),
    filePath: r.file_path,
    extractedText: r.extracted_text,
    settings: (r.settings as QuizSettings) ?? {},
  };
}

export function useQuizzes(): { quizzes: Quiz[]; loading: boolean } {
  const { data, isLoading } = useQuery({
    queryKey: ["quizzes"],
    queryFn: async () => {
      const { data, error } = await supabase.from("quizzes").select("*").order("created_at", { ascending: false });
      if (error) throw error;
      return (data as QuizRow[]).map(rowToQuiz);
    },
  });
  return { quizzes: data ?? [], loading: isLoading };
}

export async function saveQuiz(orgId: string, quiz: Quiz): Promise<string> {
  const row = {
    org_id: orgId,
    title: quiz.title,
    source: quiz.source,
    languages: quiz.languages ?? DEFAULT_LANGS,
    questions: quiz.questions,
    file_path: quiz.filePath ?? null,
    extracted_text: quiz.extractedText ?? null,
    settings: quiz.settings ?? {},
    updated_at: new Date().toISOString(),
  };
  const isUuid = /^[0-9a-f-]{36}$/i.test(quiz.id);
  const q = isUuid
    ? supabase.from("quizzes").upsert({ id: quiz.id, ...row } as never).select("id").single()
    : supabase.from("quizzes").insert(row as never).select("id").single();
  const { data, error } = await q;
  if (error) throw error;
  return (data as { id: string }).id;
}

export async function deleteQuiz(id: string) {
  const { error } = await supabase.from("quizzes").delete().eq("id", id);
  if (error) throw error;
}

/* --------------------------------- glossary -------------------------------- */

export function useGlossary(): GlossaryEntry[] {
  const { data } = useQuery({
    queryKey: ["glossary"],
    queryFn: async () => {
      const { data, error } = await supabase.from("glossary_entries").select("id, term, translations").order("term");
      if (error) throw error;
      return (data ?? []) as GlossaryEntry[];
    },
  });
  return data ?? [];
}

export async function upsertGlossaryEntry(orgId: string, entry: { id?: string; term: string; translations: Record<string, string> }) {
  const { error } = entry.id
    ? await supabase.from("glossary_entries").update({ term: entry.term, translations: entry.translations }).eq("id", entry.id)
    : await supabase.from("glossary_entries").insert({ org_id: orgId, term: entry.term, translations: entry.translations });
  if (error) throw error;
}

export async function deleteGlossaryEntry(id: string) {
  const { error } = await supabase.from("glossary_entries").delete().eq("id", id);
  if (error) throw error;
}

/* ------------------------------- live sessions ------------------------------ */

type SessionRow = {
  id: string;
  pin: string;
  quiz_id: string | null;
  title: string;
  status: string;
  idx: number;
  question_started_at: string | null;
  display_mode: string;
  allow_language_change: boolean;
  languages: unknown;
  public_questions: unknown;
  revealed_correct: number | null;
  created_at: string;
  competition_mode?: string;
  teams?: unknown;
  teams_locked?: boolean;
  team_settings?: unknown;
  gamification?: unknown;
};

export function rowToSession(r: SessionRow): LiveSession {
  return {
    id: r.id,
    pin: r.pin,
    quizId: r.quiz_id,
    title: r.title,
    status: r.status as LiveSession["status"],
    index: r.idx,
    questionStartedAt: r.question_started_at ? new Date(r.question_started_at).getTime() : 0,
    displayMode: r.display_mode as DisplayMode,
    allowLanguageChange: r.allow_language_change,
    languages: (r.languages as LanguageConfig) ?? DEFAULT_LANGS,
    questions: (r.public_questions as PublicQuestion[]) ?? [],
    revealedCorrect: r.revealed_correct,
    createdAt: r.created_at,
    competitionMode: (r.competition_mode as CompetitionMode) ?? "individual",
    teams: (r.teams as Team[]) ?? [],
    teamsLocked: !!r.teams_locked,
    teamSettings: (r.team_settings as TeamSettings) ?? {},
    gamification: (r.gamification as Gamification) ?? {},
  };
}

function publicQuestions(quiz: Quiz): PublicQuestion[] {
  return quiz.questions.map(({ correct: _c, ...rest }) => {
    const translations: Record<string, Translation> = {};
    for (const [k, t] of Object.entries(rest.translations ?? {})) translations[k] = t;
    return { ...rest, translations };
  });
}

export async function startLiveSession(
  orgId: string,
  quiz: Quiz,
  opts: { displayMode?: DisplayMode; allowLanguageChange?: boolean; competitionMode?: CompetitionMode } = {},
): Promise<string> {
  const languages = quiz.languages ?? DEFAULT_LANGS;
  const mode = opts.competitionMode ?? quiz.settings?.competitionMode ?? "individual";
  for (let attempt = 0; attempt < 5; attempt++) {
    const { data, error } = await supabase
      .from("live_sessions")
      .insert({
        org_id: orgId,
        quiz_id: quiz.id,
        pin: makePin(),
        title: quiz.title,
        languages,
        display_mode: opts.displayMode ?? (sessionLangs(languages).length > 1 ? "both" : "l1"),
        allow_language_change: opts.allowLanguageChange ?? true,
        public_questions: publicQuestions(quiz),
        competition_mode: mode,
        ...(mode !== "individual" ? { teams: [makeTeam(0), makeTeam(1)] } : {}),
      } as never)
      .select("id")
      .single();
    if (!error && data) return (data as { id: string }).id;
    if (error && !/duplicate|unique/i.test(error.message)) throw error;
  }
  throw new Error("Could not create a session PIN. Please try again.");
}

export async function updateLiveSession(id: string, patch: Record<string, unknown>) {
  const { error } = await supabase.from("live_sessions").update(patch as never).eq("id", id);
  if (error) throw error;
}

/** Host: move the session to its next phase. Correct answers are revealed only at reveal time. */
export async function advanceSession(session: LiveSession, quiz: Quiz) {
  if (session.status === "lobby")
    return updateLiveSession(session.id, { status: "question", idx: 0, question_started_at: new Date().toISOString(), revealed_correct: null });
  if (session.status === "question")
    return updateLiveSession(session.id, { status: "reveal", revealed_correct: quiz.questions[session.index]?.correct ?? null });
  if (session.status === "reveal") {
    const next = session.index + 1;
    if (next >= quiz.questions.length)
      return updateLiveSession(session.id, { status: "ended", ended_at: new Date().toISOString() });
    return updateLiveSession(session.id, {
      status: "question",
      idx: next,
      question_started_at: new Date().toISOString(),
      revealed_correct: null,
    });
  }
}

/** Live session row + participants (+ responses for hosts), kept in sync in real time. */
export function useLiveSession(sessionId: string | null, opts: { withResponses?: boolean } = {}) {
  const qc = useQueryClient();
  const sessionQ = useQuery({
    queryKey: ["live", sessionId],
    enabled: !!sessionId,
    queryFn: async () => {
      const { data, error } = await supabase.from("live_sessions").select("*").eq("id", sessionId!).maybeSingle();
      if (error) throw error;
      return data ? rowToSession(data as SessionRow) : null;
    },
  });
  const participantsQ = useQuery({
    queryKey: ["live-participants", sessionId],
    enabled: !!sessionId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("participants")
        .select("id, name, avatar, score, lang, joined_at, team, streak, best_streak, correct_count, answered_count, total_ms")
        .eq("session_id", sessionId!)
        .order("joined_at");
      if (error) throw error;
      return (data ?? []).map((p) => ({ ...p, lang: p.lang ?? undefined, joinedAt: p.joined_at })) as Participant[];
    },
  });
  const responsesQ = useQuery({
    queryKey: ["live-responses", sessionId],
    enabled: !!sessionId && !!opts.withResponses,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("responses")
        .select("participant_id, question_index, choice, is_correct, points")
        .eq("session_id", sessionId!);
      if (error) throw error;
      return (data ?? []) as ResponseRow[];
    },
  });

  useEffect(() => {
    if (!sessionId) return;
    const channel = supabase
      .channel(`live-${sessionId}-${opts.withResponses ? "h" : "p"}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "live_sessions", filter: `id=eq.${sessionId}` }, (payload) => {
        if (payload.new && "id" in payload.new) qc.setQueryData(["live", sessionId], rowToSession(payload.new as SessionRow));
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "participants", filter: `session_id=eq.${sessionId}` }, () =>
        qc.invalidateQueries({ queryKey: ["live-participants", sessionId] }),
      );
    if (opts.withResponses)
      channel.on("postgres_changes", { event: "INSERT", schema: "public", table: "responses", filter: `session_id=eq.${sessionId}` }, () =>
        qc.invalidateQueries({ queryKey: ["live-responses", sessionId] }),
      );
    channel.subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [sessionId, opts.withResponses, qc]);

  return {
    session: sessionQ.data ?? null,
    loading: sessionQ.isLoading,
    participants: participantsQ.data ?? [],
    responses: responsesQ.data ?? [],
  };
}

/** Host's most recent session that hasn't ended. */
export function useActiveHostSession() {
  return useQuery({
    queryKey: ["active-session"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("live_sessions")
        .select("*")
        .neq("status", "ended")
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (error) throw error;
      return data ? rowToSession(data as SessionRow) : null;
    },
  });
}

export function answerCounts(responses: ResponseRow[], questionIndex: number, optionCount: number): number[] {
  const counts = Array.from({ length: optionCount }, () => 0);
  for (const r of responses) if (r.question_index === questionIndex && r.choice < optionCount) counts[r.choice] = (counts[r.choice] ?? 0) + 1;
  return counts;
}

/* ---------------------------- participant seat ---------------------------- */

export type Seat = { participantId: string; token: string; sessionId: string };
const KEY_SEAT = "lnp:seat";
const KEY_UI_LANG = "lnp:uiLang";

export function getSeat(): Seat | null {
  if (typeof window === "undefined") return null;
  try {
    return JSON.parse(window.localStorage.getItem(KEY_SEAT) ?? "null") as Seat | null;
  } catch {
    return null;
  }
}
export function setSeat(seat: Seat | null) {
  if (seat) window.localStorage.setItem(KEY_SEAT, JSON.stringify(seat));
  else window.localStorage.removeItem(KEY_SEAT);
}

export function useSeat(): Seat | null {
  const [seat, set] = useState<Seat | null>(null);
  useEffect(() => set(getSeat()), []);
  return seat;
}

export function getUiLang(): LangCode {
  if (typeof window === "undefined") return "en";
  return window.localStorage.getItem(KEY_UI_LANG) ?? "en";
}
export function setUiLang(code: LangCode) {
  window.localStorage.setItem(KEY_UI_LANG, code);
}

/* --------------------------------- utilities -------------------------------- */

export function useCountdown(startedAt: number, seconds: number, active: boolean) {
  const [left, setLeft] = useState(seconds);
  const tick = useCallback(() => {
    const elapsed = (Date.now() - startedAt) / 1000;
    setLeft(Math.max(0, Math.ceil(seconds - elapsed)));
  }, [startedAt, seconds]);
  useEffect(() => {
    if (!active) return;
    tick();
    const t = setInterval(tick, 250);
    return () => clearInterval(t);
  }, [active, tick]);
  return left;
}

export function useHydrated() {
  const [hydrated, setHydrated] = useState(false);
  useEffect(() => setHydrated(true), []);
  return hydrated;
}

export function downloadCsv(filename: string, rows: string[][]) {
  const esc = (v: string) => (/[",\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v);
  const csv = "\uFEFF" + rows.map((r) => r.map(esc).join(",")).join("\n");
  const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
