"use client";

import { create } from "zustand";

type UIState = {
  selectedStaffId: string | null;
  selectStaff: (id: string | null) => void;
  multiSelected: Set<string>;
  toggleMultiSelect: (id: string) => void;
  addToMultiSelect: (id: string) => void;
  clearMultiSelect: () => void;
  /** Team box to briefly highlight (e.g. after jumping to it from the TOC). */
  flashTeamId: string | null;
  flashTeam: (id: string) => void;
};

export const useUI = create<UIState>((set, get) => ({
  selectedStaffId: null,
  selectStaff: (id) => set({ selectedStaffId: id }),
  flashTeamId: null,
  flashTeam: (id) => {
    set({ flashTeamId: id });
    setTimeout(() => {
      if (get().flashTeamId === id) set({ flashTeamId: null });
    }, 1400);
  },
  multiSelected: new Set(),
  toggleMultiSelect: (id) => {
    const next = new Set(get().multiSelected);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    set({ multiSelected: next });
  },
  addToMultiSelect: (id) => {
    const next = new Set(get().multiSelected);
    next.add(id);
    set({ multiSelected: next });
  },
  clearMultiSelect: () => set({ multiSelected: new Set() }),
}));
