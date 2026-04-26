import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { api } from "../lib/api";
import { useActiveDynasty } from "../hooks/useDynastyId";
import { PageHeader, Empty, Spinner } from "../components/UI";
import { POSITION_GROUPS } from "../lib/types";
import { ratingColor } from "../lib/format";

const STAT_LABELS: Record<string, string> = {
  passing_yards: "Passing yds",
  passing_tds: "Passing TD",
  rushing_yards: "Rushing yds",
  rushing_tds: "Rushing TD",
  receiving_yards: "Receiving yds",
  receiving_tds: "Receiving TD",
  receptions: "Receptions",
  tackles: "Tackles",
  sacks: "Sacks",
  interceptions: "Interceptions",
};

export function Stats() {
  const { active } = useActiveDynasty();
  const [year, setYear] = useState<number | null>(null);

  const seasons = useQuery({
    queryKey: ["seasons", active?.id],
    queryFn: () => api.listSeasons(active!.id),
    enabled: !!active,
  });

  useEffect(() => {
    if (seasons.data && seasons.data.length > 0 && year == null) {
      setYear(active?.current_season_year ?? seasons.data[seasons.data.length - 1].year);
    }
  }, [seasons.data, year, active]);

  const ratings = useQuery({
    queryKey: ["leaders-ratings-page", active?.id],
    queryFn: () => api.ratingLeaders(active!.id, 10),
    enabled: !!active,
  });

  const stats = useQuery({
    queryKey: ["leaders-stats", active?.id, year],
    queryFn: () => api.statLeaders(active!.id, year!),
    enabled: !!active && year != null,
  });

  if (!active) return <Empty title="Pick a dynasty" />;

  return (
    <>
      <PageHeader
        title="Leaders"
        actions={
          <select
            className="input w-auto"
            value={year ?? ""}
            onChange={(e) => setYear(Number(e.target.value))}
          >
            {(seasons.data ?? []).map((s) => (
              <option key={s.id} value={s.year}>
                {s.year}
              </option>
            ))}
          </select>
        }
      />

      <h2 className="font-semibold mb-2">Top OVR · {ratings.data?.overall.length ?? 0} players</h2>
      {ratings.isLoading ? (
        <Spinner />
      ) : (
        <div className="card overflow-hidden mb-6">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr>
                  <th className="table-th w-12">#</th>
                  <th className="table-th w-14">OVR</th>
                  <th className="table-th">Name</th>
                  <th className="table-th w-16">Pos</th>
                </tr>
              </thead>
              <tbody>
                {ratings.data?.overall.map((p, i) => (
                  <tr key={p.id} className="hover:bg-bg-hover">
                    <td className="table-td text-ink-muted stat-num">{i + 1}</td>
                    <td className={`table-td stat-num font-bold ${ratingColor(p.ovr)}`}>
                      {p.ovr ?? "—"}
                    </td>
                    <td className="table-td">
                      <Link
                        to={`/roster/${p.id}`}
                        className="hover:text-[color:var(--accent)] font-medium"
                      >
                        {p.name}
                      </Link>
                    </td>
                    <td className="table-td text-ink-muted">{p.pos ?? "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <h2 className="font-semibold mb-2">By position group</h2>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 mb-6">
        {POSITION_GROUPS.map((g) => {
          const list = ratings.data?.by_position_group[g] ?? [];
          return (
            <div key={g} className="card p-3">
              <div className="font-semibold text-sm mb-2">{g}</div>
              {list.length === 0 ? (
                <div className="text-xs text-ink-muted">no players</div>
              ) : (
                <ul className="divide-y divide-border/60">
                  {list.map((p) => (
                    <li key={p.id} className="py-1.5 flex items-center gap-2 text-sm">
                      <span className={`stat-num font-bold w-9 ${ratingColor(p.ovr)}`}>
                        {p.ovr ?? "—"}
                      </span>
                      <Link
                        to={`/roster/${p.id}`}
                        className="flex-1 truncate hover:text-[color:var(--accent)]"
                      >
                        {p.name}
                      </Link>
                      <span className="text-xs text-ink-muted">{p.pos}</span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          );
        })}
      </div>

      <h2 className="font-semibold mb-2">Stat leaders · {year ?? "—"}</h2>
      {stats.isLoading ? (
        <Spinner />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          {Object.entries(stats.data ?? {}).map(([key, list]) => (
            <div key={key} className="card p-3">
              <div className="font-semibold text-sm mb-2">{STAT_LABELS[key] ?? key}</div>
              {list.length === 0 ? (
                <div className="text-xs text-ink-muted">no data</div>
              ) : (
                <ul className="divide-y divide-border/60">
                  {list.map((row) => (
                    <li
                      key={row.player_id}
                      className="py-1.5 flex items-center gap-2 text-sm"
                    >
                      <Link
                        to={`/roster/${row.player_id}`}
                        className="flex-1 truncate hover:text-[color:var(--accent)]"
                      >
                        {row.name}
                      </Link>
                      <span className="text-xs text-ink-muted">{row.pos}</span>
                      <span className="stat-num font-bold">{row.value}</span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          ))}
        </div>
      )}
    </>
  );
}
