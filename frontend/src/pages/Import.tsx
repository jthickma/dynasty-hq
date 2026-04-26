import { useRef, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "../lib/api";
import { useActiveDynasty } from "../hooks/useDynastyId";
import { PageHeader, Empty, Spinner, ErrorBox } from "../components/UI";
import type { ImportResult } from "../lib/types";

export function Import() {
  const { active } = useActiveDynasty();
  const qc = useQueryClient();
  const [csv, setCsv] = useState("");
  const [updateExisting, setUpdateExisting] = useState(true);
  const [result, setResult] = useState<ImportResult | null>(null);
  const [preview, setPreview] = useState<{ count: number; warnings: string[] } | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const previewM = useMutation({
    mutationFn: () => api.previewRoster(active!.id, csv),
    onSuccess: (r) => setPreview({ count: r.count, warnings: r.warnings }),
  });

  const importM = useMutation({
    mutationFn: () => api.importRosterText(active!.id, csv, updateExisting),
    onSuccess: (r) => {
      setResult(r);
      qc.invalidateQueries({ queryKey: ["players"] });
      qc.invalidateQueries({ queryKey: ["roster-summary"] });
      qc.invalidateQueries({ queryKey: ["leaders-ratings"] });
    },
  });

  const fileM = useMutation({
    mutationFn: (file: File) => api.importRosterFile(active!.id, file, updateExisting),
    onSuccess: (r) => {
      setResult(r);
      qc.invalidateQueries({ queryKey: ["players"] });
      qc.invalidateQueries({ queryKey: ["roster-summary"] });
      qc.invalidateQueries({ queryKey: ["leaders-ratings"] });
    },
  });

  if (!active) return <Empty title="Pick a dynasty" />;

  return (
    <>
      <PageHeader
        title="Import roster"
        subtitle="Paste MaxPlaysCFB CSV output, or upload a .csv file."
      />

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="card p-4 space-y-3">
          <h2 className="font-semibold">Paste CSV</h2>
          <textarea
            className="input font-mono text-xs"
            rows={14}
            placeholder="RS,NAME,YEAR,POS,OVR,SPD,ACC,AGI,COD,STR,AWR,CAR,BCV..."
            value={csv}
            onChange={(e) => {
              setCsv(e.target.value);
              setResult(null);
              setPreview(null);
            }}
          />
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={updateExisting}
              onChange={(e) => setUpdateExisting(e.target.checked)}
            />
            Update existing players (NULL never overwrites a real value)
          </label>
          <div className="flex flex-wrap gap-2">
            <button
              onClick={() => previewM.mutate()}
              disabled={!csv || previewM.isPending}
              className="btn-ghost"
            >
              {previewM.isPending ? <Spinner /> : "Preview"}
            </button>
            <button
              onClick={() => importM.mutate()}
              disabled={!csv || importM.isPending}
              className="btn-primary"
            >
              {importM.isPending ? <Spinner /> : "Import"}
            </button>
          </div>
          {preview && (
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
          )}
          {previewM.isError && <ErrorBox error={previewM.error} />}
          {importM.isError && <ErrorBox error={importM.error} />}
        </div>

        <div className="card p-4 space-y-3">
          <h2 className="font-semibold">Upload file</h2>
          <input
            ref={fileRef}
            type="file"
            accept=".csv,text/csv,text/plain"
            className="block text-sm text-ink-muted file:mr-3 file:py-2 file:px-3 file:rounded-md file:border-0 file:bg-bg-soft file:text-ink hover:file:bg-bg-hover"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) {
                setResult(null);
                fileM.mutate(f);
              }
            }}
          />
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={updateExisting}
              onChange={(e) => setUpdateExisting(e.target.checked)}
            />
            Update existing
          </label>
          {fileM.isError && <ErrorBox error={fileM.error} />}
          {fileM.isPending && <Spinner />}

          {result && (
            <div className="rounded-md border border-emerald-500/40 bg-emerald-500/10 p-3 text-sm space-y-1">
              <div>
                <span className="font-bold text-emerald-300 stat-num">{result.created}</span>{" "}
                created ·{" "}
                <span className="font-bold text-emerald-300 stat-num">{result.updated}</span>{" "}
                updated ·{" "}
                <span className="text-ink-muted stat-num">{result.unchanged}</span>{" "}
                unchanged
              </div>
              {result.warnings.length > 0 && (
                <details>
                  <summary className="cursor-pointer text-amber-300 text-xs">
                    {result.warnings.length} warnings
                  </summary>
                  <ul className="mt-1 text-xs text-ink-muted list-disc pl-4">
                    {result.warnings.map((w, i) => (
                      <li key={i}>{w}</li>
                    ))}
                  </ul>
                </details>
              )}
              {result.errors.length > 0 && (
                <details>
                  <summary className="cursor-pointer text-red-300 text-xs">
                    {result.errors.length} errors
                  </summary>
                  <ul className="mt-1 text-xs text-red-200 list-disc pl-4">
                    {result.errors.map((w, i) => (
                      <li key={i}>{w}</li>
                    ))}
                  </ul>
                </details>
              )}
            </div>
          )}

          <div className="text-xs text-ink-muted leading-relaxed">
            Match key: <code className="font-mono">(dynasty, name, pos)</code>. Cropped screenshots
            are safe — NULL ratings never overwrite real values. The Max preamble line is stripped
            automatically.
          </div>
        </div>
      </div>
    </>
  );
}
