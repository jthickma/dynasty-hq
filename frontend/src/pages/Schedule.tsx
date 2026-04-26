import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "../lib/api";
import { useActiveDynasty } from "../hooks/useDynastyId";
import { PageHeader, Empty, Spinner, ErrorBox, Modal } from "../components/UI";
import { PlusIcon, TrashIcon } from "../components/Icons";
import type { Game, Season } from "../lib/types";

export function Schedule() {
  const { active } = useActiveDynasty();
  const qc = useQueryClient();
  const [seasonId, setSeasonId] = useState<number | null>(null);
  const [creatingGame, setCreatingGame] = useState(false);
  const [editingGame, setEditingGame] = useState<Game | null>(null);
  const [creatingSeason, setCreatingSeason] = useState(false);

  const seasons = useQuery({
    queryKey: ["seasons", active?.id],
    queryFn: () => api.listSeasons(active!.id),
    enabled: !!active,
  });

  useEffect(() => {
    if (seasons.data && seasons.data.length > 0 && !seasonId) {
      const cur = seasons.data.find((s) => s.year === active?.current_season_year);
      setSeasonId(cur?.id ?? seasons.data[seasons.data.length - 1].id);
    }
  }, [seasons.data, seasonId, active]);

  const games = useQuery({
    queryKey: ["games", seasonId],
    queryFn: () => api.listGames(seasonId!),
    enabled: !!seasonId,
  });

  const delGame = useMutation({
    mutationFn: (id: number) => api.deleteGame(seasonId!, id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["games", seasonId] });
      qc.invalidateQueries({ queryKey: ["seasons", active?.id] });
    },
  });

  if (!active) return <Empty title="Pick a dynasty" />;

  const season = seasons.data?.find((s) => s.id === seasonId) ?? null;

  return (
    <>
      <PageHeader
        title="Schedule"
        subtitle={
          season
            ? `${season.year} · ${season.wins}-${season.losses} (${season.conf_wins}-${season.conf_losses} conf)`
            : ""
        }
        actions={
          <div className="flex flex-wrap gap-2">
            <select
              className="input w-auto"
              value={seasonId ?? ""}
              onChange={(e) => setSeasonId(Number(e.target.value))}
            >
              {(seasons.data ?? []).map((s) => (
                <option key={s.id} value={s.id}>
                  {s.year}
                </option>
              ))}
            </select>
            <button onClick={() => setCreatingSeason(true)} className="btn-ghost">
              <PlusIcon /> Season
            </button>
            <button
              onClick={() => setCreatingGame(true)}
              className="btn-primary"
              disabled={!seasonId}
            >
              <PlusIcon /> Game
            </button>
          </div>
        }
      />

      {games.isError && <ErrorBox error={games.error} />}
      {games.isLoading ? (
        <Spinner />
      ) : (games.data?.length ?? 0) === 0 ? (
        <Empty
          title="No games scheduled"
          body="Add games to track results week-by-week."
          action={
            <button onClick={() => setCreatingGame(true)} className="btn-primary" disabled={!seasonId}>
              <PlusIcon /> Add game
            </button>
          }
        />
      ) : (
        <div className="space-y-2">
          {games.data!.map((g) => (
            <button
              key={g.id}
              onClick={() => setEditingGame(g)}
              className="card w-full px-3 py-3 flex items-center gap-3 text-left hover:bg-bg-hover"
            >
              <div className="w-10 text-center">
                <div className="text-[10px] text-ink-muted">WK</div>
                <div className="font-bold stat-num">{g.week}</div>
              </div>
              <div
                className={`w-8 h-8 rounded-md grid place-items-center font-bold text-xs ${
                  g.result === "W"
                    ? "bg-emerald-500/20 text-emerald-300"
                    : g.result === "L"
                      ? "bg-red-500/20 text-red-300"
                      : g.is_bye
                        ? "bg-bg-soft text-ink-dim"
                        : "bg-bg-soft text-ink-muted"
                }`}
              >
                {g.is_bye ? "—" : g.result ?? "·"}
              </div>
              <div className="flex-1 min-w-0">
                <div className="font-semibold truncate">
                  {g.is_bye ? "BYE" : `${g.home_away === "A" ? "@" : g.home_away === "N" ? "vs" : "vs"} ${g.opponent}`}
                  {g.opponent_rank != null && (
                    <span className="ml-1.5 text-xs text-ink-muted">#{g.opponent_rank}</span>
                  )}
                </div>
                <div className="text-xs text-ink-muted truncate">
                  {g.is_conference && <span className="mr-2">CONF</span>}
                  {g.home_away}
                </div>
              </div>
              {g.played && g.team_score != null && g.opp_score != null && (
                <div className="stat-num font-bold">
                  {g.team_score}–{g.opp_score}
                </div>
              )}
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  if (confirm(`Delete week ${g.week} ${g.opponent}?`)) delGame.mutate(g.id);
                }}
                className="text-ink-dim hover:text-red-400 p-1"
                aria-label="Delete game"
              >
                <TrashIcon width={16} height={16} />
              </button>
            </button>
          ))}
        </div>
      )}

      {creatingGame && seasonId && (
        <GameModal seasonId={seasonId} onClose={() => setCreatingGame(false)} />
      )}
      {editingGame && seasonId && (
        <GameModal
          seasonId={seasonId}
          game={editingGame}
          onClose={() => setEditingGame(null)}
        />
      )}
      {creatingSeason && (
        <CreateSeasonModal
          dynastyId={active.id}
          existing={seasons.data ?? []}
          onClose={() => setCreatingSeason(false)}
          onCreated={(s) => setSeasonId(s.id)}
        />
      )}
    </>
  );
}

