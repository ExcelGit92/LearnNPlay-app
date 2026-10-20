import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Copy, Pencil, Plus, Trash2 } from "lucide-react";
import { AppShell, Card } from "@/components/AppShell";
import { TeamIconTile } from "@/components/TeamBadge";
import { useOrgId } from "@/lib/learnplay";
import { COLOR_LABEL, ICON_KEYS, TEAM_COLORS, TEAM_ICONS, makeTeam, teamBg } from "@/lib/teams";
import {
  deleteTeamTemplate,
  saveTeamTemplate,
  useTeamTemplates,
  validateTemplate,
  type TeamTemplate,
  type TemplateTeam,
} from "@/lib/teamTemplates";

export const Route = createFileRoute("/_authenticated/templates")({
  head: () => ({
    meta: [
      { title: "Team templates — LearnNPlay" },
      { name: "description", content: "Save and reuse team setups for team training sessions." },
      { property: "og:title", content: "Team templates — LearnNPlay" },
      {
        property: "og:description",
        content: "Reusable team names, colors and icons for your organisation.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: TemplatesPage,
});

type Draft = { id?: string; name: string; teams: TemplateTeam[]; allowChoice: boolean };
const blank = (): Draft => ({
  name: "",
  teams: [0, 1].map((i) => {
    const { name, color, icon } = makeTeam(i);
    return { name, color, icon };
  }),
  allowChoice: false,
});

function TemplatesPage() {
  const orgId = useOrgId();
  const qc = useQueryClient();
  const { templates, loading } = useTeamTemplates();
  const [draft, setDraft] = useState<Draft | null>(null);
  const [confirmDel, setConfirmDel] = useState<TeamTemplate | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const refresh = () => qc.invalidateQueries({ queryKey: ["team-templates"] });
  const run = async (fn: () => Promise<unknown>) => {
    setError(null);
    setBusy(true);
    try {
      await fn();
      await refresh();
      return true;
    } catch (e) {
      console.error("[team-templates]", e);
      setError(e instanceof Error ? e.message : "Something went wrong.");
      return false;
    } finally {
      setBusy(false);
    }
  };

  const save = async () => {
    if (!draft || !orgId) return;
    const v = validateTemplate(draft.name, draft.teams);
    if (v) return setError(v);
    if (
      await run(() =>
        saveTeamTemplate(orgId, {
          id: draft.id,
          name: draft.name,
          teams: draft.teams,
          settings: { allowChoice: draft.allowChoice },
        }),
      )
    )
      setDraft(null);
  };
  const duplicate = (t: TeamTemplate) =>
    orgId &&
    run(() =>
      saveTeamTemplate(orgId, {
        name: `${t.name} – Copy`.slice(0, 60),
        teams: t.teams,
        settings: t.settings,
      }),
    );
  const patch = (i: number, p: Partial<TemplateTeam>) =>
    draft &&
    setDraft({ ...draft, teams: draft.teams.map((t, j) => (j === i ? { ...t, ...p } : t)) });
  const move = (i: number, d: -1 | 1) => {
    if (!draft) return;
    const j = i + d;
    if (j < 0 || j >= draft.teams.length) return;
    const teams = [...draft.teams];
    [teams[i], teams[j]] = [teams[j]!, teams[i]!];
    setDraft({ ...draft, teams });
  };

  return (
    <AppShell
      title="Team templates"
      subtitle="Save team setups once and reuse them in any Team or Individual + Team session."
      action={
        !draft ? (
          <button
            onClick={() => {
              setError(null);
              setDraft(blank());
            }}
            className="inline-flex items-center gap-1 rounded-xl bg-primary px-4 py-2 text-sm font-bold text-primary-foreground"
          >
            <Plus className="size-4" /> Create team template
          </button>
        ) : null
      }
    >
      {error && !draft ? (
        <p
          role="alert"
          className="mb-4 rounded-xl bg-destructive/10 px-3 py-2 text-sm text-destructive"
        >
          {error}
        </p>
      ) : null}

      {draft ? (
        <Card>
          <h2 className="font-display text-lg font-bold">
            {draft.id ? "Edit team template" : "New team template"}
          </h2>
          <label className="mt-4 block text-sm font-semibold">
            Template name
            <input
              value={draft.name}
              maxLength={60}
              onChange={(e) => setDraft({ ...draft, name: e.target.value })}
              placeholder="e.g. Medical Sales Teams"
              className="mt-1 w-full rounded-xl border border-border bg-surface px-3 py-2"
            />
          </label>
          <div className="mt-4 space-y-2">
            {draft.teams.map((t, i) => (
              <div key={i} className="rounded-2xl border border-border bg-background p-3">
                <div className="flex flex-wrap items-center gap-2">
                  <TeamIconTile team={{ id: String(i), ...t }} className="size-9" />
                  <span className="text-xs font-bold text-muted-foreground">#{i + 1}</span>
                  <input
                    value={t.name}
                    maxLength={24}
                    aria-label={`Team ${i + 1} name`}
                    onChange={(e) => patch(i, { name: e.target.value })}
                    className="min-w-0 flex-1 rounded-lg border border-border bg-surface px-2 py-1 text-sm font-semibold"
                  />
                  <select
                    value={t.color}
                    aria-label="Team color"
                    onChange={(e) => patch(i, { color: e.target.value as TemplateTeam["color"] })}
                    className="rounded-lg border border-border bg-surface px-2 py-1 text-sm"
                  >
                    {TEAM_COLORS.map((c) => (
                      <option key={c} value={c}>
                        {COLOR_LABEL[c]}
                      </option>
                    ))}
                  </select>
                  <button
                    aria-label="Move up"
                    disabled={i === 0}
                    onClick={() => move(i, -1)}
                    className="rounded-lg px-2 py-1 text-sm disabled:opacity-30"
                  >
                    ↑
                  </button>
                  <button
                    aria-label="Move down"
                    disabled={i === draft.teams.length - 1}
                    onClick={() => move(i, 1)}
                    className="rounded-lg px-2 py-1 text-sm disabled:opacity-30"
                  >
                    ↓
                  </button>
                  {draft.teams.length > 1 ? (
                    <button
                      aria-label={`Remove team ${i + 1}`}
                      onClick={() =>
                        setDraft({ ...draft, teams: draft.teams.filter((_, j) => j !== i) })
                      }
                      className="rounded-lg p-1.5 text-muted-foreground hover:bg-secondary"
                    >
                      <Trash2 className="size-4" />
                    </button>
                  ) : null}
                </div>
                <div className="mt-2 flex flex-wrap gap-1">
                  {ICON_KEYS.map((k) => {
                    const Icon = TEAM_ICONS[k];
                    return (
                      <button
                        key={k}
                        aria-label={k}
                        title={k}
                        onClick={() => patch(i, { icon: k })}
                        className="grid size-7 place-items-center rounded-lg"
                        style={t.icon === k ? teamBg(t.color) : undefined}
                      >
                        <Icon className="size-4" />
                      </button>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
          {draft.teams.length < 8 ? (
            <button
              onClick={() => {
                const { name, color, icon } = makeTeam(draft.teams.length);
                setDraft({ ...draft, teams: [...draft.teams, { name, color, icon }] });
              }}
              className="mt-3 inline-flex items-center gap-1 rounded-xl border border-border px-3 py-2 text-sm font-semibold"
            >
              <Plus className="size-4" /> Add team
            </button>
          ) : (
            <p className="mt-3 text-xs text-muted-foreground">Maximum of 8 teams reached.</p>
          )}
          <label className="mt-4 flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              className="accent-[var(--primary)]"
              checked={draft.allowChoice}
              onChange={(e) => setDraft({ ...draft, allowChoice: e.target.checked })}
            />
            Participants choose their own team
          </label>
          {error ? (
            <p
              role="alert"
              className="mt-3 rounded-xl bg-destructive/10 px-3 py-2 text-sm text-destructive"
            >
              {error}
            </p>
          ) : null}
          <div className="mt-4 flex gap-2">
            <button
              disabled={busy || !orgId}
              onClick={save}
              className="rounded-xl bg-primary px-4 py-2 text-sm font-bold text-primary-foreground disabled:opacity-50"
            >
              Save template
            </button>
            <button
              onClick={() => {
                setDraft(null);
                setError(null);
              }}
              className="rounded-xl border border-border px-4 py-2 text-sm font-semibold"
            >
              Cancel
            </button>
          </div>
        </Card>
      ) : loading ? (
        <p className="text-sm text-muted-foreground">Loading…</p>
      ) : templates.length === 0 ? (
        <Card>
          <p className="font-semibold">No saved team templates yet.</p>
          <p className="mt-1 text-sm text-muted-foreground">
            Create one here, or use "Save as team template" in a session's waiting room.
          </p>
        </Card>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {templates.map((t) => (
            <Card key={t.id}>
              <h3 className="font-display text-lg font-bold">{t.name}</h3>
              <p className="text-xs text-muted-foreground">
                {t.teams.length} teams · Updated {new Date(t.updatedAt).toLocaleDateString()}
              </p>
              <div className="mt-3 flex flex-wrap gap-1.5">
                {t.teams.map((tm, i) => (
                  <span
                    key={i}
                    className="inline-flex items-center gap-1.5 rounded-full border border-border px-2 py-0.5 text-xs font-semibold"
                  >
                    <TeamIconTile team={{ id: String(i), ...tm }} className="size-5" /> #{i + 1}{" "}
                    {tm.name}
                  </span>
                ))}
              </div>
              <p className="mt-3 text-xs text-muted-foreground">
                Apply it from the waiting room of any team session.
              </p>
              <div className="mt-3 flex flex-wrap gap-2">
                <button
                  onClick={() => {
                    setError(null);
                    setDraft({
                      id: t.id,
                      name: t.name,
                      teams: t.teams.map((x) => ({ ...x })),
                      allowChoice: !!t.settings.allowChoice,
                    });
                  }}
                  className="inline-flex items-center gap-1 rounded-xl border border-border px-3 py-1.5 text-sm font-semibold"
                >
                  <Pencil className="size-3.5" /> Edit
                </button>
                <button
                  disabled={busy}
                  onClick={() => duplicate(t)}
                  className="inline-flex items-center gap-1 rounded-xl border border-border px-3 py-1.5 text-sm font-semibold"
                >
                  <Copy className="size-3.5" /> Duplicate
                </button>
                <button
                  onClick={() => setConfirmDel(t)}
                  className="inline-flex items-center gap-1 rounded-xl border border-border px-3 py-1.5 text-sm font-semibold text-destructive"
                >
                  <Trash2 className="size-3.5" /> Delete
                </button>
              </div>
            </Card>
          ))}
        </div>
      )}

      {confirmDel ? (
        <div
          className="fixed inset-0 z-50 grid place-items-center bg-foreground/40 p-4"
          role="dialog"
          aria-modal="true"
        >
          <div className="w-full max-w-md rounded-2xl bg-surface p-5 shadow-lg">
            <h2 className="font-display text-lg font-bold">Delete this team template?</h2>
            <p className="mt-2 text-sm text-muted-foreground">
              This will permanently remove the saved template. Existing sessions that used this
              template will not be affected.
            </p>
            <div className="mt-4 flex justify-end gap-2">
              <button
                onClick={() => setConfirmDel(null)}
                className="rounded-xl border border-border px-4 py-2 text-sm font-semibold"
              >
                Cancel
              </button>
              <button
                disabled={busy}
                onClick={async () => {
                  const id = confirmDel.id;
                  setConfirmDel(null);
                  await run(() => deleteTeamTemplate(id));
                }}
                className="rounded-xl bg-destructive px-4 py-2 text-sm font-bold text-destructive-foreground"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </AppShell>
  );
}
