import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { api } from "../lib/api";
import { useActiveDynasty } from "../hooks/useDynastyId";
import { PageHeader, Stat, Empty, Spinner } from "../components/UI";
import { ratingColor, devTraitColor } from "../lib/format";
import { POSITION_GROUPS } from "../lib/types";

export function Dashboard() {
  const { active, dynasties, isLoading } = useActiveDynasty();

  if (isLoading) return <Spinner />;
  if (!active) {
    return (
      <Empty
        title="No dynasty yet"
        body="Create a dynasty to start tracking rosters, schedules, and recruits."
        action={
          <Link to="/dynasties" className="btn-primary">
            Create dynasty
          </Link>
        }
      />
    );
  }

  return (
    <>
      <PageHeader
        title={`${active.school} ${active.name}`}
        subtitle={`Season ${active.current_season_year} · Week ${active.current_week} · ${dynasties?.length ?? 1} dynasty${(dynasties?.length ?? 1) === 1 ? "" : "ies"}`}
      />
      <DashboardBody dynastyId={active.id} year={active.current_season_year} />
    </>
  );
}

function DashboardBody({ dynastyId, year }: { dynastyId: number; year: number }) {
  const summary = useQuery({
    queryKey: ["roster-summary", dynastyId],
    queryFn: () => api.rosterSummary(dynastyId),
  });
  const seasons = useQuery({
    queryKey: ["seasons", dynastyId],
    queryFn: () => api.listSeasons(dynastyId),
  });
  const ratings = useQuery({
    queryKey: ["leaders-ratings", dynastyId],
    queryFn: () => api.ratingLeaders(dynastyId, 5),
  });
  const budget = useQuery({
    queryKey: ["budget", dynastyId],
    queryFn: () => api.weeklyBudget(dynastyId),
  });

  const currentSeason = seasons.data?.find((s) => s.year === year);

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Stat
          label="Record"
          value={
            currentSeason
              ? `${currentSeason.wins}-${currentSeason.losses}`
              : "0-0"
          }
          hint={
            currentSeason
              ? `Conf ${currentSeason.conf_wins}-${currentSeason.conf_losses}`
              : "no games"
          }
          accent
        />
        <Stat
          label="Roster"
          value={summary.data?.total_players ?? "—"}
          hint={summary.data ? `Avg OVR ${summary.data.avg_ovr}` : ""}
        />
        <Stat
          label="Recruit hours"
          value={budget.data ? `${budget.data.used}/${budget.data.cap}` : "—"}
          hint={budget.data ? `${budget.data.remaining} remaining` : ""}
        />
        <Stat
          label="AP / CFP"
          value={
            currentSeason
              ? `${currentSeason.ap_rank ?? "—"} / ${currentSeason.cfp_rank ?? "—"}`
              : "—"
          }
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="card p-4">
          <div className="flex items-center justify-between mb-3">
            <h2 className="font-semibold">Top players</h2>
            <Link to="/roster" className="text-xs text-[color:var(--accent)] hover:underline">
              Full roster →
            </Link>
          </div>
          {ratings.isLoading ? (
            <Spinner />
          ) : (ratings.data?.overall.length ?? 0) === 0 ? (
            <div className="text-sm text-ink-muted py-4">
              No players yet. Use Import to load your roster.
            </div>
          ) : (
            <ul className="divide-y divide-border/60">
              {ratings.data?.overall.map((p) => (
                <li key={p.id} className="py-2 flex items-center gap-3">
                  <span className={`stat-num text-base font-bold w-9 ${ratingColor(p.ovr)}`}>
                    {p.ovr ?? "—"}
                  </span>
                  <Link
                    to={`/roster/${p.id}`}
                    className="flex-1 hover:text-[color:var(--accent)] truncate"
                  >
                    {p.name}
                  </Link>
                  <span className="chip">{p.pos ?? "—"}</span>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="card p-4">
          <h2 className="font-semibold mb-3">Roster breakdown</h2>
          {summary.data ? (
            <div className="space-y-4">
              <div>
                <div className="text-[10px] uppercase tracking-widest text-ink-muted mb-1">
                  By position
                </div>
                <div className="grid grid-cols-3 sm:grid-cols-5 gap-2">
                  {POSITION_GROUPS.map((g) => (
                    <div key={g} className="rounded-md bg-bg-soft border border-border p-2 text-center">
                      <div className="text-[10px] text-ink-muted">{g}</div>
                      <div className="font-bold stat-num">
                        {summary.data.by_position_group[g] ?? 0}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
              <div>
                <div className="text-[10px] uppercase tracking-widest text-ink-muted mb-1">
                  By class
                </div>
                <div className="grid grid-cols-5 gap-2">
                  {(["FR", "SO", "JR", "SR", "UNK"] as const).map((y) => (
                    <div key={y} className="rounded-md bg-bg-soft border border-border p-2 text-center">
                      <div className="text-[10px] text-ink-muted">{y}</div>
                      <div className="font-bold stat-num">
                        {summary.data.by_year[y] ?? 0}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
              <div>
                <div className="text-[10px] uppercase tracking-widest text-ink-muted mb-1">
                  Dev traits
                </div>
                <div className="grid grid-cols-4 gap-2">
                  {(["Elite", "Star", "Impact", "Normal"] as const).map((t) => (
                    <div key={t} className="rounded-md bg-bg-soft border border-border p-2 text-center">
                      <div className={`text-[10px] ${devTraitColor(t)}`}>{t}</div>
                      <div className="font-bold stat-num">
                        {summary.data.by_dev_trait[t] ?? 0}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          ) : (
            <Spinner />
          )}
        </div>
      </div>
    </div>
  );
}
