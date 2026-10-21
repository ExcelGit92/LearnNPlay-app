import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { gami, questionBasePoints, smallestTeam, type Team, type TeamSettings } from "./teams";

async function admin() {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  return supabaseAdmin;
}

function token() {
  const b = new Uint8Array(24);
  crypto.getRandomValues(b);
  return Array.from(b, (x) => x.toString(16).padStart(2, "0")).join("");
}

async function verify(participantId: string, tok: string) {
  const db = await admin();
  const { data } = await db
    .from("participant_tokens")
    .select("token")
    .eq("participant_id", participantId)
    .maybeSingle();
  if (!data || data.token !== tok)
    throw new Error("Your seat in this session is no longer valid. Please join again.");
  return db;
}

/** Public: join a live session by PIN — no account needed. */
export const joinLiveSession = createServerFn({ method: "POST" })
  .inputValidator((d) =>
    z
      .object({
        pin: z.string().regex(/^\d{4,6}$/),
        name: z.string().trim().min(1).max(30),
        avatar: z.string().min(1).max(8),
        lang: z.string().min(2).max(8).nullable(),
        team: z.string().max(16).nullable().optional(),
      })
      .parse(d),
  )
  .handler(async ({ data }) => {
    const db = await admin();
    const { data: session } = await db
      .from("live_sessions")
      .select("id, status, languages, competition_mode, teams, teams_locked, team_settings, org_id")
      .eq("pin", data.pin)
      .neq("status", "ended")
      .maybeSingle();
    if (!session) throw new Error("That PIN doesn't match a live session.");

    // Check subscription limits for participants
    const { canAddParticipants } = await import("./subscription-limits");
    const { data: currentParticipants } = await db
      .from("participants")
      .select("id")
      .eq("session_id", session.id);
    const participantCount = currentParticipants?.length || 0;
    const limitCheck = await canAddParticipants(session.org_id, participantCount);

    if (!limitCheck.allowed) {
      throw new Error(
        `This session has reached the participant limit (${limitCheck.limit}). The host needs to upgrade their plan to allow more participants.`,
      );
    }

    const cfg = session.languages as { mode: string; primary: string; secondary?: string | null };
    const allowed = [cfg.primary, ...(cfg.mode === "dual" && cfg.secondary ? [cfg.secondary] : [])];
    const lang = data.lang && allowed.includes(data.lang) ? data.lang : cfg.primary;
    let team: string | null = null;
    const teams = (session.teams as Team[]) ?? [];
    if (session.competition_mode !== "individual" && teams.length) {
      const ts = (session.team_settings as TeamSettings) ?? {};
      if (
        ts.allowChoice &&
        !session.teams_locked &&
        data.team &&
        teams.some((t) => t.id === data.team)
      )
        team = data.team;
      else {
        // Optimize: fetch team assignment in single query with count
        const { data: teamCounts } = await db
          .from("participants")
          .select("team")
          .eq("session_id", session.id);
        team = smallestTeam(
          teams,
          (teamCounts ?? []).map((o) => o.team),
        );
      }
    }
    const { data: p, error } = await db
      .from("participants")
      .insert({ session_id: session.id, name: data.name, avatar: data.avatar, lang, team })
      .select("id")
      .single();
    if (error || !p) {
      console.error("[joinLiveSession] insert failed", error);
      throw new Error("Unable to join this session. Please try again.");
    }
    const t = token();
    await db.from("participant_tokens").insert({ participant_id: p.id, token: t });
    return { participantId: p.id, token: t, sessionId: session.id };
  });

