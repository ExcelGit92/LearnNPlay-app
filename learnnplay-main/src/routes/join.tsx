import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import { joinLiveSession } from "@/lib/live.functions";
import { AVATARS, getUiLang, rowToSession, setSeat, setUiLang, type LiveSession } from "@/lib/learnplay";
import { getLang, sessionLangs } from "@/lib/i18n";
import { TeamBadge } from "@/components/TeamBadge";

export const Route = createFileRoute("/join")({
  // Search params like ?pin=206168 are auto-parsed as numbers — always normalise to a digit string.
  validateSearch: (s: Record<string, unknown>): { pin?: string } => {
    const raw = s["pin"];
    if (typeof raw !== "string" && typeof raw !== "number") return {};
    const pin = String(raw).replace(/\D/g, "").slice(0, 6);
    return pin ? { pin } : {};
  },
  head: () => ({
    meta: [
      { title: "Join a session — LearnNPlay" },
      { name: "description", content: "Enter the session PIN, pick a name, avatar and language, and play from your phone." },
      { property: "og:title", content: "Join a session — LearnNPlay" },
      { property: "og:description", content: "No app needed — join a live LearnNPlay quiz straight from your browser." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: JoinPage,
});

function JoinPage() {
  const search = Route.useSearch();
  const navigate = useNavigate();
  const join = useServerFn(joinLiveSession);
  const [pin, setPin] = useState(String(search.pin ?? ""));
  const [name, setName] = useState("");
  const [avatar, setAvatar] = useState<string>(AVATARS[0] ?? "🦊");
  const [lang, setLang] = useState<string | null>(null);
  const [team, setTeam] = useState<string | null>(null);
  const [session, setSession] = useState<LiveSession | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!/^\d{6}$/.test(pin)) return setSession(null);
    supabase
      .from("live_sessions")
      .select("*")
      .eq("pin", pin)
      .neq("status", "ended")
      .maybeSingle()
      .then(({ data }) => {
        const s = data ? rowToSession(data as never) : null;
        setSession(s);
        if (s) {
          const langs = sessionLangs(s.languages);
          const saved = getUiLang();
          setLang((cur) => cur ?? (langs.includes(saved) ? saved : langs[0]!));
        }
      });
  }, [pin]);

  async function submit() {
    setError(null);
    if (!name.trim()) return setError("Please enter your name.");
    setBusy(true);
    try {
      const seat = await join({ data: { pin, name: name.trim(), avatar, lang, team } });
      setSeat(seat);
      if (lang) setUiLang(lang);
      navigate({ to: "/play" });
    } catch (e) {
      console.error("[join] failed", e);
      setError(e instanceof Error && e.message ? e.message : "Unable to join this session. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  const langs = session ? sessionLangs(session.languages) : [];

  return (
    <div className="flex min-h-screen flex-col bg-ink px-5 py-8 text-ink-foreground">
      <Link to="/" className="flex items-center gap-2.5">
        <span className="grid size-9 place-items-center rounded-xl bg-primary font-display text-lg font-bold text-primary-foreground">L</span>
        <span className="font-display text-lg font-bold">LearnNPlay</span>
      </Link>

      <div className="mx-auto mt-10 w-full max-w-sm">
        <h1 className="font-display text-3xl font-bold">Join the session</h1>
        <p className="mt-1 text-sm text-ink-foreground/60">
          {session ? `${session.title} is live now.` : "Enter the 6-digit PIN your trainer shared."}
        </p>

        <label className="mt-7 block text-xs font-semibold uppercase tracking-widest text-ink-foreground/50">Session PIN</label>
        <input
          value={pin}
          onChange={(e) => setPin(e.target.value.replace(/\D/g, "").slice(0, 6))}
          inputMode="numeric"
          placeholder="000000"
          className="mt-2 w-full rounded-2xl bg-surface/10 px-5 py-5 text-center font-display text-4xl font-bold tracking-[0.3em] outline-none placeholder:text-ink-foreground/25"
        />

        <label className="mt-5 block text-xs font-semibold uppercase tracking-widest text-ink-foreground/50">Your name</label>
        <input
          value={name}
          onChange={(e) => setName(e.target.value.slice(0, 30))}
          placeholder="Nadia R."
          className="mt-2 w-full rounded-2xl bg-surface/10 px-5 py-4 text-lg font-semibold outline-none placeholder:text-ink-foreground/25"
        />

        <label className="mt-5 block text-xs font-semibold uppercase tracking-widest text-ink-foreground/50">Pick an avatar</label>
        <div className="mt-2 grid grid-cols-6 gap-2">
          {AVATARS.map((a) => (
            <button key={a} onClick={() => setAvatar(a)} className={`grid aspect-square place-items-center rounded-2xl text-2xl ${a === avatar ? "bg-primary" : "bg-surface/10"}`}>
              {a}
            </button>
          ))}
        </div>

        {langs.length > 1 ? (
          <>
            <label className="mt-5 block text-xs font-semibold uppercase tracking-widest text-ink-foreground/50">Preferred language</label>
            <div className="mt-2 grid grid-cols-2 gap-2">
              {langs.map((code) => (
                <button
                  key={code}
                  onClick={() => setLang(code)}
                  lang={code}
                  style={{ fontFamily: getLang(code).font }}
                  className={`rounded-2xl px-4 py-3 text-base font-semibold ${lang === code ? "bg-primary" : "bg-surface/10"}`}
                >
                  {getLang(code).native}
                </button>
              ))}
            </div>
          </>
        ) : null}

        {session && session.competitionMode !== "individual" && session.teamSettings.allowChoice && !session.teamsLocked && session.teams.length ? (
          <>
            <label className="mt-5 block text-xs font-semibold uppercase tracking-widest text-ink-foreground/50">Choose your team</label>
            <div className="mt-2 grid gap-2">
              {session.teams.map((t, i) => (
                <button key={t.id} onClick={() => setTeam(t.id)} aria-pressed={team === t.id}
                  className={`flex items-center rounded-2xl p-2 text-left ${team === t.id ? "ring-4 ring-primary" : "bg-surface/10"}`}>
                  <TeamBadge team={t} number={i + 1} />
                </button>
              ))}
            </div>
            <p className="mt-1 text-xs text-ink-foreground/50">Skip to be placed on a team automatically.</p>
          </>
        ) : null}

        {error ? <p className="mt-4 text-sm font-semibold text-sun">{error}</p> : null}

        <button
          onClick={submit}
          disabled={busy || pin.length !== 6}
          className="mt-6 w-full rounded-2xl bg-primary py-5 font-display text-lg font-bold text-primary-foreground transition-colors hover:bg-primary-deep disabled:opacity-50"
        >
          {busy ? "Joining…" : "Join"}
        </button>
      </div>
    </div>
  );
}
