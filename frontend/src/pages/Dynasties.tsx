import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "../lib/api";
import { useDynasties, useActiveDynasty } from "../hooks/useDynastyId";
import { PageHeader, Modal, ErrorBox, Spinner } from "../components/UI";
import { PlusIcon, TrashIcon, CheckIcon } from "../components/Icons";

export function Dynasties() {
  const { data: dynasties, isLoading } = useDynasties();
  const { activeId, setActiveId } = useActiveDynasty();
  const qc = useQueryClient();
  const [creating, setCreating] = useState(false);

  const del = useMutation({
    mutationFn: (id: number) => api.deleteDynasty(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["dynasties"] }),
  });

  return (
    <>
      <PageHeader
        title="Dynasties"
        subtitle="Each dynasty owns its own roster, schedules, and recruits."
        actions={
          <button onClick={() => setCreating(true)} className="btn-primary">
            <PlusIcon /> New dynasty
          </button>
        }
      />

      {isLoading ? (
        <Spinner />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          {(dynasties ?? []).map((d) => (
            <div key={d.id} className="card p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-2 min-w-0">
                  <span
                    className="h-3 w-3 rounded-full shrink-0"
                    style={{ background: d.accent_color }}
                  />
                  <div className="min-w-0">
                    <div className="font-semibold truncate">{d.school}</div>
                    <div className="text-sm text-ink-muted truncate">{d.name}</div>
                  </div>
                </div>
                {activeId === d.id && (
                  <span className="chip text-[color:var(--accent)] border-[color:var(--accent)]/40">
                    <CheckIcon width={12} height={12} /> active
                  </span>
                )}
              </div>
              <div className="mt-3 flex items-center gap-2 text-xs text-ink-muted">
                <span>Y{d.current_season_year}</span>
                <span>·</span>
                <span>Wk {d.current_week}</span>
              </div>
              <div className="mt-4 flex items-center gap-2">
                <button
                  onClick={() => setActiveId(d.id)}
                  className="btn-ghost flex-1"
                  disabled={activeId === d.id}
                >
                  {activeId === d.id ? "Active" : "Set active"}
                </button>
                <button
                  onClick={() => {
                    if (confirm(`Delete dynasty "${d.school} ${d.name}"? This cascades.`)) {
                      del.mutate(d.id);
                    }
                  }}
                  className="btn-danger"
                  aria-label="Delete dynasty"
                >
                  <TrashIcon />
                </button>
              </div>
            </div>
          ))}
          {dynasties && dynasties.length === 0 && (
            <div className="card p-6 text-center md:col-span-2 lg:col-span-3">
              <div className="font-semibold mb-1">No dynasties yet</div>
              <div className="text-sm text-ink-muted mb-4">
                Create your first dynasty to start tracking.
              </div>
              <button onClick={() => setCreating(true)} className="btn-primary">
                <PlusIcon /> New dynasty
              </button>
            </div>
          )}
        </div>
      )}

      <CreateDynastyModal open={creating} onClose={() => setCreating(false)} />
    </>
  );
}

function CreateDynastyModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const qc = useQueryClient();
  const { setActiveId } = useActiveDynasty();
  const [name, setName] = useState("");
  const [school, setSchool] = useState("");
  const [accent, setAccent] = useState("#FF6B1A");
  const [year, setYear] = useState(2026);

  const create = useMutation({
    mutationFn: () =>
      api.createDynasty({
        name,
        school,
        accent_color: accent,
        current_season_year: year,
        current_week: 0,
      }),
    onSuccess: (d) => {
      qc.invalidateQueries({ queryKey: ["dynasties"] });
      setActiveId(d.id);
      onClose();
      setName("");
      setSchool("");
    },
  });

  return (
    <Modal open={open} onClose={onClose} title="New dynasty">
      <div className="space-y-3">
        <div>
          <label className="label">School</label>
          <input
            className="input"
            placeholder="Tennessee"
            value={school}
            onChange={(e) => setSchool(e.target.value)}
          />
        </div>
        <div>
          <label className="label">Dynasty name</label>
          <input
            className="input"
            placeholder="Heupel Era"
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="label">Starting year</label>
            <input
              className="input"
              type="number"
              value={year}
              onChange={(e) => setYear(Number(e.target.value))}
            />
          </div>
          <div>
            <label className="label">Accent color</label>
            <div className="flex items-center gap-2">
              <input
                type="color"
                value={accent}
                onChange={(e) => setAccent(e.target.value)}
                className="h-9 w-12 rounded bg-bg-soft border border-border"
              />
              <input
                className="input flex-1"
                value={accent}
                onChange={(e) => setAccent(e.target.value)}
              />
            </div>
          </div>
        </div>
        {create.isError && <ErrorBox error={create.error} />}
        <div className="flex justify-end gap-2 pt-2">
          <button onClick={onClose} className="btn-ghost">
            Cancel
          </button>
          <button
            onClick={() => create.mutate()}
            disabled={!school || !name || create.isPending}
            className="btn-primary"
          >
            {create.isPending ? <Spinner /> : "Create"}
          </button>
        </div>
      </div>
    </Modal>
  );
}
