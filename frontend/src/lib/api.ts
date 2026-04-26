import type {
  Dynasty,
  Season,
  Player,
  Game,
  Recruit,
  PlayerSeasonStat,
  RosterSummary,
  RatingLeaders,
  StatLeaders,
  ImportResult,
} from "./types";

const BASE = "";

async function req<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(BASE + path, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(init?.headers || {}),
    },
  });
  if (!res.ok) {
    let detail: unknown = null;
    try {
      detail = await res.json();
    } catch {
      detail = await res.text();
    }
    const msg =
      typeof detail === "object" && detail && "detail" in detail
        ? String((detail as { detail: unknown }).detail)
        : typeof detail === "string"
          ? detail
          : `HTTP ${res.status}`;
    throw new Error(msg);
  }
  if (res.status === 204) return undefined as T;
  return (await res.json()) as T;
}

export const api = {
  // dynasty
  listDynasties: () => req<Dynasty[]>("/dynasties"),
  getDynasty: (id: number) => req<Dynasty>(`/dynasties/${id}`),
  createDynasty: (body: Partial<Dynasty>) =>
    req<Dynasty>("/dynasties", { method: "POST", body: JSON.stringify(body) }),
  updateDynasty: (id: number, patch: Partial<Dynasty>) =>
    req<Dynasty>(`/dynasties/${id}`, { method: "PATCH", body: JSON.stringify(patch) }),
  deleteDynasty: (id: number) => req<{ ok: boolean }>(`/dynasties/${id}`, { method: "DELETE" }),

  // seasons
  listSeasons: (dynastyId: number) => req<Season[]>(`/dynasties/${dynastyId}/seasons`),
  createSeason: (dynastyId: number, body: Partial<Season>) =>
    req<Season>(`/dynasties/${dynastyId}/seasons`, {
      method: "POST",
      body: JSON.stringify(body),
    }),

  // players
  listPlayers: (
    dynastyId: number,
    params: {
      pos_group?: string;
      pos?: string;
      year?: string;
      min_ovr?: number;
      search?: string;
    } = {},
  ) => {
    const q = new URLSearchParams();
    Object.entries(params).forEach(([k, v]) => {
      if (v !== undefined && v !== "" && v !== null) q.set(k, String(v));
    });
    const qs = q.toString();
    return req<Player[]>(`/dynasties/${dynastyId}/players${qs ? `?${qs}` : ""}`);
  },
  getPlayer: (dynastyId: number, id: number) =>
    req<Player>(`/dynasties/${dynastyId}/players/${id}`),
  updatePlayer: (dynastyId: number, id: number, patch: Partial<Player>) =>
    req<Player>(`/dynasties/${dynastyId}/players/${id}`, {
      method: "PATCH",
      body: JSON.stringify(patch),
    }),
  deletePlayer: (dynastyId: number, id: number) =>
    req<{ ok: boolean }>(`/dynasties/${dynastyId}/players/${id}`, { method: "DELETE" }),

  // player stats
  listPlayerStats: (dynastyId: number, playerId: number) =>
    req<PlayerSeasonStat[]>(`/dynasties/${dynastyId}/players/${playerId}/stats`),
  addPlayerStat: (dynastyId: number, playerId: number, body: Partial<PlayerSeasonStat>) =>
    req<PlayerSeasonStat>(`/dynasties/${dynastyId}/players/${playerId}/stats`, {
      method: "POST",
      body: JSON.stringify(body),
    }),
  updatePlayerStat: (
    dynastyId: number,
    playerId: number,
    statId: number,
    body: Partial<PlayerSeasonStat>,
  ) =>
    req<PlayerSeasonStat>(`/dynasties/${dynastyId}/players/${playerId}/stats/${statId}`, {
      method: "PATCH",
      body: JSON.stringify(body),
    }),
  deletePlayerStat: (dynastyId: number, playerId: number, statId: number) =>
    req<{ ok: boolean }>(`/dynasties/${dynastyId}/players/${playerId}/stats/${statId}`, {
      method: "DELETE",
    }),

  // games
  listGames: (seasonId: number) => req<Game[]>(`/seasons/${seasonId}/games`),
  createGame: (seasonId: number, body: Partial<Game>) =>
    req<Game>(`/seasons/${seasonId}/games`, { method: "POST", body: JSON.stringify(body) }),
  updateGame: (seasonId: number, id: number, patch: Partial<Game>) =>
    req<Game>(`/seasons/${seasonId}/games/${id}`, {
      method: "PATCH",
      body: JSON.stringify(patch),
    }),
  deleteGame: (seasonId: number, id: number) =>
    req<{ ok: boolean }>(`/seasons/${seasonId}/games/${id}`, { method: "DELETE" }),

  // recruits
  listRecruits: (
    dynastyId: number,
    params: { pos?: string; committed?: boolean; min_stars?: number } = {},
  ) => {
    const q = new URLSearchParams();
    Object.entries(params).forEach(([k, v]) => {
      if (v !== undefined && v !== null && v !== "") q.set(k, String(v));
    });
    const qs = q.toString();
    return req<Recruit[]>(`/dynasties/${dynastyId}/recruits${qs ? `?${qs}` : ""}`);
  },
  createRecruit: (dynastyId: number, body: Partial<Recruit>) =>
    req<Recruit>(`/dynasties/${dynastyId}/recruits`, {
      method: "POST",
      body: JSON.stringify(body),
    }),
  updateRecruit: (dynastyId: number, id: number, patch: Partial<Recruit>) =>
    req<Recruit>(`/dynasties/${dynastyId}/recruits/${id}`, {
      method: "PATCH",
      body: JSON.stringify(patch),
    }),
  deleteRecruit: (dynastyId: number, id: number) =>
    req<{ ok: boolean }>(`/dynasties/${dynastyId}/recruits/${id}`, { method: "DELETE" }),
  weeklyBudget: (dynastyId: number, cap = 50) =>
    req<{ cap: number; used: number; remaining: number }>(
      `/dynasties/${dynastyId}/recruits/budget/weekly?cap=${cap}`,
    ),

  // stats
  ratingLeaders: (dynastyId: number, limit = 10) =>
    req<RatingLeaders>(`/dynasties/${dynastyId}/stats/leaders/ratings?limit=${limit}`),
  statLeaders: (dynastyId: number, season_year: number) =>
    req<StatLeaders>(
      `/dynasties/${dynastyId}/stats/leaders/stats?season_year=${season_year}`,
    ),
  rosterSummary: (dynastyId: number) =>
    req<RosterSummary>(`/dynasties/${dynastyId}/stats/roster/summary`),

  // importer
  importRosterText: (dynastyId: number, csv: string, update_existing = true) =>
    req<ImportResult>(`/dynasties/${dynastyId}/import/roster/text`, {
      method: "POST",
      body: JSON.stringify({ csv, update_existing }),
    }),
  previewRoster: (dynastyId: number, csv: string) =>
    req<{ rows: unknown[]; warnings: string[]; count: number }>(
      `/dynasties/${dynastyId}/import/roster/preview`,
      {
        method: "POST",
        body: JSON.stringify({ csv, update_existing: true }),
      },
    ),
  importRosterFile: async (dynastyId: number, file: File, update_existing = true) => {
    const fd = new FormData();
    fd.append("file", file);
    fd.append("update_existing", String(update_existing));
    const res = await fetch(`/dynasties/${dynastyId}/import/roster/file`, {
      method: "POST",
      body: fd,
    });
    if (!res.ok) throw new Error(await res.text());
    return (await res.json()) as ImportResult;
  },
  importSeasonStatsText: (dynastyId: number, text: string, season_year?: number) =>
    req<ImportResult>(`/dynasties/${dynastyId}/import/season-stats/text`, {
      method: "POST",
      body: JSON.stringify({ text, season_year }),
    }),
  previewSeasonStats: (dynastyId: number, text: string) =>
    req<{ rows: unknown[]; warnings: string[]; count: number }>(
      `/dynasties/${dynastyId}/import/season-stats/preview`,
      {
        method: "POST",
        body: JSON.stringify({ text }),
      },
    ),
  importSeasonStatsFile: async (dynastyId: number, file: File, season_year?: number) => {
    const fd = new FormData();
    fd.append("file", file);
    if (season_year != null) fd.append("season_year", String(season_year));
    const res = await fetch(`/dynasties/${dynastyId}/import/season-stats/file`, {
      method: "POST",
      body: fd,
    });
    if (!res.ok) throw new Error(await res.text());
    return (await res.json()) as ImportResult;
  },
};
