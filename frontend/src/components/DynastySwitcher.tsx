import { useState, useRef, useEffect } from "react";
import { Link } from "react-router-dom";
import { useActiveDynasty } from "../hooks/useDynastyId";
import { ChevronDown, PlusIcon } from "./Icons";

export function DynastySwitcher() {
  const { dynasties, active, setActiveId } = useActiveDynasty();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function onDocClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onDocClick);
    return () => document.removeEventListener("mousedown", onDocClick);
  }, []);

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-2 rounded-md border border-border bg-bg-card px-3 py-2 text-sm hover:bg-bg-hover w-full max-w-[260px]"
      >
        {active ? (
          <>
            <span
              className="h-2.5 w-2.5 rounded-full shrink-0"
              style={{ background: active.accent_color }}
            />
            <span className="truncate font-medium text-left flex-1">
              {active.school}
              <span className="text-ink-muted ml-2 font-normal">{active.name}</span>
            </span>
          </>
        ) : (
          <span className="text-ink-muted">No dynasty</span>
        )}
        <ChevronDown className="text-ink-muted shrink-0" />
      </button>
      {open && (
        <div className="absolute left-0 right-0 top-full mt-1 z-30 rounded-md border border-border bg-bg-card shadow-xl overflow-hidden">
          <div className="max-h-[60vh] overflow-y-auto">
            {(dynasties ?? []).map((d) => (
              <button
                key={d.id}
                onClick={() => {
                  setActiveId(d.id);
                  setOpen(false);
                }}
                className={`w-full text-left px-3 py-2 text-sm hover:bg-bg-hover flex items-center gap-2 ${
                  active?.id === d.id ? "bg-bg-hover" : ""
                }`}
              >
                <span
                  className="h-2.5 w-2.5 rounded-full shrink-0"
                  style={{ background: d.accent_color }}
                />
                <div className="flex-1 truncate">
                  <div className="font-medium truncate">{d.school}</div>
                  <div className="text-xs text-ink-muted truncate">{d.name}</div>
                </div>
                <span className="text-xs text-ink-muted">Y{d.current_season_year}</span>
              </button>
            ))}
            {(!dynasties || dynasties.length === 0) && (
              <div className="px-3 py-3 text-sm text-ink-muted">No dynasties yet</div>
            )}
          </div>
          <div className="border-t border-border">
            <Link
              to="/dynasties"
              onClick={() => setOpen(false)}
              className="flex items-center gap-2 px-3 py-2 text-sm hover:bg-bg-hover text-[color:var(--accent)]"
            >
              <PlusIcon /> Manage dynasties
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}
