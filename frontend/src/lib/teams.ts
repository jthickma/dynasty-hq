import { TEAMS as GENERATED_TEAMS, type TeamMeta } from "./teams.generated";

export type { TeamMeta };

const MANUAL_TEAMS: TeamMeta[] = [
  { name: "Boston College", slug: "boston-college", logo: "/teams/boston-college.png", primary: "#862633", secondary: "#B5A36A" },
  { name: "Central Michigan", slug: "central-michigan", logo: "/teams/central-michigan.png", primary: "#6A0032", secondary: "#FFC82E" },
  { name: "Coastal Carolina", slug: "coastal-carolina", logo: "/teams/coastal-carolina.png", primary: "#006F71", secondary: "#876531" },
  { name: "Eastern Michigan", slug: "eastern-michigan", logo: "/teams/eastern-michigan.png", primary: "#006633", secondary: "#FFFFFF" },
  { name: "Georgia Southern", slug: "georgia-southern", logo: "/teams/georgia-southern.png", primary: "#00263A", secondary: "#87714D" },
  { name: "James Madison", slug: "james-madison", logo: "/teams/james-madison.png", primary: "#450084", secondary: "#CBB677" },
  { name: "Louisiana Tech", slug: "louisiana-tech", logo: "/teams/louisiana-tech.png", primary: "#002F8B", secondary: "#E31837" },
  { name: "Middle Tennessee", slug: "middle-tennessee", logo: "/teams/middle-tennessee.png", primary: "#0066CC", secondary: "#FFFFFF" },
  { name: "New Mexico St", slug: "new-mexico-st", logo: "/teams/new-mexico-st.png", primary: "#861F41", secondary: "#FFFFFF" },
  { name: "North Carolina", slug: "north-carolina", logo: "/teams/north-carolina.png", primary: "#7BAFD4", secondary: "#FFFFFF" },
  { name: "Northern Illinois", slug: "northern-illinois", logo: "/teams/northern-illinois.png", primary: "#CC0000", secondary: "#000000" },
  { name: "South Alabama", slug: "south-alabama", logo: "/teams/south-alabama.png", primary: "#00205B", secondary: "#BF0D3E" },
  { name: "South Carolina", slug: "south-carolina", logo: "/teams/south-carolina.png", primary: "#73000A", secondary: "#000000" },
  { name: "Southern Miss", slug: "southern-miss", logo: "/teams/southern-miss.png", primary: "#FFAA3C", secondary: "#000000" },
  { name: "Washington St", slug: "washington-st", logo: "/teams/washington-st.png", primary: "#981E32", secondary: "#5E6A71" },
  { name: "Western Kentucky", slug: "western-kentucky", logo: "/teams/western-kentucky.png", primary: "#C8102E", secondary: "#FFFFFF" },
  { name: "Western Michigan", slug: "western-michigan", logo: "/teams/western-michigan.png", primary: "#6C4023", secondary: "#B5A167" },
];

const _byName = new Map<string, TeamMeta>();
for (const t of GENERATED_TEAMS) _byName.set(t.name, t);
for (const t of MANUAL_TEAMS) if (!_byName.has(t.name)) _byName.set(t.name, t);

export const TEAMS: TeamMeta[] = [..._byName.values()].sort((a, b) => a.name.localeCompare(b.name));

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
  "jacksonville state": "Jax St",
  "jacksonville st": "Jax St",
  "jax state": "Jax St",
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
