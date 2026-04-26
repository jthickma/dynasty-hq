import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { api } from "../lib/api";

const STORAGE_KEY = "dynasty-hq.activeDynastyId";

function readStored(): number | null {
  const v = localStorage.getItem(STORAGE_KEY);
  if (!v) return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

export function useDynasties() {
  return useQuery({ queryKey: ["dynasties"], queryFn: api.listDynasties });
}

export function useActiveDynasty() {
  const { data: dynasties, isLoading } = useDynasties();
  const [activeId, setActiveIdState] = useState<number | null>(readStored());

  useEffect(() => {
    if (!dynasties || dynasties.length === 0) return;
    if (activeId && dynasties.some((d) => d.id === activeId)) return;
    const fallback = dynasties[0].id;
    setActiveIdState(fallback);
    localStorage.setItem(STORAGE_KEY, String(fallback));
  }, [dynasties, activeId]);

  const setActiveId = (id: number) => {
    setActiveIdState(id);
    localStorage.setItem(STORAGE_KEY, String(id));
  };

  const active = dynasties?.find((d) => d.id === activeId) ?? null;
  return { dynasties, active, activeId, setActiveId, isLoading };
}
