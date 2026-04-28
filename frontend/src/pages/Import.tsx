import { useState } from "react";
import { Link } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "../lib/api";
import { useActiveDynasty } from "../hooks/useDynastyId";
import { ErrorBox, Empty, PageHeader, Spinner } from "../components/UI";
import type {
  ImportResult,
  ImageImportDryRun,
  ImageImportResult,
} from "../lib/types";

type ImportMode = "roster" | "season-stats" | "screenshots";

export function Import() {
  const { active } = useActiveDynasty();
  const qc = useQueryClient();
  const [mode, setMode] = useState<ImportMode>("roster");

  const [rosterCsv, setRosterCsv] = useState("");
  const [updateExisting, setUpdateExisting] = useState(true);
  const [seasonStatsText, setSeasonStatsText] = useState("");
  const [seasonYear, setSeasonYear] = useState<number | "">(active?.current_season_year ?? "");

  const [result, setResult] = useState<ImportResult | null>(null);
  const [preview, setPreview] = useState<{ count: number; warnings: string[] } | null>(null);
  const invalidateRoster = () => {
    qc.invalidateQueries({ queryKey: ["players"] });
    qc.invalidateQueries({ queryKey: ["roster-summary"] });
    qc.invalidateQueries({ queryKey: ["leaders-ratings"] });
    qc.invalidateQueries({ queryKey: ["leaders-ratings-page"] });
  };

  const invalidateSeasonStats = () => {
    qc.invalidateQueries({ queryKey: ["player-stats"] });
    qc.invalidateQueries({ queryKey: ["leaders-stats"] });
  };

  const previewRosterM = useMutation({
    mutationFn: () => api.previewRoster(active!.id, rosterCsv),
    onSuccess: (r) => setPreview({ count: r.count, warnings: r.warnings }),
  });

  const importRosterM = useMutation({
    mutationFn: () => api.importRosterText(active!.id, rosterCsv, updateExisting),
    onSuccess: (r) => {
      setResult(r);
      invalidateRoster();
    },
  });

  const importRosterFileM = useMutation({
    mutationFn: (file: File) => api.importRosterFile(active!.id, file, updateExisting),
    onSuccess: (r) => {
      setResult(r);
      invalidateRoster();
    },
  });

  const previewSeasonStatsM = useMutation({
    mutationFn: () => api.previewSeasonStats(active!.id, seasonStatsText),
    onSuccess: (r) => setPreview({ count: r.count, warnings: r.warnings }),
  });

  const importSeasonStatsM = useMutation({
    mutationFn: () =>
      api.importSeasonStatsText(
        active!.id,
        seasonStatsText,
        seasonYear === "" ? undefined : seasonYear,
      ),
    onSuccess: (r) => {
      setResult(r);
      invalidateSeasonStats();
    },
  });

  const importSeasonStatsFileM = useMutation({
    mutationFn: (file: File) =>
      api.importSeasonStatsFile(active!.id, file, seasonYear === "" ? undefined : seasonYear),
    onSuccess: (r) => {
      setResult(r);
      invalidateSeasonStats();
    },
  });

  if (!active) return <Empty title="Pick a dynasty" />;

  const clearFeedback = () => {
    setResult(null);
    setPreview(null);
  };

  const seasonPlaceholder = `AQUINAS - RUSHING
NAME,POS,GP,CAR,▼YARDS,AVG,TD,AVG G,20+,BTK,YAC,LONG
T.Yancey,HB,2,59,317,5.4,5,158.5,4,8,113,35

AQUINAS - PASSING
NAME,POS,GP,COMP,ATT,COMP%,▼YARDS,TD,TD %,INT,INT %,TD:IN
L.Davis,OB,2,60,80,75%,686,5,6.3,0,0.0,5.0`;

  const activePreviewError = mode === "roster" ? previewRosterM.error : previewSeasonStatsM.error;
  const activeImportError =
    mode === "roster" ? importRosterM.error : importSeasonStatsM.error;
  const activeFileError =
    mode === "roster" ? importRosterFileM.error : importSeasonStatsFileM.error;
  const activeFilePending =
    mode === "roster" ? importRosterFileM.isPending : importSeasonStatsFileM.isPending;

  return (
    <>
      <PageHeader title="Import" subtitle="Roster CSV, season stat blocks, and screenshot OCR." />

      <div className="flex flex-wrap gap-2 mb-4">
        <button
          className={mode === "roster" ? "btn-primary" : "btn-ghost"}
          onClick={() => {
            setMode("roster");
            clearFeedback();
          }}
        >
          Roster
        </button>
        <button
          className={mode === "season-stats" ? "btn-primary" : "btn-ghost"}
          onClick={() => {
            setMode("season-stats");
            clearFeedback();
          }}
        >
          Season stats
        </button>
        <button
          className={mode === "screenshots" ? "btn-primary" : "btn-ghost"}
          onClick={() => {
            setMode("screenshots");
            clearFeedback();
          }}
        >
          Screenshots (OCR)
        </button>
      </div>

      {mode === "screenshots" ? (
        <ScreenshotPanel
          dynastyId={active.id}
          defaultSeasonYear={active.current_season_year}
          onRosterDone={(r) => {
            setResult(r);
            invalidateRoster();
          }}
          onStatsDone={(r) => {
            setResult(r);
            invalidateSeasonStats();
          }}
        />
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <div className="card p-4 space-y-3">
            <div className="flex items-center justify-between gap-3">
              <h2 className="font-semibold">{mode === "roster" ? "Paste roster CSV" : "Paste season stats"}</h2>
              {mode === "season-stats" && (
                <div className="w-32">
                  <label className="label">Season year</label>
                  <input
                    type="number"
                    className="input"
                    value={seasonYear}
                    onChange={(e) =>
                      setSeasonYear(e.target.value === "" ? "" : Number(e.target.value))
                    }
                  />
                </div>
              )}
            </div>

            <textarea
              className="input font-mono text-xs"
              rows={16}
              placeholder={
                mode === "roster"
                  ? "RS,NAME,YEAR,POS,OVR,SPD,ACC,AGI,COD,STR,AWR,CAR,BCV..."
                  : seasonPlaceholder
              }
              value={mode === "roster" ? rosterCsv : seasonStatsText}
              onChange={(e) => {
                clearFeedback();
                if (mode === "roster") setRosterCsv(e.target.value);
                else setSeasonStatsText(e.target.value);
              }}
            />

            {mode === "roster" ? (
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={updateExisting}
                  onChange={(e) => setUpdateExisting(e.target.checked)}
                />
                Update existing players (NULL never overwrites a real value)
              </label>
            ) : (
              <div className="text-xs text-ink-muted leading-relaxed">
                Paste the full season blocks for rushing, passing, receiving, and defense. The import
                merges categories into one season line per player.
              </div>
            )}

            <div className="flex flex-wrap gap-2">
              <button
                onClick={() =>
                  mode === "roster" ? previewRosterM.mutate() : previewSeasonStatsM.mutate()
                }
                disabled={
                  mode === "roster"
                    ? !rosterCsv || previewRosterM.isPending
                    : !seasonStatsText || previewSeasonStatsM.isPending
                }
                className="btn-ghost"
              >
                {((mode === "roster" && previewRosterM.isPending) ||
                  (mode === "season-stats" && previewSeasonStatsM.isPending)) ? (
                  <Spinner />
                ) : (
                  "Preview"
                )}
              </button>
              <button
                onClick={() => (mode === "roster" ? importRosterM.mutate() : importSeasonStatsM.mutate())}
                disabled={
                  mode === "roster"
                    ? !rosterCsv || importRosterM.isPending
                    : !seasonStatsText || importSeasonStatsM.isPending
                }
                className="btn-primary"
              >
                {((mode === "roster" && importRosterM.isPending) ||
                  (mode === "season-stats" && importSeasonStatsM.isPending)) ? (
                  <Spinner />
                ) : (
                  "Import"
                )}
              </button>
            </div>

            {preview && <PreviewSummary preview={preview} />}
            {activePreviewError && <ErrorBox error={activePreviewError} />}
            {activeImportError && <ErrorBox error={activeImportError} />}
          </div>

          <div className="card p-4 space-y-3">
            <h2 className="font-semibold">
              {mode === "roster" ? "Upload roster file" : "Upload season stats file"}
            </h2>
            {mode === "season-stats" && (
              <div className="max-w-[9rem]">
                <label className="label">Season year</label>
                <input
                  type="number"
                  className="input"
                  value={seasonYear}
                  onChange={(e) =>
                    setSeasonYear(e.target.value === "" ? "" : Number(e.target.value))
                  }
                />
              </div>
            )}
            <input
              type="file"
              accept=".csv,text/csv,text/plain"
              className="block text-sm text-ink-muted file:mr-3 file:py-2 file:px-3 file:rounded-md file:border-0 file:bg-bg-soft file:text-ink hover:file:bg-bg-hover"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (!f) return;
                clearFeedback();
                if (mode === "roster") importRosterFileM.mutate(f);
                else importSeasonStatsFileM.mutate(f);
              }}
            />
            {mode === "roster" && (
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={updateExisting}
                  onChange={(e) => setUpdateExisting(e.target.checked)}
                />
                Update existing
              </label>
            )}

            {activeFileError && <ErrorBox error={activeFileError} />}
            {activeFilePending && <Spinner />}
            {result && <ImportSummary result={result} />}

            <div className="text-xs text-ink-muted leading-relaxed">
              {mode === "roster" ? (
                <>
                  Match key: <code className="font-mono">(dynasty, name, pos)</code>. Cropped
                  screenshots are safe because NULL ratings never overwrite real values.
                </>
              ) : (
                <>
                  Season stats match by player name inside the active dynasty and use position as a
                  tiebreaker when needed. Imported rows feed player history and season leaderboards.
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}

// ---------- Screenshot OCR panel ----------

type ScreenshotTarget = "roster" | "season-stats";

function ScreenshotPanel({
  dynastyId,
  defaultSeasonYear,
  onRosterDone,
  onStatsDone,
}: {
  dynastyId: number;
  defaultSeasonYear: number;
  onRosterDone: (r: ImportResult) => void;
  onStatsDone: (r: ImportResult) => void;
}) {
  const [target, setTarget] = useState<ScreenshotTarget>("roster");
  const [files, setFiles] = useState<File[]>([]);
  const [updateExisting, setUpdateExisting] = useState(true);
  const [seasonYear, setSeasonYear] = useState<number | "">(defaultSeasonYear);
  const [teamName, setTeamName] = useState("");
  const [instructions, setInstructions] = useState("");
  const [extracted, setExtracted] = useState<string | null>(null);
  const [previewMeta, setPreviewMeta] = useState<{ count: number; warnings: string[] } | null>(null);
  const [doneSummary, setDoneSummary] = useState<ImportResult | null>(null);

  const settingsQ = useQuery({ queryKey: ["settings"], queryFn: api.getSettings });
  const keyConfigured = settingsQ.data?.openai_api_key_set ?? false;
  const activeModel = settingsQ.data?.openai_vision_model;

  const reset = () => {
    setExtracted(null);
    setPreviewMeta(null);
    setDoneSummary(null);
  };

  const dryRunM = useMutation({
    mutationFn: async () => {
      if (target === "roster") {
        return (await api.importRosterImage(dynastyId, files, {
          dry_run: true,
          update_existing: updateExisting,
          instructions: instructions || undefined,
        })) as ImageImportDryRun;
      }
      return (await api.importSeasonStatsImage(dynastyId, files, {
        dry_run: true,
        season_year: seasonYear === "" ? undefined : seasonYear,
        team_name: teamName || undefined,
        instructions: instructions || undefined,
      })) as ImageImportDryRun;
    },
    onSuccess: (r) => {
      setExtracted(r.extracted_csv ?? r.extracted_text ?? "");
      setPreviewMeta({ count: r.count, warnings: r.warnings });
      setDoneSummary(null);
    },
  });

  const importM = useMutation({
    mutationFn: async () => {
      if (target === "roster") {
        return (await api.importRosterImage(dynastyId, files, {
          dry_run: false,
          update_existing: updateExisting,
          instructions: instructions || undefined,
        })) as ImageImportResult;
      }
      return (await api.importSeasonStatsImage(dynastyId, files, {
        dry_run: false,
        season_year: seasonYear === "" ? undefined : seasonYear,
        team_name: teamName || undefined,
        instructions: instructions || undefined,
      })) as ImageImportResult;
    },
    onSuccess: (r) => {
      setExtracted(r.extracted_csv ?? r.extracted_text ?? null);
      setDoneSummary(r);
      setPreviewMeta(null);
      if (target === "roster") onRosterDone(r);
      else onStatsDone(r);
    },
  });

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
      <div className="card p-4 space-y-3">
        <h2 className="font-semibold">Screenshot OCR (OpenAI vision)</h2>

        {!keyConfigured && (
          <div className="rounded-md border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-sm text-amber-200">
            No OpenAI API key configured.{" "}
            <Link to="/settings" className="underline">
              Add one in Settings
            </Link>{" "}
            to enable screenshot OCR.
          </div>
        )}

        <div className="text-xs text-ink-muted">
          Active model:{" "}
          <code className="font-mono">{activeModel ?? "—"}</code>{" "}
          <Link to="/settings" className="underline ml-1">
            change
          </Link>
        </div>

        <div className="flex gap-2">
          <button
            className={target === "roster" ? "btn-primary" : "btn-ghost"}
            onClick={() => {
              setTarget("roster");
              reset();
            }}
          >
            Roster
          </button>
          <button
            className={target === "season-stats" ? "btn-primary" : "btn-ghost"}
            onClick={() => {
              setTarget("season-stats");
              reset();
            }}
          >
            Season stats
          </button>
        </div>

        {target === "season-stats" && (
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="label">Season year</label>
              <input
                type="number"
                className="input"
                value={seasonYear}
                onChange={(e) =>
                  setSeasonYear(e.target.value === "" ? "" : Number(e.target.value))
                }
              />
            </div>
            <div>
              <label className="label">Team name (optional)</label>
              <input
                type="text"
                className="input"
                placeholder="AQUINAS"
                value={teamName}
                onChange={(e) => setTeamName(e.target.value)}
              />
            </div>
          </div>
        )}

        {target === "roster" && (
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={updateExisting}
              onChange={(e) => setUpdateExisting(e.target.checked)}
            />
            Update existing players
          </label>
        )}

        <div>
          <label className="label">Screenshots (PNG/JPEG/WEBP, ≤12 MB each)</label>
          <input
            type="file"
            multiple
            accept="image/png,image/jpeg,image/webp,image/gif"
            className="block text-sm text-ink-muted file:mr-3 file:py-2 file:px-3 file:rounded-md file:border-0 file:bg-bg-soft file:text-ink hover:file:bg-bg-hover"
            onChange={(e) => {
              setFiles(Array.from(e.target.files ?? []));
              reset();
            }}
          />
          {files.length > 0 && (
            <div className="text-xs text-ink-muted mt-1">
              {files.length} file{files.length === 1 ? "" : "s"} selected
            </div>
          )}
        </div>

        <div>
          <label className="label">Extra instructions for the model (optional)</label>
          <textarea
            className="input text-sm"
            rows={2}
            placeholder="e.g. Skip walk-ons; the team is AQUINAS"
            value={instructions}
            onChange={(e) => setInstructions(e.target.value)}
          />
        </div>

        <div className="flex flex-wrap gap-2">
          <button
            className="btn-ghost"
            disabled={!keyConfigured || files.length === 0 || dryRunM.isPending}
            onClick={() => dryRunM.mutate()}
          >
            {dryRunM.isPending ? <Spinner /> : "Extract & preview"}
          </button>
          <button
            className="btn-primary"
            disabled={!keyConfigured || files.length === 0 || importM.isPending}
            onClick={() => importM.mutate()}
          >
            {importM.isPending ? <Spinner /> : "Extract & import"}
          </button>
        </div>

        {dryRunM.error && <ErrorBox error={dryRunM.error} />}
        {importM.error && <ErrorBox error={importM.error} />}
        {previewMeta && <PreviewSummary preview={previewMeta} />}
        {doneSummary && <ImportSummary result={doneSummary} />}

        <div className="text-[11px] text-ink-dim leading-relaxed pt-1">
          Tip: crop tightly and zoom in on rating columns. The model leaves
          unreadable cells blank, and blanks never overwrite stored ratings —
          so partial screenshots are safe.
        </div>
      </div>

      <div className="card p-4 space-y-3 min-h-[16rem]">
        <h2 className="font-semibold">Extracted output</h2>
        {extracted ? (
          <textarea
            className="input font-mono text-xs"
            rows={20}
            readOnly
            value={extracted}
          />
        ) : (
          <div className="text-sm text-ink-muted">
            Run "Extract &amp; preview" to see the OCR output before importing.
          </div>
        )}
      </div>
    </div>
  );
}

function PreviewSummary({ preview }: { preview: { count: number; warnings: string[] } }) {
  return (
    <div className="rounded-md border border-border bg-bg-soft p-3 text-sm">
      <div>
        Parsed <span className="font-bold stat-num">{preview.count}</span> rows.
      </div>
      {preview.warnings.length > 0 && (
        <details className="mt-2">
          <summary className="cursor-pointer text-amber-300 text-xs">
            {preview.warnings.length} warning{preview.warnings.length === 1 ? "" : "s"}
          </summary>
          <ul className="mt-1 text-xs text-ink-muted list-disc pl-4 space-y-0.5">
            {preview.warnings.map((w, i) => (
              <li key={i}>{w}</li>
            ))}
          </ul>
        </details>
      )}
    </div>
  );
}

function ImportSummary({ result }: { result: ImportResult }) {
  return (
    <div className="rounded-md border border-emerald-500/40 bg-emerald-500/10 p-3 text-sm space-y-1">
      <div>
        <span className="font-bold text-emerald-300 stat-num">{result.created}</span> created ·{" "}
        <span className="font-bold text-emerald-300 stat-num">{result.updated}</span> updated ·{" "}
        <span className="text-ink-muted stat-num">{result.skipped}</span> skipped
      </div>
      <div className="text-xs text-ink-muted">
        Processed <span className="stat-num">{result.total_rows}</span> parsed rows.
      </div>
      {result.errors.length > 0 && (
        <details>
          <summary className="cursor-pointer text-amber-300 text-xs">
            {result.errors.length} note{result.errors.length === 1 ? "" : "s"}
          </summary>
          <ul className="mt-1 text-xs text-ink-muted list-disc pl-4 space-y-0.5">
            {result.errors.map((w, i) => (
              <li key={i}>{w}</li>
            ))}
          </ul>
        </details>
      )}
    </div>
  );
}
