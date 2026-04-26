import { useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "../lib/api";
import { useActiveDynasty } from "../hooks/useDynastyId";
import { Empty, ErrorBox, Modal, PageHeader, Spinner } from "../components/UI";
import { classYearShort, devTraitColor, num, ratingBg, ratingColor } from "../lib/format";
import { PlusIcon, SaveIcon, TrashIcon } from "../components/Icons";
import type { Player, PlayerSeasonStat } from "../lib/types";

const RATING_GROUPS: { title: string; keys: (keyof Player)[] }[] = [
  { title: "Core", keys: ["spd", "acc", "agi", "cod", "strength", "awr", "car", "bcv"] },
  { title: "Athletic", keys: ["jmp", "sta", "inj", "tgh"] },
  { title: "Ball carrier", keys: ["btk", "trk", "sfa", "jkm", "spc"] },
  { title: "Receiving", keys: ["cth", "cit", "srr", "mrr", "drr", "rls"] },
  { title: "Passing", keys: ["thp", "sac", "mac", "dac", "tup", "run", "pac", "bsk"] },
  { title: "Blocking", keys: ["rbk", "pbk", "pbp", "pbf", "rbp", "rbf", "lbk", "ibl"] },
  { title: "Defense", keys: ["tak", "hpw", "pur", "prc", "bsh", "pmv", "fmv", "zcv", "mcv", "prs"] },
];

type StatField = {
  key: keyof PlayerSeasonStat;
  label: string;
  step?: string;
};

const PASSING_FIELDS: StatField[] = [
  { key: "pass_comp", label: "Comp" },
  { key: "pass_att", label: "Att" },
  { key: "pass_pct", label: "Comp %" , step: "0.1"},
  { key: "pass_yds", label: "Pass yds" },
  { key: "pass_td", label: "Pass TD" },
  { key: "pass_td_pct", label: "TD %" , step: "0.1"},
  { key: "pass_int", label: "INT" },
  { key: "pass_int_pct", label: "INT %" , step: "0.1"},
  { key: "pass_td_int_ratio", label: "TD:INT", step: "0.1" },
];

const RUSHING_FIELDS: StatField[] = [
  { key: "rush_att", label: "Carries" },
  { key: "rush_yds", label: "Rush yds" },
  { key: "rush_avg", label: "YPC", step: "0.1" },
  { key: "rush_td", label: "Rush TD" },
  { key: "rush_yds_per_game", label: "Yds/G", step: "0.1" },
  { key: "rush_20_plus", label: "20+" },
  { key: "rush_broken_tackles", label: "Broken tk" },
  { key: "rush_yac", label: "YAC" },
  { key: "rush_long", label: "Long" },
];

const RECEIVING_FIELDS: StatField[] = [
  { key: "receptions", label: "Receptions" },
  { key: "rec_yds", label: "Rec yds" },
  { key: "rec_avg", label: "YPR", step: "0.1" },
  { key: "rec_td", label: "Rec TD" },
  { key: "rec_yds_per_game", label: "Yds/G", step: "0.1" },
  { key: "rec_long", label: "Long" },
  { key: "rec_rac", label: "RAC" },
  { key: "rec_rac_avg", label: "RAC avg", step: "0.1" },
  { key: "rec_drop", label: "Drops" },
];

const DEFENSE_FIELDS: StatField[] = [
  { key: "solo_tackles", label: "Solo" },
  { key: "assisted_tackles", label: "Assists" },
  { key: "tackles", label: "Total tk" },
  { key: "tfl", label: "TFL" },
  { key: "sacks", label: "Sacks", step: "0.5" },
  { key: "interceptions", label: "INT" },
  { key: "interception_yards", label: "INT yds" },
  { key: "interception_avg", label: "INT avg", step: "0.1" },
  { key: "interception_long", label: "INT long" },
  { key: "ff", label: "FF" },
  { key: "fr", label: "FR" },
];

const SUMMARY_FIELDS: StatField[] = [
  { key: "games_played", label: "GP" },
  { key: "ovr_start", label: "OVR start" },
  { key: "ovr_end", label: "OVR end" },
];

export function PlayerDetail() {
  const { playerId } = useParams();
  const id = Number(playerId);
  const { active } = useActiveDynasty();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [editing, setEditing] = useState(false);
  const [editingStat, setEditingStat] = useState<PlayerSeasonStat | null>(null);
  const [adding, setAdding] = useState(false);

  const player = useQuery({
    queryKey: ["player", active?.id, id],
    queryFn: () => api.getPlayer(active!.id, id),
    enabled: !!active && Number.isFinite(id),
  });

  const stats = useQuery({
    queryKey: ["player-stats", active?.id, id],
    queryFn: () => api.listPlayerStats(active!.id, id),
    enabled: !!active && Number.isFinite(id),
  });

  const del = useMutation({
    mutationFn: () => api.deletePlayer(active!.id, id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["players"] });
      navigate("/roster");
    },
  });

  const orderedStats = useMemo(
    () => [...(stats.data ?? [])].sort((a, b) => b.season_year - a.season_year),
    [stats.data],
  );

  if (!active) return <Empty title="Pick a dynasty" />;
  if (player.isLoading) return <Spinner />;
  if (player.isError) return <ErrorBox error={player.error} />;
  const p = player.data!;

  return (
    <>
      <PageHeader
        title={p.name}
        subtitle={
          <span className="flex flex-wrap gap-2 items-center">
            <span className="chip">{p.pos ?? "—"}</span>
            <span className="chip">{classYearShort(p.year)}</span>
            {p.dev_trait && (
              <span className={`chip ${devTraitColor(p.dev_trait)} border-current/40`}>
                {p.dev_trait}
              </span>
            )}
            {p.jersey != null && <span className="chip">#{p.jersey}</span>}
            {p.archetype && <span className="chip">{p.archetype}</span>}
          </span>
        }
        actions={
          <div className="flex gap-2">
            <Link to="/roster" className="btn-ghost">
              ← Back
            </Link>
            <button onClick={() => setEditing(true)} className="btn-ghost">
              <SaveIcon /> Edit
            </button>
            <button
              onClick={() => {
                if (confirm(`Delete ${p.name}?`)) del.mutate();
              }}
              className="btn-danger"
            >
              <TrashIcon />
            </button>
          </div>
        }
      />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-4">
        <div className="card p-5 lg:col-span-1 flex flex-col items-center justify-center">
          <div className="text-[10px] uppercase tracking-widest text-ink-muted">Overall</div>
          <div className={`text-7xl font-bold stat-num ${ratingColor(p.ovr)}`}>{p.ovr ?? "—"}</div>
          <div className="text-sm text-ink-muted mt-1">
            updated {new Date(p.updated_at).toLocaleDateString()}
          </div>
        </div>
        <div className="card p-4 lg:col-span-2">
          <div className="text-[10px] uppercase tracking-widest text-ink-muted mb-2">Top ratings</div>
          <div className="grid grid-cols-4 sm:grid-cols-8 gap-2">
            {RATING_GROUPS[0].keys.map((k) => (
              <RatingPill key={k as string} label={(k as string).toUpperCase()} value={p[k] as number | null} />
            ))}
          </div>
        </div>
      </div>

      <div className="space-y-4">
        {RATING_GROUPS.slice(1).map((g) => {
          const vals = g.keys.map((k) => ({ k, v: p[k] as number | null }));
          if (vals.every((x) => x.v == null)) return null;
          return (
            <div key={g.title} className="card p-4">
              <h2 className="font-semibold mb-3">{g.title}</h2>
              <div className="grid grid-cols-4 sm:grid-cols-6 md:grid-cols-8 lg:grid-cols-10 gap-2">
                {vals.map(({ k, v }) => (
                  <RatingPill key={k as string} label={(k as string).toUpperCase()} value={v} />
                ))}
              </div>
            </div>
          );
        })}
      </div>

      <div className="card p-4 mt-4">
        <div className="flex items-center justify-between gap-3 mb-3">
          <div>
            <h2 className="font-semibold">Season stats</h2>
            <div className="text-xs text-ink-muted mt-0.5">
              Imported season totals and manual edits both land here.
            </div>
          </div>
          <button onClick={() => setAdding(true)} className="btn-ghost">
            <PlusIcon /> Add season
          </button>
        </div>

        {stats.isLoading ? (
          <Spinner />
        ) : stats.isError ? (
          <ErrorBox error={stats.error} />
        ) : orderedStats.length === 0 ? (
          <div className="text-sm text-ink-muted py-2">No season stats logged.</div>
        ) : (
          <div className="space-y-3">
            {orderedStats.map((stat) => (
              <SeasonStatCard
                key={stat.id}
                stat={stat}
                onEdit={() => setEditingStat(stat)}
                playerId={p.id}
              />
            ))}
          </div>
        )}
      </div>

      {editing && <EditPlayerModal player={p} onClose={() => setEditing(false)} />}
      {adding && <SeasonStatModal playerId={p.id} onClose={() => setAdding(false)} />}
      {editingStat && (
        <SeasonStatModal
          playerId={p.id}
          stat={editingStat}
          onClose={() => setEditingStat(null)}
        />
      )}
    </>
  );
}

