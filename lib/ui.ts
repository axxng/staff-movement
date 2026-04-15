"use client";

import { create } from "zustand";

type UIState = {
  selectedStaffId: string | null;
  selectStaff: (id: string | null) => void;
  multiSelected: Set<string>;
  toggleMultiSelect: (id: string) => void;
  addToMultiSelect: (id: string) => void;
  clearMultiSelect: () => void;
};

export const useUI = create<UIState>((set, get) => ({
  selectedStaffId: null,
  selectStaff: (id) => set({ selectedStaffId: id }),
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
