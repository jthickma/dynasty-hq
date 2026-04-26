export function ratingColor(value: number | null | undefined): string {
  if (value == null) return "text-ink-dim";
  if (value >= 90) return "text-emerald-400";
  if (value >= 80) return "text-lime-400";
  if (value >= 70) return "text-yellow-400";
  if (value >= 60) return "text-orange-400";
  return "text-red-400";
}

export function ratingBg(value: number | null | undefined): string {
  if (value == null) return "bg-bg-soft";
  if (value >= 90) return "bg-emerald-500/15";
  if (value >= 80) return "bg-lime-500/15";
  if (value >= 70) return "bg-yellow-500/15";
  if (value >= 60) return "bg-orange-500/15";
  return "bg-red-500/15";
}

export function devTraitColor(trait: string | null | undefined): string {
  switch (trait) {
    case "Elite":
      return "text-fuchsia-400";
    case "Star":
      return "text-amber-400";
    case "Impact":
      return "text-sky-400";
    default:
      return "text-ink-muted";
  }
}

export function classYearShort(year: string | null | undefined): string {
  if (!year) return "—";
  return year.replace(/\s+/g, " ").trim();
}

export function num(n: number | null | undefined, fallback = "—"): string {
  return n == null ? fallback : n.toLocaleString();
}
