"use client";

import { useCallback, useMemo, useState } from "react";
import {
  DndContext,
  DragEndEvent,
  PointerSensor,
  useDroppable,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import { useStore } from "@/lib/store";
import { useUI } from "@/lib/ui";
import { useReadOnly } from "@/lib/readonly";
import { useSearch } from "@/lib/search";
import StaffBox from "./StaffBox";
import { buildForest, sortMembersByRoleThenName, type Tree } from "@/lib/squad-utils";
import type { TeamId } from "@/lib/types";

function DroppableTeamNode({
  teamId,
  children,
}: {
  teamId: string;
  children: React.ReactNode;
}) {
  const { setNodeRef, isOver } = useDroppable({
    id: `tree-team-drop-${teamId}`,
    data: { kind: "team", teamId },
  });
  return (
    <div
      ref={setNodeRef}
      className={`rounded-xl border bg-slate-50 p-3 min-w-[200px] inline-block text-left ${
        isOver ? "border-blue-500 bg-blue-50" : "border-slate-200"
      }`}
    >
      {children}
    </div>
  );
}

function UnassignedZone() {
  const { setNodeRef, isOver } = useDroppable({
    id: "tree-unassigned-drop",
    data: { kind: "unassigned" },
  });
  const staff = useStore((s) => s.staff);
  const teams = useStore((s) => s.teams);

  const inAnyTeam = useMemo(() => {
    const set = new Set<string>();
    for (const t of Object.values(teams)) for (const m of t.memberIds) set.add(m);
    return set;
  }, [teams]);
  const unassigned = Object.values(staff).filter((s) => !inAnyTeam.has(s.id));

  return (
    <div
      ref={setNodeRef}
      className={`rounded-xl border-2 border-dashed p-3 ${
        isOver ? "border-blue-500 bg-blue-50" : "border-slate-300 bg-white"
      }`}
    >
      <div className="text-xs uppercase tracking-wide text-slate-500 mb-2">
        Unassigned ({unassigned.length})
      </div>
      <div className="flex flex-wrap gap-1.5 min-h-[36px]">
        {unassigned.length === 0 && (
          <div className="text-xs text-slate-400 italic">Everyone is on a squad</div>
        )}
        {unassigned.map((s) => (
          <StaffBox
            key={s.id}
            staffId={s.id}
            dragId={`tree-unassigned-${s.id}`}
            payload={{ fromTeamId: null }}
            compact
          />
        ))}
      </div>
    </div>
  );
}

function TeamTreeNode({
  team,
  collapsedTeams,
  onToggleCollapse,
}: {
  team: Tree;
  collapsedTeams: Set<TeamId>;
  onToggleCollapse: (id: TeamId) => void;
}) {
  const allStaff = useStore((s) => s.staff);
  const allRoles = useStore((s) => s.roles);
  const readOnly = useReadOnly();
  const { hasQuery, matchedTeams } = useSearch();
  const renameTeam = useStore((s) => s.renameTeam);
  const deleteTeam = useStore((s) => s.deleteTeam);
  const addTeam = useStore((s) => s.addTeam);
  const removeStaffFromTeam = useStore((s) => s.removeStaffFromTeam);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(team.name);

  const collapsed = collapsedTeams.has(team.id);
  const dimmed = hasQuery && !matchedTeams.has(team.id);
  const sortedMembers = sortMembersByRoleThenName(team.memberIds, allStaff, allRoles);

  return (
    <li>
      <div className="squad-node-wrap">
        <DroppableTeamNode teamId={team.id}>
          <div className={`transition-opacity ${dimmed ? "opacity-40" : ""}`}>
            {/* Header */}
            <div className="flex items-center gap-1 mb-1">
              {team.children.length > 0 && (
                <button
                  className="text-slate-400 hover:text-slate-600 px-0.5 text-xs"
                  onClick={() => onToggleCollapse(team.id)}
                  aria-expanded={!collapsed}
                  title={collapsed ? "Expand sub-teams" : "Collapse sub-teams"}
                >
                  {collapsed ? "▶" : "▼"}
                </button>
              )}
              {!readOnly && editing ? (
                <input
                  value={draft}
                  onChange={(e) => setDraft(e.target.value)}
                  onBlur={() => {
                    renameTeam(team.id, draft.trim() || team.name);
                    setEditing(false);
                  }}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      renameTeam(team.id, draft.trim() || team.name);
                      setEditing(false);
                    }
                    if (e.key === "Escape") {
                      setDraft(team.name);
                      setEditing(false);
                    }
                  }}
                  autoFocus
                  className="text-sm font-semibold flex-1 px-1 border rounded"
                />
              ) : (
                <span
                  className="text-sm font-semibold truncate"
                  onDoubleClick={readOnly ? undefined : () => setEditing(true)}
                  title={readOnly ? undefined : "Double-click to rename"}
                >
                  {team.name} ({team.memberIds.length})
                </span>
              )}
              {!readOnly && (
                <button
                  className="text-xs px-1 py-0.5 rounded hover:bg-slate-200 ml-auto"
                  onClick={() => {
                    const name = prompt("Sub-team name?");
                    if (name?.trim()) addTeam({ name: name.trim(), parentId: team.id });
                  }}
                  title="Add sub-team"
                >
                  +sub
                </button>
              )}
              {!readOnly && (
                <button
                  className="text-xs px-1 py-0.5 rounded hover:bg-red-100 text-red-600"
                  onClick={() => {
                    if (confirm(`Delete team "${team.name}"? Sub-teams will reattach to its parent.`)) {
                      deleteTeam(team.id);
                    }
                  }}
                  title="Delete team"
                >
                  ×
                </button>
              )}
              {collapsed && team.children.length > 0 && (
                <span className="text-xs text-slate-400 ml-1">+{team.children.length} sub</span>
              )}
            </div>

            {/* Members */}
            <div className="flex flex-wrap gap-1.5 min-h-[28px]">
              {team.memberIds.length === 0 && (
                <div className="text-xs text-slate-400 italic">Drop staff here</div>
              )}
              {sortedMembers.map((sid) => (
                <div key={sid} className="relative group">
                  <StaffBox
                    staffId={sid}
                    dragId={`tree-squad-${team.id}-${sid}`}
                    payload={{ fromTeamId: team.id }}
                    compact
                  />
                  {!readOnly && (
                    <button
                      className="hidden group-hover:flex absolute -top-1 -right-1 w-4 h-4 rounded-full bg-red-500 text-white text-[10px] items-center justify-center"
                      onClick={(e) => {
                        e.stopPropagation();
                        if (confirm(`Remove from ${team.name}?`)) removeStaffFromTeam(sid, team.id);
                      }}
                      title="Remove from team"
                    >
                      ×
                    </button>
                  )}
                </div>
              ))}
            </div>
          </div>
        </DroppableTeamNode>
      </div>

      {/* Render children if not collapsed */}
      {!collapsed && team.children.length > 0 && (
        <ul>
          {team.children.map((child) => (
            <TeamTreeNode
              key={child.id}
              team={child}
              collapsedTeams={collapsedTeams}
              onToggleCollapse={onToggleCollapse}
            />
          ))}
        </ul>
      )}
    </li>
  );
}

