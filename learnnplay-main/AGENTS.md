<!-- LOVABLE:BEGIN -->
> [!IMPORTANT]
> This project is connected to [Lovable](https://lovable.dev). Avoid rewriting
> published git history — force pushing, or rebasing/amending/squashing commits
> that are already pushed — as it rewrites history on Lovable's side and the
> user will likely lose their project history.
>
> Commits you push to the connected branch sync back to Lovable and show up in
> the editor, so keep the branch in a working state.
<!-- LOVABLE:END -->

- Data lives in Lovable Cloud; quizzes store questions+translations as JSON on the quiz row — keeps one linked question per language set.
- Participants join without accounts; join/answer/score go through public server fns in src/lib/live.functions.ts with a per-participant token — clients can't fake scores.
- Correct answers never go to participants: live_sessions.public_questions omits them; revealed_correct is set at reveal.
- AI calls use raw Responses API streaming in src/lib/ai.server.ts with strict JSON schemas (src/lib/quiz-ai.server.ts).
- Teams/gamification config lives on live_sessions (competition_mode, teams, team_settings, gamification); team scores are derived from server-written participant stats via src/lib/teams.ts — no client-side score writes.
