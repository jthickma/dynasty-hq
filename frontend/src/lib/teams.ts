import { TEAMS, type TeamMeta } from "./teams.generated";

export type { TeamMeta };
export { TEAMS };

function normalize(s: string): string {
  return s
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/\./g, "")
    .replace(/-/g, " ")
    .replace(/\bst\b\.?/g, "state")
    .replace(/\buniversity of\b/g, "")
    .replace(/\buniversity\b/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

const ALIASES: Record<string, string> = {
  "ole miss": "Mississippi",
  "miss state": "Mississippi State",
  "miss st": "Mississippi State",
  "southern miss": "Southern Miss",
  "southern mississippi": "Southern Miss",
  "pitt": "Pittsburgh",
  "mia oh": "Miami OH",
  "miami ohio": "Miami OH",
  "miami fl": "Miami FL",
  "miami florida": "Miami FL",
  "fla state": "Florida State",
  "fla st": "Florida State",
  "fsu": "Florida State",
  "uga": "Georgia",
  "lsu": "LSU",
  "byu": "BYU",
  "tcu": "TCU",
  "smu": "SMU",
  "ucf": "UCF",
  "usf": "USF",
  "fau": "FAU",
  "fiu": "FIU",
  "uab": "UAB",
  "unlv": "UNLV",
  "utep": "UTEP",
  "utsa": "UTSA",
  "ulm": "ULM",
  "umass": "UMass",
  "uconn": "UConn",
  "ncst": "NC State",
  "north carolina state": "NC State",
  "nc state": "NC State",
  "north carolina": "North Carolina",
  "unc": "North Carolina",
  "louisiana monroe": "ULM",
  "louisiana lafayette": "Louisiana",
};

const INDEX = new Map<string, TeamMeta>();
for (const t of TEAMS) INDEX.set(normalize(t.name), t);

export function lookupTeam(name: string | null | undefined): TeamMeta | null {
  if (!name) return null;
  const n = normalize(name);
  if (INDEX.has(n)) return INDEX.get(n)!;
  if (ALIASES[n]) {
    const aliased = ALIASES[n];
    return INDEX.get(normalize(aliased)) ?? null;
  }
  // Try prefix match (handles "South Carolina St" -> "South Carolina St" etc.)
  for (const t of TEAMS) {
    const tn = normalize(t.name);
    if (tn === n) return t;
  }
  // Partial: longest team-name whose tokens are all present
  const tokens = new Set(n.split(" "));
  let best: TeamMeta | null = null;
  let bestScore = 0;
  for (const t of TEAMS) {
    const tt = normalize(t.name).split(" ");
    if (tt.every((w) => tokens.has(w)) && tt.length > bestScore) {
      bestScore = tt.length;
      best = t;
    }
  }
  return best;
}