export default function SquadsTreeView() {
  const teams = useStore((s) => s.teams);
  const addStaffToTeam = useStore((s) => s.addStaffToTeam);
  const removeStaffFromTeam = useStore((s) => s.removeStaffFromTeam);
  const moveStaffBetweenTeams = useStore((s) => s.moveStaffBetweenTeams);

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 4 } }));
  const forest = useMemo(() => buildForest(teams), [teams]);

  const [collapsedTeams, setCollapsedTeams] = useState<Set<TeamId>>(new Set());

  const toggleCollapse = useCallback((id: TeamId) => {
    setCollapsedTeams((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const findFromTeam = (staffId: string): string | null => {
    for (const t of Object.values(teams)) {
      if (t.memberIds.includes(staffId)) return t.id;
    }
    return null;
  };

  const onDragEnd = (e: DragEndEvent) => {
    const { active, over } = e;
    if (!over) return;

    const activeData = active.data.current as Record<string, unknown> | undefined;
    const overData = over.data.current as Record<string, unknown> | undefined;

    // Staff drag
    const ad = activeData as { staffId?: string; fromTeamId?: string | null } | undefined;
    const draggedId = ad?.staffId;
    if (!draggedId) return;

    const { multiSelected, clearMultiSelect } = useUI.getState();
    const staffIds = multiSelected.size > 0 && multiSelected.has(draggedId)
      ? Array.from(multiSelected)
      : [draggedId];

    for (const staffId of staffIds) {
      if (overData?.kind === "team" && overData.teamId) {
        const fromTeamId = staffId === draggedId
          ? (ad?.fromTeamId ?? null)
          : findFromTeam(staffId);
        if (fromTeamId == null) {
          addStaffToTeam(staffId, overData.teamId as string);
        } else {
          moveStaffBetweenTeams(staffId, fromTeamId, overData.teamId as string);
        }
      } else if (overData?.kind === "unassigned") {
        const fromTeamId = staffId === draggedId
          ? (ad?.fromTeamId ?? null)
          : findFromTeam(staffId);
        if (fromTeamId) removeStaffFromTeam(staffId, fromTeamId);
      }
    }

    clearMultiSelect();
  };

  return (
    <DndContext sensors={sensors} onDragEnd={onDragEnd}>
      <div className="space-y-3">
        <UnassignedZone />
        {forest.length === 0 ? (
          <div className="text-slate-400 text-center py-12">
            No teams yet — click <strong>+ Team</strong> to create one.
          </div>
        ) : (
          forest.map((root) => (
            <div
              key={root.id}
              className="bg-white rounded-xl border border-slate-200 p-4 sm:p-6 overflow-x-auto"
            >
              <div className="min-w-fit w-full flex justify-center">
                <ul className="squad-tree inline-flex gap-3">
                  <TeamTreeNode
                    team={root}
                    collapsedTeams={collapsedTeams}
                    onToggleCollapse={toggleCollapse}
                  />
                </ul>
              </div>
            </div>
          ))
        )}
      </div>
    </DndContext>
  );
}
