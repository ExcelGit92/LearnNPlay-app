import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { ICON_KEYS, TEAM_COLORS, type Team } from "@/lib/teams";

/** Reusable team configuration only — never players, scores or session data. */
export type TemplateTeam = Pick<Team, "name" | "color" | "icon">;
export type TemplateSettings = { allowChoice?: boolean };
export type TeamTemplate = {
  id: string;
  name: string;
  teams: TemplateTeam[];
  settings: TemplateSettings;
  updatedAt: string;
};

type Row = { id: string; name: string; teams: unknown; settings: unknown; updated_at: string };
const toTpl = (r: Row): TeamTemplate => ({
  id: r.id,
  name: r.name,
  teams: (r.teams as TemplateTeam[]) ?? [],
  settings: (r.settings as TemplateSettings) ?? {},
  updatedAt: r.updated_at,
});

export function useTeamTemplates() {
  const { data, isLoading } = useQuery({
    queryKey: ["team-templates"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("team_templates")
        .select("id, name, teams, settings, updated_at")
        .order("updated_at", { ascending: false });
      if (error) throw error;
      return (data as Row[]).map(toTpl);
    },
  });
  return { templates: data ?? [], loading: isLoading };
}

/** Strips anything that isn't reusable configuration. */
export const cleanTeams = (teams: TemplateTeam[]): TemplateTeam[] =>
  teams.map((t) => ({ name: t.name.trim(), color: t.color, icon: t.icon }));

export function validateTemplate(name: string, teams: TemplateTeam[]): string | null {
  if (!name.trim()) return "Please give the template a name.";
  if (name.trim().length > 60) return "Template name is too long (max 60 characters).";
  if (teams.length < 1) return "Add at least one team.";
  if (teams.length > 8) return "A template can have at most 8 teams.";
  const seen = new Set<string>();
  for (const [i, t] of teams.entries()) {
    const n = t.name.trim();
    if (!n) return `Team ${i + 1} needs a name.`;
    if (n.length > 24) return `Team ${i + 1}'s name is too long (max 24 characters).`;
    if (!(TEAM_COLORS as readonly string[]).includes(t.color))
      return `Team ${i + 1} has an invalid color.`;
    if (!ICON_KEYS.includes(t.icon)) return `Team ${i + 1} has an invalid icon.`;
    const k = n.toLowerCase();
    if (seen.has(k)) return `Two teams are both called "${n}". Team names must be different.`;
    seen.add(k);
  }
  return null;
}

export async function saveTeamTemplate(
  orgId: string,
  tpl: {
    id?: string | undefined;
    name: string;
    teams: TemplateTeam[];
    settings?: TemplateSettings;
  },
) {
  const err = validateTemplate(tpl.name, tpl.teams);
  if (err) throw new Error(err);
  const row = {
    name: tpl.name.trim(),
    teams: cleanTeams(tpl.teams),
    settings: { allowChoice: !!tpl.settings?.allowChoice },
    updated_at: new Date().toISOString(),
  };
  const { error } = tpl.id
    ? await supabase
        .from("team_templates")
        .update(row as never)
        .eq("id", tpl.id)
    : await supabase.from("team_templates").insert({ ...row, org_id: orgId } as never);
  if (error) throw error;
}

export async function deleteTeamTemplate(id: string) {
  const { error } = await supabase.from("team_templates").delete().eq("id", id);
  if (error) throw error;
}

/** Fresh, independent session copy of a template's teams (new ids each time). */
export const teamsFromTemplate = (tpl: TeamTemplate): Team[] =>
  tpl.teams.slice(0, 8).map((t) => ({ ...t, id: Math.random().toString(36).slice(2, 8) }));