function RatingPill({ label, value }: { label: string; value: number | null }) {
  return (
    <div className={`rounded-md p-2 text-center ${ratingBg(value)} border border-border`}>
      <div className="text-[9px] uppercase tracking-widest text-ink-muted">{label}</div>
      <div className={`stat-num text-base font-bold ${ratingColor(value)}`}>{value ?? "—"}</div>
    </div>
  );
}

function SeasonStatCard({
  stat,
  playerId,
  onEdit,
}: {
  stat: PlayerSeasonStat;
  playerId: number;
  onEdit: () => void;
}) {
  const { active } = useActiveDynasty();
  const qc = useQueryClient();

  const remove = useMutation({
    mutationFn: () => api.deletePlayerStat(active!.id, playerId, stat.id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["player-stats", active?.id, playerId] });
      qc.invalidateQueries({ queryKey: ["leaders-stats"] });
    },
  });

  return (
    <div className="rounded-md border border-border bg-bg-soft/50 p-4 space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="space-y-1">
          <div className="flex flex-wrap items-center gap-2">
            <div className="text-base font-semibold">{stat.season_year}</div>
            {stat.games_played != null && <span className="chip">{stat.games_played} GP</span>}
            {(stat.ovr_start != null || stat.ovr_end != null) && (
              <span className="chip">
                OVR {stat.ovr_start ?? "—"} → {stat.ovr_end ?? "—"}
              </span>
            )}
          </div>
          <div className="text-xs text-ink-muted">
            Pass {num(stat.pass_yds, "0")} · Rush {num(stat.rush_yds, "0")} · Rec{" "}
            {num(stat.rec_yds, "0")} · Tk {num(stat.tackles, "0")}
          </div>
        </div>
        <div className="flex gap-2">
          <button onClick={onEdit} className="btn-ghost">
            Edit
          </button>
          <button
            onClick={() => {
              if (confirm(`Delete ${stat.season_year} season stats?`)) remove.mutate();
            }}
            disabled={remove.isPending}
            className="btn-danger"
          >
            {remove.isPending ? <Spinner /> : <TrashIcon />}
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-3">
        <SeasonStatSection title="Passing" stat={stat} fields={PASSING_FIELDS} />
        <SeasonStatSection title="Rushing" stat={stat} fields={RUSHING_FIELDS} />
        <SeasonStatSection title="Receiving" stat={stat} fields={RECEIVING_FIELDS} />
        <SeasonStatSection title="Defense" stat={stat} fields={DEFENSE_FIELDS} />
      </div>
    </div>
  );
}

