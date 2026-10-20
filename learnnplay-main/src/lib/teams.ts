import {
  Book,
  Brain,
  Crown,
  Diamond,
  Flame,
  Globe,
  Rocket,
  Shield,
  Star,
  Target,
  Trophy,
  Zap,
  type LucideIcon,
} from "lucide-react";

export type CompetitionMode = "individual" | "team" | "both";
export type TeamScoring = "total" | "average" | "accuracy";

export type Team = { id: string; name: string; color: TeamColor; icon: TeamIcon };

export type TeamSettings = {
  allowChoice?: boolean;
  autoBalance?: boolean;
  scoring?: TeamScoring;
};

export type Gamification = {
  speedBonus?: boolean;
  maxSpeedBonus?: number;
  streakBonus?: boolean;
  celebrations?: boolean;
  podium?: boolean;
  individualLeaderboard?: boolean;
  teamLeaderboard?: boolean;
  /** When on, a question's base points come from its difficulty instead of its own points value. */
  difficultyPoints?: boolean;
  pointsEasy?: number;
  pointsMedium?: number;
  pointsHard?: number;
};

export const DEFAULT_GAMIFICATION: Required<Gamification> = {
  speedBonus: false,
  maxSpeedBonus: 200,
  streakBonus: false,
  celebrations: true,
  podium: true,
  individualLeaderboard: true,
  teamLeaderboard: true,
  difficultyPoints: false,
  pointsEasy: 500,
  pointsMedium: 1000,
  pointsHard: 1500,
};

export type Difficulty = "easy" | "medium" | "hard";
export const DIFFICULTY_LABEL: Record<Difficulty, string> = {
  easy: "Easy",
  medium: "Medium",
  hard: "Hard",
};
/** Base points for a question. Off by default → existing per-question points (1000) as before. Missing difficulty → Medium. */
export function questionBasePoints(
  q: { points?: number; difficulty?: string | null },
  g: Required<Gamification>,
): number {
  if (!g.difficultyPoints) return q.points ?? 1000;
  const d = q.difficulty === "easy" || q.difficulty === "hard" ? q.difficulty : "medium";
  const v = d === "easy" ? g.pointsEasy : d === "hard" ? g.pointsHard : g.pointsMedium;
  return Math.max(0, Math.min(5000, Math.round(Number(v) || 0)));
}

export const gami = (g: Gamification | null | undefined): Required<Gamification> => ({
  ...DEFAULT_GAMIFICATION,
  ...(g ?? {}),
});

export const TEAM_COLORS = [
  "blue",
  "red",
  "green",
  "orange",
  "purple",
  "teal",
  "yellow",
  "pink",
] as const;
export type TeamColor = (typeof TEAM_COLORS)[number];
export const COLOR_LABEL: Record<TeamColor, string> = {
  blue: "Blue",
  red: "Red",
  green: "Green",
  orange: "Orange",
  purple: "Purple",
  teal: "Teal",
  yellow: "Yellow",
  pink: "Pink",
};

export const TEAM_ICONS = {
  star: Star,
  trophy: Trophy,
  lightning: Zap,
  rocket: Rocket,
  crown: Crown,
  shield: Shield,
  flame: Flame,
  diamond: Diamond,
  target: Target,
  globe: Globe,
  book: Book,
  brain: Brain,
} satisfies Record<string, LucideIcon>;
export type TeamIcon = keyof typeof TEAM_ICONS;
export const ICON_KEYS = Object.keys(TEAM_ICONS) as TeamIcon[];

const DEFAULT_NAMES = [
  "Alpha",
  "Bravo",
  "Champions",
  "Delta",
  "Echo",
  "Falcon",
  "Giants",
  "Horizon",
];

export function makeTeam(i: number): Team {
  return {
    id: Math.random().toString(36).slice(2, 8),
    name: DEFAULT_NAMES[i] ?? `Team ${i + 1}`,
    color: TEAM_COLORS[i % TEAM_COLORS.length]!,
    icon: ICON_KEYS[i % ICON_KEYS.length]!,
  };
}

export const teamBg = (c: TeamColor) => ({
  backgroundColor: `var(--team-${c})`,
  color: "var(--team-foreground)",
});

/** Picks the team with fewest members (ties → earliest team). */
export function smallestTeam(
  teams: Team[],
  memberTeams: (string | null | undefined)[],
): string | null {
  if (!teams.length) return null;
  const counts = new Map(teams.map((t) => [t.id, 0]));
  for (const m of memberTeams) if (m && counts.has(m)) counts.set(m, counts.get(m)! + 1);
  return [...teams].sort((a, b) => counts.get(a.id)! - counts.get(b.id)!)[0]!.id;
}

export type TeamMember = {
  id: string;
  team?: string | null;
  score: number;
  correct_count?: number;
  answered_count?: number;
  streak?: number;
};

export type TeamStanding = Team & {
  number: number;
  members: number;
  points: number;
  total: number;
  accuracy: number;
  correct: number;
  answers: number;
};

/** Team standings from server-written participant scores. Scoring method is pluggable. */
export function teamStandings(
  teams: Team[],
  members: TeamMember[],
  scoring: TeamScoring = "total",
): TeamStanding[] {
  return teams
    .map((t, i) => {
      const ms = members.filter((m) => m.team === t.id);
      const total = ms.reduce((a, m) => a + m.score, 0);
      const correct = ms.reduce((a, m) => a + (m.correct_count ?? 0), 0);
      const answers = ms.reduce((a, m) => a + (m.answered_count ?? 0), 0);
      const accuracy = answers ? Math.round((correct / answers) * 100) : 0;
      const points =
        scoring === "average"
          ? ms.length
            ? Math.round(total / ms.length)
            : 0
          : scoring === "accuracy"
            ? accuracy
            : total;
      return { ...t, number: i + 1, members: ms.length, points, total, accuracy, correct, answers };
    })
    .sort((a, b) => b.points - a.points || b.accuracy - a.accuracy);
}

/** Consecutive most-recent questions where a team's answering members were majority-correct. */
export function teamStreak(
  teamId: string,
  memberIds: Set<string>,
  responses: { participant_id: string; question_index: number; is_correct: boolean }[],
  upTo: number,
): number {
  let streak = 0;
  for (let q = upTo; q >= 0; q--) {
    const rs = responses.filter((r) => r.question_index === q && memberIds.has(r.participant_id));
    if (!rs.length) break;
    if (rs.filter((r) => r.is_correct).length * 2 <= rs.length) break;
    streak++;
  }
  void teamId;
  return streak;
}
