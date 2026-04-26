import { useState, useMemo } from "react";
import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { api } from "../lib/api";
import { useActiveDynasty } from "../hooks/useDynastyId";
import { PageHeader, Empty, Spinner, ErrorBox } from "../components/UI";
import { POSITION_GROUPS } from "../lib/types";
import { ratingColor, devTraitColor, classYearShort } from "../lib/format";
import { SearchIcon, XIcon } from "../components/Icons";

export function Roster() {
  const { active } = useActiveDynasty();
  const [posGroup, setPosGroup] = useState<string>("");
  const [year, setYear] = useState<string>("");
  const [minOvr, setMinOvr] = useState<string>("");
  const [search, setSearch] = useState<string>("");

  const params = useMemo(
    () => ({
      pos_group: posGroup || undefined,
      year: year || undefined,
      min_ovr: minOvr ? Number(minOvr) : undefined,
      search: search || undefined,
    }),
    [posGroup, year, minOvr, search],
  );

  const players = useQuery({
    queryKey: ["players", active?.id, params],
    queryFn: () => api.listPlayers(active!.id, params),
    enabled: !!active,
  });

  if (!active) return <Empty title="Pick a dynasty" body="No dynasty selected." />;

  const hasFilters = !!(posGroup || year || minOvr || search);

  return (
    <>
      <PageHeader
        title="Roster"
        subtitle={
          players.data ? `${players.data.length} player${players.data.length === 1 ? "" : "s"}` : ""
        }
      />

      <div className="card p-3 mb-4 space-y-3">
        <div className="relative">
          <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-muted" />
          <input
            className="input pl-10"
            placeholder="Search by name…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <FilterChip
            label="Pos"
            value={posGroup}
            onChange={setPosGroup}
            options={POSITION_GROUPS as readonly string[]}
          />
          <FilterChip
            label="Year"
            value={year}
            onChange={setYear}
            options={["FR", "SO", "JR", "SR"]}
          />
          <select
            className="input w-auto"
            value={minOvr}
            onChange={(e) => setMinOvr(e.target.value)}
          >
            <option value="">Any OVR</option>
            <option value="60">60+</option>
            <option value="70">70+</option>
            <option value="75">75+</option>
            <option value="80">80+</option>
            <option value="85">85+</option>
            <option value="90">90+</option>
          </select>
          {hasFilters && (
            <button
              onClick={() => {
                setPosGroup("");
                setYear("");
                setMinOvr("");
                setSearch("");
              }}
              className="btn-ghost text-xs"
            >
              <XIcon width={14} height={14} /> Clear
            </button>
          )}
        </div>
      </div>

      {players.isError && <ErrorBox error={players.error} />}
      {players.isLoading ? (
        <Spinner />
      ) : (players.data?.length ?? 0) === 0 ? (
        <Empty
          title={hasFilters ? "No matches" : "No players yet"}
          body={hasFilters ? "Try clearing filters." : "Use Import to load your roster CSV."}
        />
      ) : (
        <>
          {/* Desktop table */}
          <div className="hidden md:block card overflow-hidden">
            <div className="overflow-x-auto max-h-[70vh] overflow-y-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr>
                    <th className="table-th w-12">OVR</th>
                    <th className="table-th">Name</th>
                    <th className="table-th w-16">Pos</th>
                    <th className="table-th w-20">Year</th>
                    <th className="table-th w-20">Dev</th>
                    <th className="table-th w-12">SPD</th>
                    <th className="table-th w-12">STR</th>
                    <th className="table-th w-12">AWR</th>
                    <th className="table-th w-12">AGI</th>
                    <th className="table-th w-12">ACC</th>
                  </tr>
                </thead>
                <tbody>
                  {players.data!.map((p) => (
                    <tr key={p.id} className="hover:bg-bg-hover">
                      <td className={`table-td stat-num font-bold ${ratingColor(p.ovr)}`}>
                        {p.ovr ?? "—"}
                      </td>
                      <td className="table-td">
                        <Link
                          to={`/roster/${p.id}`}
                          className="hover:text-[color:var(--accent)] font-medium"
                        >
                          {p.name}
                        </Link>
                        {p.archetype && (
                          <span className="ml-2 text-xs text-ink-muted">{p.archetype}</span>
                        )}
                      </td>
                      <td className="table-td text-ink-muted">{p.pos ?? "—"}</td>
                      <td className="table-td text-ink-muted">{classYearShort(p.year)}</td>
                      <td className={`table-td ${devTraitColor(p.dev_trait)}`}>
                        {p.dev_trait ?? "—"}
                      </td>
                      <td className={`table-td stat-num ${ratingColor(p.spd)}`}>{p.spd ?? "—"}</td>
                      <td className={`table-td stat-num ${ratingColor(p.strength)}`}>
                        {p.strength ?? "—"}
                      </td>
                      <td className={`table-td stat-num ${ratingColor(p.awr)}`}>{p.awr ?? "—"}</td>
                      <td className={`table-td stat-num ${ratingColor(p.agi)}`}>{p.agi ?? "—"}</td>
                      <td className={`table-td stat-num ${ratingColor(p.acc)}`}>{p.acc ?? "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Mobile list */}
          <div className="md:hidden space-y-2">
            {players.data!.map((p) => (
              <Link
                key={p.id}
                to={`/roster/${p.id}`}
                className="card p-3 flex items-center gap-3 hover:bg-bg-hover"
              >
                <div
                  className={`stat-num text-xl font-bold w-12 text-center ${ratingColor(p.ovr)}`}
                >
                  {p.ovr ?? "—"}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="font-semibold truncate">{p.name}</div>
                  <div className="text-xs text-ink-muted truncate">
                    {p.pos ?? "—"} · {classYearShort(p.year)}
                    {p.dev_trait && (
                      <span className={`ml-2 ${devTraitColor(p.dev_trait)}`}>{p.dev_trait}</span>
                    )}
                  </div>
                </div>
                <div className="flex flex-col items-end text-[10px] text-ink-muted">
                  <span>SPD {p.spd ?? "—"}</span>
                  <span>STR {p.strength ?? "—"}</span>
                </div>
              </Link>
            ))}
          </div>
        </>
      )}
    </>
  );
}

function FilterChip({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  options: readonly string[];
}) {
  return (
    <select
      className="input w-auto"
      value={value}
      onChange={(e) => onChange(e.target.value)}
      aria-label={label}
    >
      <option value="">{label}: any</option>
      {options.map((o) => (
        <option key={o} value={o}>
          {label}: {o}
        </option>
      ))}
    </select>
  );
}