function SeasonStatSection({
  title,
  stat,
  fields,
}: {
  title: string;
  stat: PlayerSeasonStat;
  fields: StatField[];
}) {
  const visible = fields.filter((field) => stat[field.key] != null);
  if (visible.length === 0) return null;

  return (
    <div className="rounded-md border border-border bg-bg p-3">
      <div className="text-sm font-semibold mb-2">{title}</div>
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
        {visible.map((field) => (
          <div key={field.key as string} className="rounded-md border border-border bg-bg-soft px-2.5 py-2">
            <div className="text-[10px] uppercase tracking-widest text-ink-muted">{field.label}</div>
            <div className="stat-num text-sm font-semibold mt-1">{statValue(stat[field.key])}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

function statValue(value: number | null): string {
  if (value == null) return "—";
  return Number.isInteger(value) ? value.toLocaleString() : value.toFixed(1);
}

function EditPlayerModal({ player, onClose }: { player: Player; onClose: () => void }) {
  const { active } = useActiveDynasty();
  const qc = useQueryClient();
  const [form, setForm] = useState({
    name: player.name,
    pos: player.pos ?? "",
    year: player.year ?? "",
    ovr: player.ovr ?? "",
    dev_trait: player.dev_trait ?? "",
    archetype: player.archetype ?? "",
    jersey: player.jersey ?? "",
  });

  const save = useMutation({
    mutationFn: () =>
      api.updatePlayer(active!.id, player.id, {
        name: form.name,
        pos: form.pos || null,
        year: form.year || null,
        ovr: form.ovr === "" ? null : Number(form.ovr),
        dev_trait: form.dev_trait || null,
        archetype: form.archetype || null,
        jersey: form.jersey === "" ? null : Number(form.jersey),
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["player", active?.id, player.id] });
      qc.invalidateQueries({ queryKey: ["players"] });
      onClose();
    },
  });

  return (
    <Modal open onClose={onClose} title="Edit player">
      <div className="space-y-3">
        <div>
          <label className="label">Name</label>
          <input className="input" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
        </div>
        <div className="grid grid-cols-3 gap-2">
          <div>
            <label className="label">Pos</label>
            <input className="input" value={form.pos} onChange={(e) => setForm({ ...form, pos: e.target.value })} />
          </div>
          <div>
            <label className="label">Year</label>
            <input className="input" value={form.year} onChange={(e) => setForm({ ...form, year: e.target.value })} />
          </div>
          <div>
            <label className="label">OVR</label>
            <input
              type="number"
              className="input"
              value={form.ovr}
              onChange={(e) => setForm({ ...form, ovr: e.target.value as never })}
            />
          </div>
        </div>
        <div className="grid grid-cols-3 gap-2">
          <div>
            <label className="label">Dev trait</label>
            <select
              className="input"
              value={form.dev_trait}
              onChange={(e) => setForm({ ...form, dev_trait: e.target.value })}
            >
              <option value="">—</option>
              <option>Normal</option>
              <option>Impact</option>
              <option>Star</option>
              <option>Elite</option>
            </select>
          </div>
          <div>
            <label className="label">Archetype</label>
            <input
              className="input"
              value={form.archetype}
              onChange={(e) => setForm({ ...form, archetype: e.target.value })}
            />
          </div>
          <div>
            <label className="label">Jersey</label>
            <input
              type="number"
              className="input"
              value={form.jersey}
              onChange={(e) => setForm({ ...form, jersey: e.target.value as never })}
            />
          </div>
        </div>
        {save.isError && <ErrorBox error={save.error} />}
        <div className="flex justify-end gap-2 pt-2">
          <button onClick={onClose} className="btn-ghost">
            Cancel
          </button>
          <button onClick={() => save.mutate()} disabled={save.isPending} className="btn-primary">
            {save.isPending ? <Spinner /> : "Save"}
          </button>
        </div>
      </div>
    </Modal>
  );
}

function SeasonStatModal({
  playerId,
  stat,
  onClose,
}: {
  playerId: number;
  stat?: PlayerSeasonStat;
  onClose: () => void;
}) {
  const { active } = useActiveDynasty();
  const qc = useQueryClient();
  const [form, setForm] = useState<Partial<PlayerSeasonStat>>(
    stat ?? { season_year: active?.current_season_year ?? new Date().getFullYear() },
  );

  const save = useMutation({
    mutationFn: () =>
      stat
        ? api.updatePlayerStat(active!.id, playerId, stat.id, form)
        : api.addPlayerStat(active!.id, playerId, form),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["player-stats", active?.id, playerId] });
      qc.invalidateQueries({ queryKey: ["leaders-stats"] });
      onClose();
    },
  });

  const setN = (key: keyof PlayerSeasonStat, value: string) =>
    setForm((current) => ({ ...current, [key]: value === "" ? null : Number(value) }));

  return (
    <Modal
      open
      onClose={onClose}
      title={stat ? `Edit ${stat.season_year} season stats` : "Add season stats"}
      width="max-w-5xl"
    >
      <div className="space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
          {SUMMARY_FIELDS.map((field) => (
            <FieldInput key={field.key as string} field={field} form={form} setN={setN} />
          ))}
          <div>
            <label className="label">Season year</label>
            <input
              type="number"
              className="input"
              value={form.season_year ?? ""}
              onChange={(e) =>
                setForm((current) => ({
                  ...current,
                  season_year: e.target.value === "" ? undefined : Number(e.target.value),
                }))
              }
            />
          </div>
        </div>

        <StatFieldSection title="Passing" fields={PASSING_FIELDS} form={form} setN={setN} />
        <StatFieldSection title="Rushing" fields={RUSHING_FIELDS} form={form} setN={setN} />
        <StatFieldSection title="Receiving" fields={RECEIVING_FIELDS} form={form} setN={setN} />
        <StatFieldSection title="Defense" fields={DEFENSE_FIELDS} form={form} setN={setN} />

        {save.isError && <ErrorBox error={save.error} />}
        <div className="flex justify-end gap-2 pt-2">
          <button onClick={onClose} className="btn-ghost">
            Cancel
          </button>
          <button
            onClick={() => save.mutate()}
            disabled={!form.season_year || save.isPending}
            className="btn-primary"
          >
            {save.isPending ? <Spinner /> : "Save"}
          </button>
        </div>
      </div>
    </Modal>
  );
}

function StatFieldSection({
  title,
  fields,
  form,
  setN,
}: {
  title: string;
  fields: StatField[];
  form: Partial<PlayerSeasonStat>;
  setN: (key: keyof PlayerSeasonStat, value: string) => void;
}) {
  return (
    <div className="rounded-md border border-border p-3">
      <div className="font-semibold text-sm mb-3">{title}</div>
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2">
        {fields.map((field) => (
          <FieldInput key={field.key as string} field={field} form={form} setN={setN} />
        ))}
      </div>
    </div>
  );
}

function FieldInput({
  field,
  form,
  setN,
}: {
  field: StatField;
  form: Partial<PlayerSeasonStat>;
  setN: (key: keyof PlayerSeasonStat, value: string) => void;
}) {
  return (
    <div>
      <label className="label">{field.label}</label>
      <input
        type="number"
        step={field.step ?? "1"}
        className="input"
        value={(form[field.key] as number | null | undefined) ?? ""}
        onChange={(e) => setN(field.key, e.target.value)}
      />
    </div>
  );
}
