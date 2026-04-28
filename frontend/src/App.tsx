import { Routes, Route, Navigate } from "react-router-dom";
import { Layout } from "./components/Layout";
import { Dashboard } from "./pages/Dashboard";
import { Roster } from "./pages/Roster";
import { PlayerDetail } from "./pages/PlayerDetail";
import { Schedule } from "./pages/Schedule";
import { Recruits } from "./pages/Recruits";
import { Stats } from "./pages/Stats";
import { Import } from "./pages/Import";
import { Dynasties } from "./pages/Dynasties";
import { Settings } from "./pages/Settings";

export default function App() {
  return (
    <Routes>
      <Route element={<Layout />}>
        <Route index element={<Dashboard />} />
        <Route path="/roster" element={<Roster />} />
        <Route path="/roster/:playerId" element={<PlayerDetail />} />
        <Route path="/schedule" element={<Schedule />} />
        <Route path="/recruits" element={<Recruits />} />
        <Route path="/stats" element={<Stats />} />
        <Route path="/import" element={<Import />} />
        <Route path="/dynasties" element={<Dynasties />} />
        <Route path="/settings" element={<Settings />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Route>
    </Routes>
  );
}