function GameModal({
  seasonId,
  game,
  onClose,
}: {
  seasonId: number;
  game?: Game;
  onClose: () => void;
}) {
  const qc = useQueryClient();
  const { active } = useActiveDynasty();
  const [form, setForm] = useState({
    week: game?.week ?? 1,
    opponent: game?.opponent ?? "",
    opponent_rank: game?.opponent_rank ?? "",
    home_away: game?.home_away ?? "H",
    is_bye: game?.is_bye ?? false,
    is_conference: game?.is_conference ?? false,
    team_score: game?.team_score ?? "",
    opp_score: game?.opp_score ?? "",
    total_yards: game?.total_yards ?? "",
    opp_total_yards: game?.opp_total_yards ?? "",
    turnovers: game?.turnovers ?? "",
    opp_turnovers: game?.opp_turnovers ?? "",
    notes: game?.notes ?? "",
  });

  const toPayload = () => ({
    week: Number(form.week),
    opponent: form.opponent || (form.is_bye ? "BYE" : ""),
    opponent_rank: form.opponent_rank === "" ? null : Number(form.opponent_rank),
    home_away: form.home_away,
    is_bye: form.is_bye,
    is_conference: form.is_conference,
    team_score: form.team_score === "" ? null : Number(form.team_score),
    opp_score: form.opp_score === "" ? null : Number(form.opp_score),
    total_yards: form.total_yards === "" ? null : Number(form.total_yards),
    opp_total_yards: form.opp_total_yards === "" ? null : Number(form.opp_total_yards),
    turnovers: form.turnovers === "" ? null : Number(form.turnovers),
    opp_turnovers: form.opp_turnovers === "" ? null : Number(form.opp_turnovers),
    notes: form.notes || null,
  });

  const save = useMutation({
    mutationFn: () =>
      game
        ? api.updateGame(seasonId, game.id, toPayload())
        : api.createGame(seasonId, toPayload()),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["games", seasonId] });
      qc.invalidateQueries({ queryKey: ["seasons", active?.id] });
      onClose();
    },
  });

  return (
    <Modal open onClose={onClose} title={game ? `Edit game · Wk ${game.week}` : "Add game"} width="max-w-2xl">
      <div className="space-y-3">
        <div className="grid grid-cols-3 gap-2">
          <div>
            <label className="label">Week</label>
            <input
              type="number"
              className="input"
              value={form.week}
              onChange={(e) => setForm({ ...form, week: Number(e.target.value) })}
            />
          </div>
          <div>
            <label className="label">Home/Away</label>
            <select
              className="input"
              value={form.home_away}
              onChange={(e) => setForm({ ...form, home_away: e.target.value })}
            >
              <option value="H">Home</option>
              <option value="A">Away</option>
              <option value="N">Neutral</option>
            </select>
          </div>
          <div className="flex items-end gap-3">
            <label className="flex items-center gap-2 text-sm pb-2">
              <input
                type="checkbox"
                checked={form.is_bye}
                onChange={(e) => setForm({ ...form, is_bye: e.target.checked })}
              />
              Bye
            </label>
            <label className="flex items-center gap-2 text-sm pb-2">
              <input
                type="checkbox"
                checked={form.is_conference}
                onChange={(e) => setForm({ ...form, is_conference: e.target.checked })}
              />
              Conf
            </label>
          </div>
        </div>
        {!form.is_bye && (
          <div className="grid grid-cols-3 gap-2">
            <div className="col-span-2">
              <label className="label">Opponent</label>
              <input
                className="input"
                value={form.opponent}
                onChange={(e) => setForm({ ...form, opponent: e.target.value })}
              />
            </div>
            <div>
              <label className="label">Rank</label>
              <input
                type="number"
                className="input"
                value={form.opponent_rank}
                onChange={(e) =>
                  setForm({ ...form, opponent_rank: e.target.value as never })
                }
              />
            </div>
          </div>
        )}
        {!form.is_bye && (
          <>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="label">Team score</label>
                <input
                  type="number"
                  className="input"
                  value={form.team_score}
                  onChange={(e) => setForm({ ...form, team_score: e.target.value as never })}
                />
              </div>
              <div>
                <label className="label">Opp score</label>
                <input
                  type="number"
                  className="input"
                  value={form.opp_score}
                  onChange={(e) => setForm({ ...form, opp_score: e.target.value as never })}
                />
              </div>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              <div>
                <label className="label">Yds</label>
                <input
                  type="number"
                  className="input"
                  value={form.total_yards}
                  onChange={(e) => setForm({ ...form, total_yards: e.target.value as never })}
                />
              </div>
              <div>
                <label className="label">Opp yds</label>
                <input
                  type="number"
                  className="input"
                  value={form.opp_total_yards}
                  onChange={(e) =>
                    setForm({ ...form, opp_total_yards: e.target.value as never })
                  }
                />
              </div>
              <div>
                <label className="label">TO</label>
                <input
                  type="number"
                  className="input"
                  value={form.turnovers}
                  onChange={(e) => setForm({ ...form, turnovers: e.target.value as never })}
                />
              </div>
              <div>
                <label className="label">Opp TO</label>
                <input
                  type="number"
                  className="input"
                  value={form.opp_turnovers}
                  onChange={(e) =>
                    setForm({ ...form, opp_turnovers: e.target.value as never })
                  }
                />
              </div>
            </div>
          </>
        )}
        <div>
          <label className="label">Notes</label>
          <textarea
            className="input"
            rows={2}
            value={form.notes}
            onChange={(e) => setForm({ ...form, notes: e.target.value })}
          />
        </div>
        {save.isError && <ErrorBox error={save.error} />}
        <div className="flex justify-end gap-2 pt-2">
          <button onClick={onClose} className="btn-ghost">
            Cancel
          </button>
          <button
            onClick={() => save.mutate()}
            disabled={save.isPending || (!form.is_bye && !form.opponent)}
            className="btn-primary"
          >
            {save.isPending ? <Spinner /> : "Save"}
          </button>
        </div>
      </div>
    </Modal>
  );
}

