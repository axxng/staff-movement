"use client";

import { createContext, useContext, useMemo, useState } from "react";
import { useStore } from "./store";

type SearchContextValue = {
  query: string;
  setQuery: (q: string) => void;
  matchedStaff: Set<string>;
  matchedTeams: Set<string>;
  hasQuery: boolean;
};

const SearchContext = createContext<SearchContextValue | null>(null);

export function SearchProvider({ children }: { children: React.ReactNode }) {
  const [query, setQuery] = useState("");
  const staff = useStore((s) => s.staff);
  const teams = useStore((s) => s.teams);
  const roles = useStore((s) => s.roles);

  const { matchedStaff, matchedTeams } = useMemo(() => {
    const ms = new Set<string>();
    const mt = new Set<string>();
    const q = query.trim().toLowerCase();
    if (!q) return { matchedStaff: ms, matchedTeams: mt };
    for (const s of Object.values(staff)) {
      const role = roles[s.roleId];
      const blob = `${s.name} ${role?.label ?? ""}`.toLowerCase();
      if (blob.includes(q)) ms.add(s.id);
    }
    for (const t of Object.values(teams)) {
      if (t.name.toLowerCase().includes(q)) {
        mt.add(t.id);
        // Also surface members of matched teams
        for (const m of t.memberIds) ms.add(m);
      }
    }
    // If a staff member matches, also surface every team they are in.
    for (const t of Object.values(teams)) {
      if (t.memberIds.some((m) => ms.has(m))) mt.add(t.id);
    }
    return { matchedStaff: ms, matchedTeams: mt };
  }, [query, staff, teams, roles]);

  const value: SearchContextValue = {
    query,
    setQuery,
    matchedStaff,
    matchedTeams,
    hasQuery: query.trim().length > 0,
  };

  return <SearchContext.Provider value={value}>{children}</SearchContext.Provider>;
}

export function useSearch(): SearchContextValue {
  const ctx = useContext(SearchContext);
  if (!ctx) {
    return {
      query: "",
      setQuery: () => {},
      matchedStaff: new Set(),
      matchedTeams: new Set(),
      hasQuery: false,
    };
  }
  return ctx;
}