/** Public: submit an answer. Scoring happens here so nobody can fake points. */
export const submitLiveAnswer = createServerFn({ method: "POST" })
  .inputValidator((d) =>
    z
      .object({
        participantId: z.string().uuid(),
        token: z.string().min(10),
        choice: z.number().int().min(0).max(9),
      })
      .parse(d),
  )
  .handler(async ({ data }) => {
    const db = await verify(data.participantId, data.token);
    const { data: p } = await db
      .from("participants")
      .select("id, session_id, score, streak, best_streak, correct_count, answered_count, total_ms")
      .eq("id", data.participantId)
      .single();
    if (!p) throw new Error("Participant not found.");
    const { data: s } = await db
      .from("live_sessions")
      .select("id, status, idx, question_started_at, quiz_id, gamification")
      .eq("id", p.session_id)
      .single();
    if (!s || s.status !== "question") throw new Error("Answers are closed for this question.");
    const { data: quiz } = await db
      .from("quizzes")
      .select("questions")
      .eq("id", s.quiz_id!)
      .single();
    const q = (
      (quiz?.questions ?? []) as Array<{
        correct: number;
        seconds: number;
        points?: number;
        difficulty?: string;
      }>
    )[s.idx];
    if (!q) throw new Error("Question not found.");
    const elapsed = (Date.now() - new Date(s.question_started_at ?? Date.now()).getTime()) / 1000;
    if (elapsed > q.seconds + 2) throw new Error("Time's up for this question.");
    const isCorrect = data.choice === q.correct;
    const speed = Math.max(0, 1 - elapsed / q.seconds);
    const g = gami(s.gamification as never);
    // Base comes from difficulty when enabled for this session; speed bonus/streak bonus apply on top unchanged.
    const base = questionBasePoints(q, g);
    const basePoints = isCorrect ? Math.round(base * (0.6 + 0.4 * speed)) : 0;
    const streak = isCorrect ? p.streak + 1 : 0;
    // Optional bonuses (off by default so existing sessions score exactly as before).
    let bonus = 0;
    if (isCorrect && g.speedBonus)
      bonus += Math.round(Math.max(0, Math.min(1000, g.maxSpeedBonus)) * speed);
    if (isCorrect && g.streakBonus && streak >= 3) bonus += Math.min(250, (streak - 2) * 50);
    const points = basePoints + bonus;
    const ms = Math.round(elapsed * 1000);
    const { error } = await db.from("responses").insert({
      session_id: s.id,
      participant_id: p.id,
      question_index: s.idx,
      choice: data.choice,
      is_correct: isCorrect,
      points,
      bonus,
      ms,
    });
    if (error) throw new Error("You already answered this question.");
    await db
      .from("participants")
      .update({
        score: p.score + points,
        streak,
        best_streak: Math.max(p.best_streak, streak),
        correct_count: p.correct_count + (isCorrect ? 1 : 0),
        answered_count: p.answered_count + 1,
        total_ms: p.total_ms + ms,
      })
      .eq("id", p.id);
    return { points, bonus, streak, questionIndex: s.idx };
  });

/** Public: change the participant's preferred language (if the trainer allows it). */
export const setLiveLanguage = createServerFn({ method: "POST" })
  .inputValidator((d) =>
    z
      .object({
        participantId: z.string().uuid(),
        token: z.string().min(10),
        lang: z.string().min(2).max(8),
      })
      .parse(d),
  )
  .handler(async ({ data }) => {
    const db = await verify(data.participantId, data.token);
    const { data: p } = await db
      .from("participants")
      .select("session_id")
      .eq("id", data.participantId)
      .single();
    const { data: s } = await db
      .from("live_sessions")
      .select("languages, allow_language_change")
      .eq("id", p!.session_id)
      .single();
    const cfg = s!.languages as { mode: string; primary: string; secondary?: string | null };
    const allowed = [cfg.primary, ...(cfg.mode === "dual" && cfg.secondary ? [cfg.secondary] : [])];
    if (!s!.allow_language_change || !allowed.includes(data.lang))
      throw new Error("Language can't be changed now.");
    await db.from("participants").update({ lang: data.lang }).eq("id", data.participantId);
    return { ok: true };
  });

