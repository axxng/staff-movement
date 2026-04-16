"use client";

import { useEffect, useMemo, useState } from "react";
import { movementTypeLabel, useStore } from "@/lib/store";
import { useUI } from "@/lib/ui";
import { contrastText, formatDate } from "@/lib/utils";
import { useReadOnly } from "@/lib/readonly";

export default function StaffDetailDrawer() {
  const selectedStaffId = useUI((s) => s.selectedStaffId);
  const selectStaff = useUI((s) => s.selectStaff);
  const readOnly = useReadOnly();

  const staff = useStore((s) =>
    selectedStaffId ? s.staff[selectedStaffId] ?? null : null,
  );
  const role = useStore((s) =>
    staff ? s.roles[staff.roleId] ?? null : null,
  );
  const allStaff = useStore((s) => s.staff);
  const allTeams = useStore((s) => s.teams);
  const allRoles = useStore((s) => s.roles);
  const movements = useStore((s) => s.movements);

  const setManager = useStore((s) => s.setManager);
  const setRole = useStore((s) => s.setRole);
  const renameStaff = useStore((s) => s.renameStaff);
  const deleteStaff = useStore((s) => s.deleteStaff);
  const removeStaffFromTeam = useStore((s) => s.removeStaffFromTeam);
  const addStaffToTeam = useStore((s) => s.addStaffToTeam);
  const addTag = useStore((s) => s.addTag);
  const removeTag = useStore((s) => s.removeTag);
  const allTags = useStore((s) => {
    const set = new Set<string>();
    for (const st of Object.values(s.staff)) {
      for (const t of st.tags ?? []) set.add(t);
    }
    return Array.from(set).sort();
  });

  const [tagInput, setTagInput] = useState("");
  const [showTagSuggestions, setShowTagSuggestions] = useState(false);

  // Esc to close
  useEffect(() => {
    if (!selectedStaffId) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") selectStaff(null);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [selectedStaffId, selectStaff]);

  useEffect(() => {
    setTagInput("");
    setShowTagSuggestions(false);
  }, [selectedStaffId]);

  const directReports = useMemo(() => {
    if (!staff) return [];
    return Object.values(allStaff)
      .filter((s) => s.managerId === staff.id)
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [allStaff, staff]);

  const teamsOfStaff = useMemo(() => {
    if (!staff) return [];
    return Object.values(allTeams).filter((t) => t.memberIds.includes(staff.id));
  }, [allTeams, staff]);

  const teamPath = (teamId: string): string => {
    const parts: string[] = [];
    const visited = new Set<string>();
    let cur: string | null = teamId;
    while (cur !== null && !visited.has(cur)) {
      visited.add(cur);
      const t: typeof allTeams[string] | undefined = allTeams[cur];
      if (!t) break;
      parts.unshift(t.name);
      cur = t.parentId;
    }
    return parts.join(" / ");
  };

  const filteredMovements = useMemo(() => {
    if (!staff) return [];
    return movements.filter((m) => m.staffId === staff.id);
  }, [movements, staff]);

  if (!selectedStaffId) return null;

  if (!staff) {
    // Selected ID points at a deleted staff member — close.
    return null;
  }

  const bg = role?.color ?? "#64748b";
  const fg = contrastText(bg);
  const manager = staff.managerId ? allStaff[staff.managerId] ?? null : null;
  const roleList = Object.values(allRoles);

  return (
    <div className="fixed inset-0 z-40 flex justify-end" role="dialog">
      <button
        aria-label="Close"
        className="flex-1 bg-black/30"
        onClick={() => selectStaff(null)}
      />
      <aside className="w-full sm:w-[420px] sm:max-w-full h-full bg-white shadow-2xl flex flex-col">
        <header
          className="px-5 py-4 flex items-start justify-between gap-3"
          style={{ backgroundColor: bg, color: fg }}
        >
          <div className="min-w-0">
            {readOnly ? (
              <div className="text-lg font-semibold px-1" style={{ color: fg }}>
                {staff.name}
              </div>
            ) : (
              <input
                className="text-lg font-semibold bg-transparent w-full focus:outline-none focus:bg-black/10 rounded px-1"
                defaultValue={staff.name}
                onBlur={(e) => {
                  const v = e.target.value.trim();
                  if (v && v !== staff.name) renameStaff(staff.id, v);
                }}
                style={{ color: fg }}
              />
            )}
            <div className="text-xs opacity-90 px-1">{role?.label ?? "—"}</div>
          </div>
          <button
            className="text-2xl leading-none px-2 hover:bg-black/10 rounded"
            onClick={() => selectStaff(null)}
            title="Close (Esc)"
            style={{ color: fg }}
          >
            ×
          </button>
        </header>

        <div className="flex-1 overflow-y-auto p-5 space-y-5 text-sm">
          {/* Role + manager controls */}
          <section className="space-y-2">
            <div className="text-xs uppercase tracking-wide text-slate-500">
              Role
            </div>
            <select
              className="w-full border rounded px-2 py-1 text-sm"
              value={staff.roleId}
              onChange={(e) => setRole(staff.id, e.target.value)}
              disabled={readOnly}
            >
              {roleList.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.label}
                </option>
              ))}
            </select>
          </section>

          <section className="space-y-2">
            <div className="text-xs uppercase tracking-wide text-slate-500">
              Reports to
            </div>
            <select
              className="w-full border rounded px-2 py-1 text-sm"
              value={staff.managerId ?? ""}
              onChange={(e) =>
                setManager(staff.id, e.target.value || null)
              }
              disabled={readOnly}
            >
              <option value="">— No manager —</option>
              {Object.values(allStaff)
                .filter((s) => s.id !== staff.id)
                .sort((a, b) => a.name.localeCompare(b.name))
                .map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
            </select>
            {manager && (
              <button
                className="text-xs text-blue-600 hover:underline"
                onClick={() => selectStaff(manager.id)}
              >
                → Open {manager.name}
              </button>
            )}
          </section>

          {/* Direct reports */}
          <section className="space-y-2">
            <div className="text-xs uppercase tracking-wide text-slate-500">
              Direct reports ({directReports.length})
            </div>
            {directReports.length === 0 ? (
              <div className="text-xs text-slate-400 italic">None</div>
            ) : (
              <ul className="space-y-0.5">
                {directReports.map((r) => {
                  const rRole = allRoles[r.roleId];
                  return (
                    <li key={r.id}>
                      <button
                        className="text-left w-full px-2 py-1 rounded hover:bg-slate-100 flex items-center gap-2"
                        onClick={() => selectStaff(r.id)}
                      >
                        <span
                          className="w-2 h-2 rounded-full"
                          style={{ backgroundColor: rRole?.color ?? "#999" }}
                        />
                        <span className="flex-1">{r.name}</span>
                        <span className="text-[10px] text-slate-400">
                          {rRole?.label}
                        </span>
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
          </section>

          {/* Teams */}
          <section className="space-y-2">
            <div className="text-xs uppercase tracking-wide text-slate-500">
              Teams ({teamsOfStaff.length})
            </div>
            {teamsOfStaff.length === 0 ? (
              <div className="text-xs text-slate-400 italic">None</div>
            ) : (
              <ul className="space-y-0.5">
                {teamsOfStaff.map((t) => (
                  <li
                    key={t.id}
                    className="flex items-center gap-2 px-2 py-1 rounded hover:bg-slate-100"
                  >
                    <span className="flex-1 text-sm">{teamPath(t.id)}</span>
                    {!readOnly && (
                      <button
                        className="text-[10px] text-red-500 hover:bg-red-50 px-1 rounded"
                        onClick={() => {
                          if (confirm(`Remove ${staff.name} from this team?`)) removeStaffFromTeam(staff.id, t.id);
                        }}
                        title="Remove from team"
                      >
                        Remove
                      </button>
                    )}
                  </li>
                ))}
              </ul>
            )}
            {!readOnly && (
              <select
                className="w-full text-xs border rounded px-2 py-1"
                value=""
                onChange={(e) => {
                  if (e.target.value) addStaffToTeam(staff.id, e.target.value);
                }}
              >
                <option value="">+ Add to team…</option>
                {Object.values(allTeams)
                  .filter((t) => !t.memberIds.includes(staff.id))
                  .map((t) => (
                    <option key={t.id} value={t.id}>
                      {teamPath(t.id)}
                    </option>
                  ))}
              </select>
            )}
          </section>

          {/* Tags */}
          <section>
            <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1">
              Tags
            </h3>
            <div className="flex flex-wrap gap-1 mb-2">
              {(staff.tags ?? []).length === 0 && (
                <span className="text-xs text-slate-400 italic">None</span>
              )}
              {(staff.tags ?? []).map((tag) => (
                <span
                  key={tag}
                  className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded bg-slate-200 text-xs"
                >
                  {tag}
                  {!readOnly && (
                    <button
                      className="text-slate-400 hover:text-red-500"
                      onClick={() => removeTag(staff.id, tag)}
                    >
                      ×
                    </button>
                  )}
                </span>
              ))}
            </div>
            {!readOnly && (
              <div className="relative">
                <input
                  className="w-full text-xs border rounded px-2 py-1"
                  placeholder="Add tag..."
                  value={tagInput}
                  onChange={(e) => {
                    setTagInput(e.target.value);
                    setShowTagSuggestions(true);
                  }}
                  onFocus={() => setShowTagSuggestions(true)}
                  onBlur={() => setTimeout(() => setShowTagSuggestions(false), 150)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && tagInput.trim()) {
                      addTag(staff.id, tagInput);
                      setTagInput("");
                      setShowTagSuggestions(false);
                    }
                  }}
                />
                {showTagSuggestions && tagInput.trim() && (
                  <div className="absolute z-10 w-full mt-1 bg-white border rounded shadow-lg max-h-32 overflow-y-auto">
                    {allTags
                      .filter(
                        (t) =>
                          t.includes(tagInput.trim().toLowerCase()) &&
                          !(staff.tags ?? []).includes(t),
                      )
                      .map((t) => (
                        <button
                          key={t}
                          className="block w-full text-left text-xs px-2 py-1 hover:bg-slate-100"
                          onMouseDown={(e) => {
                            e.preventDefault();
                            addTag(staff.id, t);
                            setTagInput("");
                            setShowTagSuggestions(false);
                          }}
                        >
                          {t}
                        </button>
                      ))}
                  </div>
                )}
              </div>
            )}
          </section>

          {/* History */}
          <section className="space-y-2">
            <div className="text-xs uppercase tracking-wide text-slate-500">
              History ({filteredMovements.length})
            </div>
            {filteredMovements.length === 0 ? (
              <div className="text-xs text-slate-400 italic">
                No recorded events yet.
              </div>
            ) : (
              <ol className="space-y-2">
                {filteredMovements.map((m) => {
                  const teamName = m.teamId
                    ? allTeams[m.teamId]?.name ?? null
                    : null;
                  return (
                    <li
                      key={m.id}
                      className="border-l-2 border-slate-200 pl-3 py-1"
                    >
                      <div className="text-[10px] uppercase tracking-wide text-slate-400">
                        {movementTypeLabel(m.type)} ·{" "}
                        {formatDate(m.timestamp)}
                      </div>
                      <div className="text-sm">
                        {m.note ?? (
                          <>
                            {teamName && (
                              <span className="italic">{teamName}</span>
                            )}
                            {(m.fromLabel || m.toLabel) && (
                              <>
                                {" "}
                                {m.fromLabel ?? "—"} → {m.toLabel ?? "—"}
                              </>
                            )}
                          </>
                        )}
                        {m.actor && (
                          <span className="text-slate-400 ml-1">by {m.actor}</span>
                        )}
                      </div>
                    </li>
                  );
                })}
              </ol>
            )}
          </section>
        </div>

        <footer className="border-t px-5 py-3 flex justify-between items-center">
          {!readOnly ? (
            <button
              className="text-xs text-red-600 hover:bg-red-50 px-2 py-1 rounded"
              onClick={() => {
                if (confirm(`Delete ${staff.name}? This cannot be undone via UI.`)) {
                  deleteStaff(staff.id);
                  selectStaff(null);
                }
              }}
            >
              Delete staff
            </button>
          ) : <div />}
          <button
            className="text-xs text-slate-500 hover:text-slate-900"
            onClick={() => selectStaff(null)}
          >
            Close
          </button>
        </footer>
      </aside>
    </div>
  );
}
