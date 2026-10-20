import { TEAM_ICONS, teamBg, type Team } from "@/lib/teams";

/** Team identity: color + icon + name + number — never color alone. */
export function TeamBadge({ team, number, size = "md", className = "" }: { team: Team; number?: number; size?: "sm" | "md" | "lg"; className?: string }) {
  const Icon = TEAM_ICONS[team.icon] ?? TEAM_ICONS.star;
  const pad = size === "lg" ? "px-4 py-2.5 text-lg gap-2.5" : size === "sm" ? "px-2 py-0.5 text-xs gap-1" : "px-3 py-1.5 text-sm gap-1.5";
  const ic = size === "lg" ? "size-5" : size === "sm" ? "size-3" : "size-4";
  return (
    <span className={`inline-flex items-center rounded-full font-bold ${pad} ${className}`} style={teamBg(team.color)}>
      <Icon className={ic} aria-hidden />
      <span className="truncate">{team.name}</span>
      {number ? <span className="opacity-75">#{number}</span> : null}
    </span>
  );
}

export function TeamIconTile({ team, className = "size-10" }: { team: Team; className?: string }) {
  const Icon = TEAM_ICONS[team.icon] ?? TEAM_ICONS.star;
  return (
    <span className={`grid shrink-0 place-items-center rounded-xl ${className}`} style={teamBg(team.color)} aria-hidden>
      <Icon className="size-1/2" />
    </span>
  );
}
