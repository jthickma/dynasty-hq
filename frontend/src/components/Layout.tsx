import { NavLink, Outlet } from "react-router-dom";
import { useEffect } from "react";
import { useActiveDynasty } from "../hooks/useDynastyId";
import { DynastySwitcher } from "./DynastySwitcher";
import {
  HomeIcon,
  RosterIcon,
  ScheduleIcon,
  RecruitIcon,
  StatsIcon,
  ImportIcon,
  SettingsIcon,
} from "./Icons";

const NAV = [
  { to: "/", label: "Dashboard", Icon: HomeIcon, end: true },
  { to: "/roster", label: "Roster", Icon: RosterIcon },
  { to: "/schedule", label: "Schedule", Icon: ScheduleIcon },
  { to: "/recruits", label: "Recruits", Icon: RecruitIcon },
  { to: "/stats", label: "Stats", Icon: StatsIcon },
  { to: "/import", label: "Import", Icon: ImportIcon },
  { to: "/dynasties", label: "Dynasties", Icon: SettingsIcon },
  { to: "/settings", label: "Settings", Icon: SettingsIcon },
];

export function Layout() {
  const { active } = useActiveDynasty();

  useEffect(() => {
    if (active?.accent_color) {
      document.documentElement.style.setProperty("--accent", active.accent_color);
    } else {
      document.documentElement.style.setProperty("--accent", "#FF6B1A");
    }
  }, [active?.accent_color]);

  return (
    <div className="min-h-full flex bg-bg">
      {/* Desktop sidebar */}
      <aside className="hidden md:flex md:w-60 lg:w-64 flex-col border-r border-border bg-bg-soft sticky top-0 h-screen">
        <div className="px-4 py-4 border-b border-border">
          <div className="flex items-center gap-2">
            <div
              className="h-8 w-8 rounded-md grid place-items-center font-bold text-black"
              style={{ background: "var(--accent)" }}
            >
              D
            </div>
            <div>
              <div className="text-sm font-bold tracking-wide">DYNASTY HQ</div>
              <div className="text-[10px] text-ink-muted uppercase tracking-widest">
                CFB 26 tracker
              </div>
            </div>
          </div>
        </div>
        <div className="px-3 py-3 border-b border-border">
          <DynastySwitcher />
        </div>
        <nav className="flex-1 p-2 space-y-0.5 overflow-y-auto">
          {NAV.map(({ to, label, Icon, end }) => (
            <NavLink
              key={to}
              to={to}
              end={end}
              className={({ isActive }) =>
                `flex items-center gap-3 px-3 py-2 rounded-md text-sm transition-colors ${
                  isActive
                    ? "bg-bg-card text-ink border border-border"
                    : "text-ink-muted hover:text-ink hover:bg-bg-card border border-transparent"
                }`
              }
            >
              <Icon />
              <span>{label}</span>
            </NavLink>
          ))}
        </nav>
        <div className="p-3 border-t border-border text-[10px] text-ink-dim">
          {active ? `Y${active.current_season_year} · Wk ${active.current_week}` : "—"}
        </div>
      </aside>

      {/* Main */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Mobile top bar */}
        <header className="md:hidden sticky top-0 z-20 bg-bg-soft border-b border-border px-3 py-2 flex items-center gap-2">
          <div
            className="h-7 w-7 rounded-md grid place-items-center font-bold text-black text-sm"
            style={{ background: "var(--accent)" }}
          >
            D
          </div>
          <div className="flex-1 min-w-0">
            <DynastySwitcher />
          </div>
        </header>

        <main className="flex-1 min-w-0 p-3 sm:p-4 md:p-6 pb-24 md:pb-6">
          <Outlet />
        </main>

        {/* Mobile bottom nav */}
        <nav className="md:hidden fixed bottom-0 inset-x-0 z-20 bg-bg-soft border-t border-border grid grid-cols-6">
          {NAV.slice(0, 6).map(({ to, label, Icon, end }) => (
            <NavLink
              key={to}
              to={to}
              end={end}
              className={({ isActive }) =>
                `flex flex-col items-center justify-center gap-0.5 py-2 text-[10px] ${
                  isActive ? "text-[color:var(--accent)]" : "text-ink-muted"
                }`
              }
            >
              <Icon width={20} height={20} />
              <span className="leading-tight">{label}</span>
            </NavLink>
          ))}
        </nav>
      </div>
    </div>
  );
}
