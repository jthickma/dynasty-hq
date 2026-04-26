import { useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "../lib/api";
import { useActiveDynasty } from "../hooks/useDynastyId";
import { PageHeader, Spinner, ErrorBox, Empty, Modal } from "../components/UI";
import { ratingColor, ratingBg, devTraitColor, classYearShort } from "../lib/format";
import { TrashIcon, SaveIcon, PlusIcon } from "../components/Icons";
import type { Player, PlayerSeasonStat } from "../lib/types";

const RATING_GROUPS: { title: string; keys: (keyof Player)[] }[] = [
  {
    title: "Core",
    keys: ["spd", "acc", "agi", "cod", "strength", "awr", "car", "bcv"],
  },
  {
    title: "Athletic",
    keys: ["jmp", "sta", "inj", "tgh"],
  },
  {
    title: "Ball carrier",
    keys: ["btk", "trk", "sfa", "jkm", "spc"],
  },
  {
    title: "Receiving",
    keys: ["cth", "cit", "srr", "mrr", "drr", "rls"],
  },
  {
    title: "Passing",
    keys: ["thp", "sac", "mac", "dac", "tup", "run", "pac", "bsk"],
  },
  {
    title: "Blocking",
    keys: ["rbk", "pbk", "pbp", "pbf", "rbp", "rbf", "lbk", "ibl"],
  },
  {
    title: "Defense",
    keys: ["tak", "hpw", "pur", "prc", "bsh", "pmv", "fmv", "zcv", "mcv", "prs"],
  },
];

export function PlayerDetail() {
  const { playerId } = useParams();
  const id = Number(playerId);
  const { active } = useActiveDynasty();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [editing, setEditing] = useState(false);
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
          <div className={`text-7xl font-bold stat-num ${ratingColor(p.ovr)}`}>
            {p.ovr ?? "—"}
          </div>
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
        <div className="flex items-center justify-between mb-3">
          <h2 className="font-semibold">Season stats</h2>
          <button onClick={() => setAdding(true)} className="btn-ghost">
            <PlusIcon /> Add season
          </button>
        </div>
        {stats.isLoading ? (
          <Spinner />
        ) : (stats.data?.length ?? 0) === 0 ? (
          <div className="text-sm text-ink-muted py-2">No season stats logged.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr>
                  <th className="table-th">Year</th>
                  <th className="table-th">OVR</th>
                  <th className="table-th">Pass</th>
                  <th className="table-th">Rush</th>
                  <th className="table-th">Rec</th>
                  <th className="table-th">Tk</th>
                  <th className="table-th">Sk</th>
                  <th className="table-th">Int</th>
                </tr>
              </thead>
              <tbody>
                {stats.data!.map((s) => (
                  <tr key={s.id}>
                    <td className="table-td font-medium">{s.season_year}</td>
                    <td className="table-td stat-num">
                      {s.ovr_start ?? "—"} → {s.ovr_end ?? "—"}
                    </td>
                    <td className="table-td stat-num">
                      {s.pass_yds ?? 0} / {s.pass_td ?? 0}TD / {s.pass_int ?? 0}I
                    </td>
                    <td className="table-td stat-num">
                      {s.rush_yds ?? 0} / {s.rush_td ?? 0}TD
                    </td>
                    <td className="table-td stat-num">
                      {s.rec_yds ?? 0} / {s.rec_td ?? 0}TD / {s.receptions ?? 0}r
                    </td>
                    <td className="table-td stat-num">{s.tackles ?? 0}</td>
                    <td className="table-td stat-num">{s.sacks ?? 0}</td>
                    <td className="table-td stat-num">{s.interceptions ?? 0}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {editing && <EditPlayerModal player={p} onClose={() => setEditing(false)} />}
      {adding && <AddStatModal playerId={p.id} onClose={() => setAdding(false)} />}
    </>
  );
}

function RatingPill({ label, value }: { label: string; value: number | null }) {
  return (
    <div className={`rounded-md p-2 text-center ${ratingBg(value)} border border-border`}>
      <div className="text-[9px] uppercase tracking-widest text-ink-muted">{label}</div>
      <div className={`stat-num text-base font-bold ${ratingColor(value)}`}>
        {value ?? "—"}
      </div>
    </div>
  );
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
          <input
            className="input"
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
          />
        </div>
        <div className="grid grid-cols-3 gap-2">
          <div>
            <label className="label">Pos</label>
            <input
              className="input"
              value={form.pos}
              onChange={(e) => setForm({ ...form, pos: e.target.value })}
            />
          </div>
          <div>
            <label className="label">Year</label>
            <input
              className="input"
              value={form.year}
              onChange={(e) => setForm({ ...form, year: e.target.value })}
            />
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
          <button
            onClick={() => save.mutate()}
            disabled={save.isPending}
            className="btn-primary"
          >
            {save.isPending ? <Spinner /> : "Save"}
          </button>
        </div>
      </div>
    </Modal>
  );
}

function AddStatModal({ playerId, onClose }: { playerId: number; onClose: () => void }) {
  const { active } = useActiveDynasty();
  const qc = useQueryClient();
  const [form, setForm] = useState<Partial<PlayerSeasonStat>>({
    season_year: active?.current_season_year ?? new Date().getFullYear(),
  });

  const save = useMutation({
    mutationFn: () => api.addPlayerStat(active!.id, playerId, form),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["player-stats", active?.id, playerId] });
      onClose();
    },
  });

  const setN = (k: keyof PlayerSeasonStat, v: string) =>
    setForm({ ...form, [k]: v === "" ? null : Number(v) });

  const fields: { key: keyof PlayerSeasonStat; label: string }[] = [
    { key: "ovr_start", label: "OVR start" },
    { key: "ovr_end", label: "OVR end" },
    { key: "pass_yds", label: "Pass yds" },
    { key: "pass_td", label: "Pass TD" },
    { key: "pass_int", label: "Pass INT" },
    { key: "rush_yds", label: "Rush yds" },
    { key: "rush_td", label: "Rush TD" },
    { key: "rec_yds", label: "Rec yds" },
    { key: "rec_td", label: "Rec TD" },
    { key: "receptions", label: "Receptions" },
    { key: "tackles", label: "Tackles" },
    { key: "sacks", label: "Sacks" },
    { key: "interceptions", label: "Interceptions" },
    { key: "ff", label: "FF" },
    { key: "fr", label: "FR" },
  ];

  return (
    <Modal open onClose={onClose} title="Add season stats">
      <div className="space-y-3">
        <div>
          <label className="label">Season year</label>
          <input
            type="number"
            className="input"
            value={form.season_year ?? ""}
            onChange={(e) =>
              setForm({ ...form, season_year: Number(e.target.value) || undefined })
            }
          />
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
          {fields.map((f) => (
            <div key={f.key as string}>
              <label className="label">{f.label}</label>
              <input
                type="number"
                step={f.key === "sacks" ? "0.5" : "1"}
                className="input"
                value={(form[f.key] as number | null | undefined) ?? ""}
                onChange={(e) => setN(f.key, e.target.value)}
              />
            </div>
          ))}
        </div>
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