function CreateSeasonModal({
  dynastyId,
  existing,
  onClose,
  onCreated,
}: {
  dynastyId: number;
  existing: Season[];
  onClose: () => void;
  onCreated: (s: Season) => void;
}) {
  const qc = useQueryClient();
  const nextYear =
    existing.length === 0
      ? new Date().getFullYear()
      : Math.max(...existing.map((s) => s.year)) + 1;
  const [year, setYear] = useState(nextYear);

  const save = useMutation({
    mutationFn: () => api.createSeason(dynastyId, { year }),
    onSuccess: (s) => {
      qc.invalidateQueries({ queryKey: ["seasons", dynastyId] });
      onCreated(s);
      onClose();
    },
  });

  return (
    <Modal open onClose={onClose} title="New season">
      <div className="space-y-3">
        <div>
          <label className="label">Year</label>
          <input
            type="number"
            className="input"
            value={year}
            onChange={(e) => setYear(Number(e.target.value))}
          />
        </div>
        {save.isError && <ErrorBox error={save.error} />}
        <div className="flex justify-end gap-2">
          <button onClick={onClose} className="btn-ghost">
            Cancel
          </button>
          <button onClick={() => save.mutate()} disabled={save.isPending} className="btn-primary">
            {save.isPending ? <Spinner /> : "Create"}
          </button>
        </div>
      </div>
    </Modal>
  );
}
