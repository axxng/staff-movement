"use client";

import { useState, useMemo } from "react";
import { useStore } from "@/lib/store";
import { useUI } from "@/lib/ui";
import { useSearch } from "@/lib/search";
import { contrastText } from "@/lib/utils";
import UserManagement from "@/components/UserManagement";
import type { SessionUser } from "@/lib/types";

export default function Sidebar({ user, open, onClose }: { user: SessionUser; open?: boolean; onClose?: () => void }) {
  const staff = useStore((s) => s.staff);
  const teams = useStore((s) => s.teams);
  const roles = useStore((s) => s.roles);

  const addStaff = useStore((s) => s.addStaff);
  const renameStaff = useStore((s) => s.renameStaff);
  const deleteStaff = useStore((s) => s.deleteStaff);
  const setRole = useStore((s) => s.setRole);

  const addRole = useStore((s) => s.addRole);
  const updateRole = useStore((s) => s.updateRole);
  const deleteRole = useStore((s) => s.deleteRole);

  const addStaffToTeam = useStore((s) => s.addStaffToTeam);
  const removeStaffFromTeam = useStore((s) => s.removeStaffFromTeam);
  const removeTagFromAll = useStore((s) => s.removeTagFromAll);

  const selectStaff = useUI((s) => s.selectStaff);
  const { setQuery } = useSearch();

  const [name, setName] = useState("");
  const [newTag, setNewTag] = useState("");
  const roleList = Object.values(roles);
  const [roleId, setRoleId] = useState<string>(roleList[0]?.id ?? "");

  const tagCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const s of Object.values(staff)) {
      for (const t of s.tags ?? []) {
        counts[t] = (counts[t] ?? 0) + 1;
      }
    }
    return Object.entries(counts).sort(([a], [b]) => a.localeCompare(b));
  }, [staff]);

  const sections = user.role === "admin"
    ? (["staff", "roles", "membership", "tags", "users"] as const)
    : (["staff", "roles", "membership", "tags"] as const);
  type Section = (typeof sections)[number];
  const [openSection, setOpenSection] = useState<Section>("staff");

  return (
    <>
      {/* Mobile backdrop */}
      {open && (
        <div
          className="fixed inset-0 bg-black/30 z-40 lg:hidden"
          onClick={onClose}
        />
      )}
      <aside className={`w-72 shrink-0 border-r border-slate-200 bg-white h-screen overflow-y-auto
        fixed lg:static z-50 transition-transform duration-200
        ${open ? "translate-x-0" : "-translate-x-full lg:translate-x-0"}`}>
        <div className="p-4 border-b flex items-center justify-between">
          <div>
            <h1 className="text-base font-bold">Staff Movement</h1>
            <p className="text-[11px] text-slate-500">Org chart & squad tracker</p>
          </div>
          <button
            className="lg:hidden text-slate-400 hover:text-slate-600 text-xl"
            onClick={onClose}
          >
            ×
          </button>
        </div>

      <nav className="flex border-b text-xs">
        {sections.map((k) => (
          <button
            key={k}
            className={`flex-1 px-2 py-2 capitalize ${
              openSection === k
                ? "border-b-2 border-slate-900 font-semibold"
                : "text-slate-500"
            }`}
            onClick={() => setOpenSection(k)}
          >
            {k}
          </button>
        ))}
      </nav>

      {openSection === "staff" && (
        <div className="p-4 space-y-3">
          <div className="space-y-2">
            <input
              className="w-full text-sm border rounded px-2 py-1"
              placeholder="Add staff name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && name.trim()) {
                  addStaff({ name: name.trim(), roleId });
                  setName("");
                }
              }}
            />
            <div className="flex gap-2">
              <select
                className="text-sm border rounded px-2 py-1 flex-1"
                value={roleId}
                onChange={(e) => setRoleId(e.target.value)}
              >
                {roleList.map((r) => (
                  <option key={r.id} value={r.id}>
                    {r.label}
                  </option>
                ))}
              </select>
              <button
                className="text-sm bg-slate-900 text-white rounded px-3 py-1"
                onClick={() => {
                  if (name.trim()) {
                    addStaff({ name: name.trim(), roleId });
                    setName("");
                  }
                }}
              >
                Add
              </button>
            </div>
          </div>

          <div className="border-t pt-2 space-y-1 max-h-[60vh] overflow-y-auto">
            {Object.values(staff).length === 0 && (
              <div className="text-xs text-slate-400">No staff yet.</div>
            )}
            {Object.values(staff)
              .sort((a, b) => a.name.localeCompare(b.name))
              .map((s) => {
                const r = roles[s.roleId];
                return (
                  <div key={s.id} className="flex items-center gap-1 text-xs">
                    <button
                      className="w-2 h-2 rounded-full shrink-0"
                      style={{ backgroundColor: r?.color ?? "#999" }}
                      onClick={() => selectStaff(s.id)}
                      title="Open details"
                    />
                    <input
                      className="flex-1 px-1 py-0.5 rounded hover:bg-slate-100 cursor-text min-w-0"
                      defaultValue={s.name}
                      onBlur={(e) => {
                        const v = e.target.value.trim();
                        if (v && v !== s.name) renameStaff(s.id, v);
                      }}
                      onDoubleClick={() => selectStaff(s.id)}
                      title="Double-click to open details"
                    />
                    <select
                      className="text-[10px] border rounded px-0.5"
                      value={s.roleId}
                      onChange={(e) => setRole(s.id, e.target.value)}
                    >
                      {roleList.map((rr) => (
                        <option key={rr.id} value={rr.id}>
                          {rr.label}
                        </option>
                      ))}
                    </select>
                    <button
                      className="text-red-500 hover:bg-red-50 px-1 rounded"
                      onClick={() => {
                        if (confirm(`Delete ${s.name}?`)) deleteStaff(s.id);
                      }}
                    >
                      ×
                    </button>
                  </div>
                );
              })}
          </div>
        </div>
      )}

      {openSection === "roles" && (
        <div className="p-4 space-y-2">
          {roleList.map((r) => (
            <div key={r.id} className="flex items-center gap-1">
              <input
                type="color"
                value={r.color}
                onChange={(e) => updateRole(r.id, { color: e.target.value })}
                className="w-6 h-6 border rounded"
              />
              <input
                className="flex-1 text-xs border rounded px-1 py-0.5"
                defaultValue={r.label}
                onBlur={(e) => {
                  const v = e.target.value.trim();
                  if (v && v !== r.label) updateRole(r.id, { label: v });
                }}
              />
              <span
                className="text-[10px] px-1.5 py-0.5 rounded"
                style={{ backgroundColor: r.color, color: contrastText(r.color) }}
              >
                aA
              </span>
              <button
                className="text-red-500 hover:bg-red-50 px-1 rounded text-xs"
                onClick={() => {
                  if (confirm(`Delete role "${r.label}"? Staff using it will be reassigned.`)) {
                    deleteRole(r.id);
                  }
                }}
              >
                ×
              </button>
            </div>
          ))}
          <button
            className="text-xs px-2 py-1 mt-2 rounded border border-dashed border-slate-300 w-full hover:bg-slate-50"
            onClick={() => {
              const label = prompt("Role name?");
              if (label?.trim()) addRole(label.trim(), "#64748b");
            }}
          >
            + Add role
          </button>
        </div>
      )}

      {openSection === "membership" && (
        <div className="p-4 space-y-3 text-xs">
          <p className="text-slate-500">
            Quick way to assign staff to multiple teams without dragging.
          </p>
          {Object.values(staff)
            .sort((a, b) => a.name.localeCompare(b.name))
            .map((s) => {
              const memberOf = Object.values(teams).filter((t) => t.memberIds.includes(s.id));
              return (
                <div key={s.id} className="border rounded p-2">
                  <div className="font-semibold mb-1">{s.name}</div>
                  <div className="flex flex-wrap gap-1 mb-1">
                    {memberOf.length === 0 && (
                      <span className="text-slate-400 italic">No teams</span>
                    )}
                    {memberOf.map((t) => (
                      <button
                        key={t.id}
                        className="px-1.5 py-0.5 rounded bg-slate-200 hover:bg-red-100"
                        onClick={() => removeStaffFromTeam(s.id, t.id)}
                        title="Remove"
                      >
                        {t.name} ×
                      </button>
                    ))}
                  </div>
                  <select
                    className="w-full text-[11px] border rounded px-1 py-0.5"
                    value=""
                    onChange={(e) => {
                      if (e.target.value) {
                        addStaffToTeam(s.id, e.target.value);
                      }
                    }}
                  >
                    <option value="">+ Add to team…</option>
                    {Object.values(teams)
                      .filter((t) => !t.memberIds.includes(s.id))
                      .map((t) => (
                        <option key={t.id} value={t.id}>
                          {t.name}
                        </option>
                      ))}
                  </select>
                </div>
              );
            })}
          {Object.values(staff).length === 0 && (
            <div className="text-slate-400">Add staff first.</div>
          )}
        </div>
      )}
      {openSection === "tags" && (
        <div className="p-4 space-y-3 text-xs">
          <p className="text-slate-400">
            Tags are created by adding them to staff in their detail drawer.
            Click a tag to search.
          </p>

          <div className="border-t pt-2 space-y-1 max-h-[60vh] overflow-y-auto">
            {tagCounts.length === 0 && (
              <div className="text-slate-400">No tags yet.</div>
            )}
            {tagCounts.map(([tag, count]) => (
              <div key={tag} className="flex items-center justify-between gap-1">
                <button
                  className="flex-1 text-left px-1 py-0.5 rounded hover:bg-slate-100 truncate"
                  onClick={() => setQuery(tag)}
                  title={`Search for "${tag}"`}
                >
                  <span className="font-medium">{tag}</span>
                  <span className="text-slate-400 ml-1">({count})</span>
                </button>
                <button
                  className="text-red-500 hover:bg-red-50 px-1 rounded"
                  onClick={() => {
                    if (confirm(`Remove tag "${tag}" from all ${count} staff?`))
                      removeTagFromAll(tag);
                  }}
                >
                  ×
                </button>
              </div>
            ))}
          </div>
        </div>
      )}
      {openSection === "users" && (
        <UserManagement currentUser={user.username} />
      )}
    </aside>
    </>
  );
}
