import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "../lib/api";
import { useActiveDynasty } from "../hooks/useDynastyId";
import { PageHeader, Empty, Spinner, ErrorBox, Modal, Stat } from "../components/UI";
import { PlusIcon, TrashIcon, StarIcon, CheckIcon } from "../components/Icons";
import type { Recruit } from "../lib/types";

export function Recruits() {
  const { active } = useActiveDynasty();
  const qc = useQueryClient();
  const [posFilter, setPosFilter] = useState("");
  const [committedFilter, setCommittedFilter] = useState<"" | "true" | "false">("");
  const [minStars, setMinStars] = useState("");
  const [creating, setCreating] = useState(false);
  const [editing, setEditing] = useState<Recruit | null>(null);

  const recruits = useQuery({
    queryKey: ["recruits", active?.id, posFilter, committedFilter, minStars],
    queryFn: () =>
      api.listRecruits(active!.id, {
        pos: posFilter || undefined,
        committed:
          committedFilter === "" ? undefined : committedFilter === "true" ? true : false,
        min_stars: minStars ? Number(minStars) : undefined,
      }),
    enabled: !!active,
  });

  const budget = useQuery({
    queryKey: ["budget", active?.id],
    queryFn: () => api.weeklyBudget(active!.id),
    enabled: !!active,
  });

  const del = useMutation({
    mutationFn: (id: number) => api.deleteRecruit(active!.id, id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["recruits"] });
      qc.invalidateQueries({ queryKey: ["budget"] });
    },
  });

  if (!active) return <Empty title="Pick a dynasty" />;

  return (
    <>
      <PageHeader
        title="Recruits"
        actions={
          <button onClick={() => setCreating(true)} className="btn-primary">
            <PlusIcon /> Recruit
          </button>
        }
      />

      <div className="grid grid-cols-3 gap-3 mb-4">
        <Stat
          label="Hours used"
          value={budget.data ? `${budget.data.used}/${budget.data.cap}` : "—"}
          accent
        />
        <Stat
          label="Remaining"
          value={budget.data ? budget.data.remaining : "—"}
        />
        <Stat
          label="Tracked"
          value={recruits.data?.length ?? 0}
          hint={
            recruits.data
              ? `${recruits.data.filter((r) => r.committed).length} committed`
              : ""
          }
        />
      </div>

      <div className="card p-3 mb-4 flex flex-wrap items-center gap-2">
        <input
          className="input w-auto"
          placeholder="Position"
          value={posFilter}
          onChange={(e) => setPosFilter(e.target.value.toUpperCase())}
        />
        <select
          className="input w-auto"
          value={committedFilter}
          onChange={(e) => setCommittedFilter(e.target.value as "" | "true" | "false")}
        >
          <option value="">All</option>
          <option value="false">Open</option>
          <option value="true">Committed</option>
        </select>
        <select
          className="input w-auto"
          value={minStars}
          onChange={(e) => setMinStars(e.target.value)}
        >
          <option value="">Any stars</option>
          <option value="3">3★+</option>
          <option value="4">4★+</option>
          <option value="5">5★</option>
        </select>
      </div>

      {recruits.isError && <ErrorBox error={recruits.error} />}
      {recruits.isLoading ? (
        <Spinner />
      ) : (recruits.data?.length ?? 0) === 0 ? (
        <Empty
          title="No recruits"
          body="Add prospects to track interest and weekly hours."
          action={
            <button onClick={() => setCreating(true)} className="btn-primary">
              <PlusIcon /> Add recruit
            </button>
          }
        />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {recruits.data!.map((r) => (
            <button
              key={r.id}
              onClick={() => setEditing(r)}
              className="card p-3 text-left hover:bg-bg-hover"
            >
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <div className="font-semibold truncate flex items-center gap-2">
                    {r.name}
                    {r.committed && (
                      <span className="text-emerald-400 inline-flex items-center gap-0.5 text-xs">
                        <CheckIcon width={14} height={14} /> {r.committed_to ?? "Committed"}
                      </span>
                    )}
                  </div>
                  <div className="text-xs text-ink-muted mt-0.5">
                    {r.pos}
                    {r.state ? ` · ${r.state}` : ""}
                    {r.national_rank ? ` · #${r.national_rank} nat'l` : ""}
                    {r.position_rank ? ` · #${r.position_rank} pos` : ""}
                  </div>
                </div>
                <div className="flex items-center gap-0.5 text-amber-400 shrink-0">
                  {Array.from({ length: r.stars }).map((_, i) => (
                    <StarIcon key={i} width={14} height={14} fill="currentColor" />
                  ))}
                </div>
              </div>
              <div className="mt-3 flex items-center gap-3">
                <div className="flex-1">
                  <div className="flex items-center justify-between text-[10px] text-ink-muted mb-1">
                    <span>Interest</span>
                    <span>{r.interest_level}%</span>
                  </div>
                  <div className="h-1.5 rounded bg-bg-soft overflow-hidden">
                    <div
                      className="h-full rounded"
                      style={{
                        width: `${Math.min(100, r.interest_level)}%`,
                        background: "var(--accent)",
                      }}
                    />
                  </div>
                </div>
                <div className="text-xs text-ink-muted">
                  <span className="stat-num">{r.hours_spent_week}</span>h/wk
                </div>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    if (confirm(`Delete ${r.name}?`)) del.mutate(r.id);
                  }}
                  className="text-ink-dim hover:text-red-400 p-1"
                  aria-label="Delete recruit"
                >
                  <TrashIcon width={16} height={16} />
                </button>
              </div>
            </button>
          ))}
        </div>
      )}

      {creating && <RecruitModal onClose={() => setCreating(false)} />}
      {editing && (
        <RecruitModal recruit={editing} onClose={() => setEditing(null)} />
      )}
    </>
  );
}

