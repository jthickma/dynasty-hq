import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "../lib/api";
import { ErrorBox, PageHeader, Spinner } from "../components/UI";
import type { OpenAIModel } from "../lib/types";

export function Settings() {
  const qc = useQueryClient();
  const settingsQ = useQuery({ queryKey: ["settings"], queryFn: api.getSettings });

  const [apiKeyDraft, setApiKeyDraft] = useState("");
  const [modelDraft, setModelDraft] = useState<string>("");
  const [showKey, setShowKey] = useState(false);
  const [onlyVision, setOnlyVision] = useState(true);

  // seed model picker from saved value
  useEffect(() => {
    if (settingsQ.data && !modelDraft) {
      setModelDraft(settingsQ.data.openai_vision_model);
    }
  }, [settingsQ.data, modelDraft]);

  // Fetch model list. Use the unsaved key if user typed one, otherwise the
  // saved key. Only enabled once we know a key exists somewhere.
  const effectiveKeyHint = apiKeyDraft.trim() || (settingsQ.data?.openai_api_key_set ? "saved" : "");
  const modelsQ = useQuery({
    queryKey: ["openai-models", apiKeyDraft.trim() || "saved"],
    queryFn: () => api.listOpenAIModels(apiKeyDraft.trim() || undefined),
    enabled: !!effectiveKeyHint,
    retry: false,
  });

  const saveM = useMutation({
    mutationFn: () =>
      api.updateSettings({
        ...(apiKeyDraft.trim() ? { openai_api_key: apiKeyDraft.trim() } : {}),
        ...(modelDraft ? { openai_vision_model: modelDraft } : {}),
      }),
    onSuccess: () => {
      setApiKeyDraft("");
      qc.invalidateQueries({ queryKey: ["settings"] });
      qc.invalidateQueries({ queryKey: ["openai-models"] });
    },
  });

  const clearKeyM = useMutation({
    mutationFn: () => api.updateSettings({ openai_api_key: "" }),
    onSuccess: () => {
      setApiKeyDraft("");
      qc.invalidateQueries({ queryKey: ["settings"] });
      qc.invalidateQueries({ queryKey: ["openai-models"] });
    },
  });

  const testM = useMutation({
    mutationFn: () => api.testOpenAI(apiKeyDraft.trim() || undefined),
  });

  const filteredModels: OpenAIModel[] = useMemo(() => {
    const all = modelsQ.data?.models ?? [];
    return onlyVision ? all.filter((m) => m.vision) : all;
  }, [modelsQ.data, onlyVision]);

  if (settingsQ.isLoading) return <Spinner />;
  if (settingsQ.error) return <ErrorBox error={settingsQ.error} />;
  const s = settingsQ.data!;

  return (
    <>
      <PageHeader
        title="Settings"
        subtitle="OpenAI vision model used for screenshot OCR import."
      />

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* API key */}
        <div className="card p-4 space-y-3">
          <h2 className="font-semibold">OpenAI API key</h2>
          <div className="text-xs text-ink-muted">
            Status:{" "}
            <span
              className={
                s.openai_api_key_set ? "text-emerald-300 font-semibold" : "text-amber-300 font-semibold"
              }
            >
              {s.openai_api_key_set ? "configured" : "not set"}
            </span>{" "}
            · source: <code className="font-mono">{s.openai_api_key_source}</code>
            {s.openai_api_key_source === "env" && (
              <span> (env var wins; clear it to use a UI-managed key)</span>
            )}
          </div>

          <div>
            <label className="label">New API key</label>
            <div className="flex gap-2">
              <input
                type={showKey ? "text" : "password"}
                className="input flex-1 font-mono"
                placeholder="sk-..."
                value={apiKeyDraft}
                onChange={(e) => setApiKeyDraft(e.target.value)}
                autoComplete="off"
                spellCheck={false}
              />
              <button className="btn-ghost" onClick={() => setShowKey((x) => !x)}>
                {showKey ? "Hide" : "Show"}
              </button>
            </div>
            <div className="text-[11px] text-ink-dim mt-1">
              Stored in the SQLite DB at <code className="font-mono">DYNASTY_DB_PATH</code>.
              Leave blank when saving to keep the existing key.
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            <button
              className="btn-ghost"
              disabled={testM.isPending}
              onClick={() => testM.mutate()}
            >
              {testM.isPending ? <Spinner /> : "Test connection"}
            </button>
            {s.openai_api_key_set && s.openai_api_key_source === "db" && (
              <button
                className="btn-ghost"
                disabled={clearKeyM.isPending}
                onClick={() => {
                  if (confirm("Clear the saved OpenAI API key?")) clearKeyM.mutate();
                }}
              >
                {clearKeyM.isPending ? <Spinner /> : "Clear saved key"}
              </button>
            )}
          </div>

          {testM.data && (
            <div className="rounded-md border border-emerald-500/40 bg-emerald-500/10 px-3 py-2 text-sm text-emerald-300">
              OK — {testM.data.model_count} models visible from this key.
            </div>
          )}
          {testM.error && <ErrorBox error={testM.error} />}
          {clearKeyM.error && <ErrorBox error={clearKeyM.error} />}
        </div>

        {/* Model picker */}
        <div className="card p-4 space-y-3">
          <h2 className="font-semibold">Vision model</h2>
          <div className="text-xs text-ink-muted">
            Active: <code className="font-mono">{s.openai_vision_model}</code> · source:{" "}
            <code className="font-mono">{s.openai_vision_model_source}</code> · default:{" "}
            <code className="font-mono">{s.default_model}</code>
          </div>

          {!effectiveKeyHint && (
            <div className="text-sm text-amber-300">
              Add an API key (or test one above) to load the model list.
            </div>
          )}

          {modelsQ.isFetching && <Spinner />}
          {modelsQ.error && <ErrorBox error={modelsQ.error} />}

          {modelsQ.data && (
            <>
              <label className="flex items-center gap-2 text-xs text-ink-muted">
                <input
                  type="checkbox"
                  checked={onlyVision}
                  onChange={(e) => setOnlyVision(e.target.checked)}
                />
                Only vision-capable models ({modelsQ.data.models.filter((m) => m.vision).length} of{" "}
                {modelsQ.data.models.length})
              </label>

              <div>
                <label className="label">Selected model</label>
                <select
                  className="input"
                  value={modelDraft}
                  onChange={(e) => setModelDraft(e.target.value)}
                >
                  {!filteredModels.find((m) => m.id === modelDraft) && modelDraft && (
                    <option value={modelDraft}>{modelDraft} (current)</option>
                  )}
                  {filteredModels.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.id}
                      {m.vision ? "  · vision" : ""}
                    </option>
                  ))}
                </select>
                <div className="text-[11px] text-ink-dim mt-1">
                  Only models that accept image input will OCR screenshots. Non-vision
                  models will return an OpenAI error when used.
                </div>
              </div>
            </>
          )}
        </div>
      </div>

      <div className="card p-4 mt-4 flex flex-wrap items-center gap-3">
        <button
          className="btn-primary"
          disabled={saveM.isPending || (!apiKeyDraft.trim() && !modelDraft)}
          onClick={() => saveM.mutate()}
        >
          {saveM.isPending ? <Spinner /> : "Save settings"}
        </button>
        {saveM.error && <ErrorBox error={saveM.error} />}
        {saveM.data && (
          <span className="text-emerald-300 text-sm">Saved.</span>
        )}
      </div>
    </>
  );
}
