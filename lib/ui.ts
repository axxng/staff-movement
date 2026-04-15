"use client";

import { create } from "zustand";

type UIState = {
  selectedStaffId: string | null;
  selectStaff: (id: string | null) => void;
};

export const useUI = create<UIState>((set) => ({
  selectedStaffId: null,
  selectStaff: (id) => set({ selectedStaffId: id }),
}));
