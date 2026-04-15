"use client";

import { useMemo, useState } from "react";
import { movementTypeLabel, useStore } from "@/lib/store";
import { formatDate } from "@/lib/utils";
import type { MovementType } from "@/lib/types";

const TYPE_FILTERS: { value: MovementType | "all"; label: string }[] = [
  { value: "all", label: "All" },
  { value: "manager_change", label: "Manager" },
  { value: "team_join", label: "Team join" },
  { value: "team_leave", label: "Team leave" },
  { value: "role_change", label: "Role" },
  { value: "team_create", label: "Team create" },
  { value: "team_delete", label: "Team delete" },
  { value: "team_reparent", label: "Team move" },
  { value: "staff_create", label: "Staff create" },
  { value: "staff_delete", label: "Staff delete" },
  { value: "staff_rename", label: "Rename" },
];

export default function HistoryView() {
  const movements = useStore((s) => s.movements);
  const staff = useStore((s) => s.staff);
  const teams = useStore((s) => s.teams);
  const clearHistory = useStore((s) => s.clearHistory);

  const [filter, setFilter] = useState<MovementType | "all">("all");
  const [query, setQuery] = useState("");

  const filtered = useMemo(() => {
    return movements.filter((m) => {
      if (filter !== "all" && m.type !== filter) return false;
      if (query) {
        const q = query.toLowerCase();
        const sName = m.staffId ? staff[m.staffId]?.name ?? "" : "";
        const tName = m.teamId ? teams[m.teamId]?.name ?? "" : "";
        const blob = [
          sName,
          tName,
          m.fromLabel ?? "",
          m.toLabel ?? "",
          m.note ?? "",
          movementTypeLabel(m.type),
        ]
          .join(" ")
          .toLowerCase();
        if (!blob.includes(q)) return false;
      }
      return true;
    });
  }, [movements, filter, query, staff, teams]);

  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <div>
          <h2 className="text-lg font-semibold">Movement history</h2>
          <p className="text-sm text-slate-500">
            Every reorganisation is recorded here. Filter or search to find the moment a change happened.
          </p>
        </div>
        <button
          className="px-3 py-1.5 text-sm rounded-md border border-red-300 text-red-600 hover:bg-red-50"
          onClick={() => {
            if (confirm("Clear all history? This cannot be undone.")) clearHistory();
          }}
        >
          Clear history
        </button>
      </div>

      <div className="flex flex-wrap gap-2 mb-3">
        <select
          className="text-sm border rounded px-2 py-1"
          value={filter}
          onChange={(e) => setFilter(e.target.value as MovementType | "all")}
        >
          {TYPE_FILTERS.map((t) => (
            <option key={t.value} value={t.value}>
              {t.label}
            </option>
          ))}
        </select>
        <input
          className="text-sm border rounded px-2 py-1 flex-1 min-w-[200px]"
          placeholder="Search by name, team, label..."
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
      </div>

      <div className="bg-white rounded-xl border divide-y">
        {filtered.length === 0 && (
          <div className="text-center text-slate-400 py-12 text-sm">
            No movement events match your filters.
          </div>
        )}
        {filtered.map((m) => {
          const sName = m.staffId ? staff[m.staffId]?.name : null;
          const tName = m.teamId ? teams[m.teamId]?.name : null;
          return (
            <div key={m.id} className="px-4 py-2 text-sm flex items-baseline gap-3">
              <div className="text-xs text-slate-400 w-40 shrink-0">{formatDate(m.timestamp)}</div>
              <div className="text-xs uppercase tracking-wide text-slate-500 w-32 shrink-0">
                {movementTypeLabel(m.type)}
              </div>
              <div className="flex-1">
                {m.note ?? (
                  <>
                    {sName && <span className="font-medium">{sName}</span>}{" "}
                    {tName && (
                      <>
                        — <span className="italic">{tName}</span>
                      </>
                    )}
                    {m.fromLabel || m.toLabel ? (
                      <>
                        {" "}
                        ({m.fromLabel ?? "—"} → {m.toLabel ?? "—"})
                      </>
                    ) : null}
                  </>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
