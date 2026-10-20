ALTER TABLE public.live_sessions
  ADD COLUMN IF NOT EXISTS competition_mode text NOT NULL DEFAULT 'individual',
  ADD COLUMN IF NOT EXISTS teams jsonb NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS teams_locked boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS team_settings jsonb NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS gamification jsonb NOT NULL DEFAULT '{}'::jsonb;
ALTER TABLE public.participants
  ADD COLUMN IF NOT EXISTS streak integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS best_streak integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS correct_count integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS answered_count integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS total_ms bigint NOT NULL DEFAULT 0;
ALTER TABLE public.responses ADD COLUMN IF NOT EXISTS bonus integer NOT NULL DEFAULT 0;
ALTER TABLE public.responses ADD COLUMN IF NOT EXISTS ms integer;