function RecruitModal({ recruit, onClose }: { recruit?: Recruit; onClose: () => void }) {
  const { active } = useActiveDynasty();
  const qc = useQueryClient();
  const [form, setForm] = useState({
    name: recruit?.name ?? "",
    pos: recruit?.pos ?? "",
    stars: recruit?.stars ?? 3,
    state: recruit?.state ?? "",
    national_rank: recruit?.national_rank ?? "",
    position_rank: recruit?.position_rank ?? "",
    interest_level: recruit?.interest_level ?? 0,
    hours_spent_week: recruit?.hours_spent_week ?? 0,
    total_hours_spent: recruit?.total_hours_spent ?? 0,
    committed: recruit?.committed ?? false,
    committed_to: recruit?.committed_to ?? "",
    school_leader: recruit?.school_leader ?? "",
  });

  const save = useMutation({
    mutationFn: () => {
      const body = {
        name: form.name,
        pos: form.pos,
        stars: Number(form.stars),
        state: form.state || null,
        national_rank: form.national_rank === "" ? null : Number(form.national_rank),
        position_rank: form.position_rank === "" ? null : Number(form.position_rank),
        interest_level: Number(form.interest_level),
        hours_spent_week: Number(form.hours_spent_week),
        total_hours_spent: Number(form.total_hours_spent),
        committed: form.committed,
        committed_to: form.committed_to || null,
        school_leader: form.school_leader || null,
      };
      return recruit
        ? api.updateRecruit(active!.id, recruit.id, body)
        : api.createRecruit(active!.id, body);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["recruits"] });
      qc.invalidateQueries({ queryKey: ["budget"] });
      onClose();
    },
  });

  return (
    <Modal open onClose={onClose} title={recruit ? "Edit recruit" : "Add recruit"} width="max-w-xl">
      <div className="space-y-3">
        <div className="grid grid-cols-3 gap-2">
          <div className="col-span-2">
            <label className="label">Name</label>
            <input
              className="input"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
            />
          </div>
          <div>
            <label className="label">Pos</label>
            <input
              className="input"
              value={form.pos}
              onChange={(e) => setForm({ ...form, pos: e.target.value.toUpperCase() })}
            />
          </div>
        </div>
        <div className="grid grid-cols-3 gap-2">
          <div>
            <label className="label">Stars</label>
            <select
              className="input"
              value={form.stars}
              onChange={(e) => setForm({ ...form, stars: Number(e.target.value) })}
            >
              {[1, 2, 3, 4, 5].map((n) => (
                <option key={n} value={n}>
                  {n}★
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="label">State</label>
            <input
              className="input"
              value={form.state}
              onChange={(e) => setForm({ ...form, state: e.target.value.toUpperCase() })}
            />
          </div>
          <div>
            <label className="label">School leader</label>
            <input
              className="input"
              value={form.school_leader}
              onChange={(e) => setForm({ ...form, school_leader: e.target.value })}
            />
          </div>
        </div>
        <div className="grid grid-cols-2 gap-2">
          <div>
            <label className="label">Nat'l rank</label>
            <input
              type="number"
              className="input"
              value={form.national_rank}
              onChange={(e) => setForm({ ...form, national_rank: e.target.value as never })}
            />
          </div>
          <div>
            <label className="label">Pos rank</label>
            <input
              type="number"
              className="input"
              value={form.position_rank}
              onChange={(e) => setForm({ ...form, position_rank: e.target.value as never })}
            />
          </div>
        </div>
        <div>
          <label className="label">Interest ({form.interest_level}%)</label>
          <input
            type="range"
            min={0}
            max={100}
            value={form.interest_level}
            onChange={(e) => setForm({ ...form, interest_level: Number(e.target.value) })}
            className="w-full"
          />
        </div>
        <div className="grid grid-cols-2 gap-2">
          <div>
            <label className="label">Hours / week</label>
            <input
              type="number"
              className="input"
              value={form.hours_spent_week}
              onChange={(e) =>
                setForm({ ...form, hours_spent_week: Number(e.target.value) || 0 })
              }
            />
          </div>
          <div>
            <label className="label">Total hours</label>
            <input
              type="number"
              className="input"
              value={form.total_hours_spent}
              onChange={(e) =>
                setForm({ ...form, total_hours_spent: Number(e.target.value) || 0 })
              }
            />
          </div>
        </div>
        <div className="grid grid-cols-3 gap-2 items-end">
          <label className="flex items-center gap-2 text-sm pb-2">
            <input
              type="checkbox"
              checked={form.committed}
              onChange={(e) => setForm({ ...form, committed: e.target.checked })}
            />
            Committed
          </label>
          <div className="col-span-2">
            <label className="label">Committed to</label>
            <input
              className="input"
              value={form.committed_to}
              onChange={(e) => setForm({ ...form, committed_to: e.target.value })}
              disabled={!form.committed}
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
            disabled={!form.name || !form.pos || save.isPending}
            className="btn-primary"
          >
            {save.isPending ? <Spinner /> : "Save"}
          </button>
        </div>
      </div>
    </Modal>
  );
}