/** Public: participant's own answer for the current question (survives refresh). */
export const getMyAnswer = createServerFn({ method: "POST" })
  .inputValidator((d) =>
    z
      .object({
        participantId: z.string().uuid(),
        token: z.string().min(10),
        questionIndex: z.number().int().min(0),
      })
      .parse(d),
  )
  .handler(async ({ data }) => {
    const db = await verify(data.participantId, data.token);
    const { data: r } = await db
      .from("responses")
      .select("choice, points")
      .eq("participant_id", data.participantId)
      .eq("question_index", data.questionIndex)
      .maybeSingle();
    return r ?? null;
  });

/** Public: participant switches team (only when the trainer allows choice and teams aren't locked). */
export const setLiveTeam = createServerFn({ method: "POST" })
  .inputValidator((d) =>
    z
      .object({
        participantId: z.string().uuid(),
        token: z.string().min(10),
        team: z.string().min(1).max(16),
      })
      .parse(d),
  )
  .handler(async ({ data }) => {
    const db = await verify(data.participantId, data.token);
    const { data: p } = await db
      .from("participants")
      .select("session_id")
      .eq("id", data.participantId)
      .single();
    const { data: s } = await db
      .from("live_sessions")
      .select("teams, teams_locked, team_settings, status")
      .eq("id", p!.session_id)
      .single();
    const teams = (s!.teams as Team[]) ?? [];
    const ts = (s!.team_settings as TeamSettings) ?? {};
    if (
      !ts.allowChoice ||
      s!.teams_locked ||
      s!.status !== "lobby" ||
      !teams.some((t) => t.id === data.team)
    )
      throw new Error("Teams can't be changed right now.");
    await db.from("participants").update({ team: data.team }).eq("id", data.participantId);
    return { ok: true };
  });

async function hostSession(
  ctx: { supabase: { rpc: (...a: never[]) => unknown } },
  sessionId: string,
) {
  const db = await admin();
  const { data: s } = await db
    .from("live_sessions")
    .select("id, org_id, teams")
    .eq("id", sessionId)
    .single();
  if (!s) throw new Error("Session not found.");
  const { data: ok } = await (
    ctx.supabase.rpc as unknown as (n: string, a: object) => Promise<{ data: boolean }>
  )("is_org_member", { _org: s.org_id });
  if (!ok) throw new Error("Not allowed.");
  return { db, teams: (s.teams as Team[]) ?? [] };
}

/** Trainer: move one participant to a team (or none). */
export const assignParticipantTeam = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z
      .object({
        sessionId: z.string().uuid(),
        participantId: z.string().uuid(),
        team: z.string().max(16).nullable(),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const { db, teams } = await hostSession(context as never, data.sessionId);
    if (data.team && !teams.some((t) => t.id === data.team)) throw new Error("Unknown team.");
    await db
      .from("participants")
      .update({ team: data.team })
      .eq("id", data.participantId)
      .eq("session_id", data.sessionId);
    return { ok: true };
  });

/** Trainer: shuffle everyone into teams as evenly as possible. Also fills unassigned / removed-team seats when `onlyUnassigned`. */
export const distributeTeams = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z.object({ sessionId: z.string().uuid(), onlyUnassigned: z.boolean().default(false) }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const { db, teams } = await hostSession(context as never, data.sessionId);
    if (!teams.length) throw new Error("Create at least one team first.");
    const { data: ps } = await db
      .from("participants")
      .select("id, team")
      .eq("session_id", data.sessionId);
    const ids = new Set(teams.map((t) => t.id));
    const all = ps ?? [];
    if (data.onlyUnassigned) {
      const current = all.map((p) => (p.team && ids.has(p.team) ? p.team : null));
      for (let i = 0; i < all.length; i++) {
        if (current[i]) continue;
        const t = smallestTeam(teams, current)!;
        current[i] = t;
        await db.from("participants").update({ team: t }).eq("id", all[i]!.id);
      }
    } else {
      const shuffled = [...all].sort(() => Math.random() - 0.5);
      await Promise.all(
        shuffled.map((p, i) =>
          db
            .from("participants")
            .update({ team: teams[i % teams.length]!.id })
            .eq("id", p.id),
        ),
      );
    }
    return { ok: true };
  });
