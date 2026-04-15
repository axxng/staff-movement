"use client";

import { useRef } from "react";
import { useStore } from "@/lib/store";
import type { AppState } from "@/lib/types";

export default function BackupBar() {
  const inputRef = useRef<HTMLInputElement>(null);
  const replaceState = useStore((s) => s.replaceState);
  const resetAll = useStore((s) => s.resetAll);

  const exportJson = () => {
    const state = useStore.getState();
    const data: AppState = {
      version: state.version,
      staff: state.staff,
      teams: state.teams,
      roles: state.roles,
      movements: state.movements,
    };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `staff-movement-${new Date().toISOString().split("T")[0]}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const onPick = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const text = await file.text();
      const data = JSON.parse(text) as AppState;
      if (!data || typeof data !== "object" || !data.staff || !data.teams) {
        alert("Invalid backup file");
        return;
      }
      if (!confirm("Replace current data with this backup?")) return;
      replaceState(data);
    } catch (err) {
      console.error(err);
      alert("Failed to read backup");
    } finally {
      if (inputRef.current) inputRef.current.value = "";
    }
  };

  return (
    <div className="flex gap-2 items-center">
      <button
        className="px-3 py-1.5 text-xs rounded-md border border-slate-300 hover:bg-slate-100"
        onClick={exportJson}
        title="Download a JSON backup of all data"
      >
        Backup JSON
      </button>
      <button
        className="px-3 py-1.5 text-xs rounded-md border border-slate-300 hover:bg-slate-100"
        onClick={() => inputRef.current?.click()}
        title="Restore from a JSON backup"
      >
        Restore
      </button>
      <input
        ref={inputRef}
        type="file"
        accept="application/json"
        className="hidden"
        onChange={onPick}
      />
      <button
        className="px-3 py-1.5 text-xs rounded-md border border-red-300 text-red-600 hover:bg-red-50"
        onClick={() => {
          if (confirm("Wipe all staff, teams, and history?")) resetAll();
        }}
      >
        Reset
      </button>
    </div>
  );
}
