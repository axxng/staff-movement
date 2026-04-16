"use client";

import { useMemo, useRef, useState } from "react";
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
import { useSearch } from "@/lib/search";
import StaffBox from "./StaffBox";
import ExportButton from "./ExportButton";
import type { Team, TeamId, Staff, Role } from "@/lib/types";

type Tree = Team & { children: Tree[] };

function sortMembersByRoleThenName(
  memberIds: string[],
  staff: Record<string, Staff>,
  roles: Record<string, Role>,
): string[] {
  const roleOrder = Object.keys(roles);
  return [...memberIds].sort((a, b) => {
    const sa = staff[a];
    const sb = staff[b];
    if (!sa || !sb) return 0;
    const ra = roleOrder.indexOf(sa.roleId);
    const rb = roleOrder.indexOf(sb.roleId);
    if (ra !== rb) return (ra === -1 ? 999 : ra) - (rb === -1 ? 999 : rb);
    return sa.name.localeCompare(sb.name);
  });
}

function buildForest(teams: Record<TeamId, Team>): Tree[] {
  const childrenOf: Record<string, TeamId[]> = {};
  for (const t of Object.values(teams)) {
    const key = t.parentId ?? "__root__";
    (childrenOf[key] ??= []).push(t.id);
  }
  const build = (id: TeamId): Tree => ({
    ...teams[id],
    children: (childrenOf[id] ?? []).map(build),
  });
  return (childrenOf["__root__"] ?? []).map(build);
}

function TeamBox({ team }: { team: Tree }) {
  const removeStaffFromTeam = useStore((s) => s.removeStaffFromTeam);
  const allStaff = useStore((s) => s.staff);
  const allRoles = useStore((s) => s.roles);
  const renameTeam = useStore((s) => s.renameTeam);
  const deleteTeam = useStore((s) => s.deleteTeam);
  const addTeam = useStore((s) => s.addTeam);
  const { hasQuery, matchedTeams } = useSearch();
  const exportRef = useRef<HTMLDivElement>(null);

  const setDroppable = useDroppable({
    id: `team-drop-${team.id}`,
    data: { kind: "team", teamId: team.id },
  });
  const isOver = setDroppable.isOver;

  const setRefs = (el: HTMLDivElement | null) => {
    setDroppable.setNodeRef(el);
    (exportRef as React.MutableRefObject<HTMLDivElement | null>).current = el;
  };

  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(team.name);
  const dimmed = hasQuery && !matchedTeams.has(team.id);

  return (
    <div
      ref={setRefs}
      className={`rounded-xl border bg-slate-50 p-3 min-w-[220px] transition-opacity ${
        isOver ? "border-blue-500 bg-blue-50" : "border-slate-200"
      } ${dimmed ? "opacity-40" : ""}`}
    >
      <div className="flex items-center gap-1 mb-2">
        {editing ? (
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
          <button
            className="text-sm font-semibold flex-1 text-left truncate"
            onDoubleClick={() => setEditing(true)}
            title="Double-click to rename"
          >
            {team.name} ({team.memberIds.length})
          </button>
        )}
        <ExportButton
          targetRef={exportRef}
          filename={`team-${team.name}`}
          compact
          label="PNG"
          title="Export this team subtree as PNG"
        />
        <button
          className="text-xs px-1.5 py-0.5 rounded hover:bg-slate-200"
          onClick={() => {
            const name = prompt("Sub-team name?");
            if (name?.trim()) addTeam({ name: name.trim(), parentId: team.id });
          }}
          title="Add sub-team"
        >
          +sub
        </button>
        <button
          className="text-xs px-1.5 py-0.5 rounded hover:bg-red-100 text-red-600"
          onClick={() => {
            if (confirm(`Delete team "${team.name}"? Sub-teams will reattach to its parent.`)) {
              deleteTeam(team.id);
            }
          }}
          title="Delete team"
        >
          ×
        </button>
      </div>

      <div className="flex flex-wrap gap-1.5 min-h-[36px]">
        {team.memberIds.length === 0 && (
          <div className="text-xs text-slate-400 italic">Drop staff here</div>
        )}
        {sortMembersByRoleThenName(team.memberIds, allStaff, allRoles).map((sid) => (
          <div key={sid} className="relative group">
            <StaffBox
              staffId={sid}
              dragId={`squad-${team.id}-${sid}`}
              payload={{ fromTeamId: team.id }}
              compact
            />
            <button
              className="hidden group-hover:flex absolute -top-1 -right-1 w-4 h-4 rounded-full bg-red-500 text-white text-[10px] items-center justify-center"
              onClick={(e) => {
                e.stopPropagation();
                removeStaffFromTeam(sid, team.id);
              }}
              title="Remove from team"
            >
              ×
            </button>
          </div>
        ))}
      </div>

      {team.children.length > 0 && (
        <div className="mt-3 pl-3 border-l-2 border-slate-200 space-y-2">
          {team.children.map((c) => (
            <TeamBox key={c.id} team={c} />
          ))}
        </div>
      )}
    </div>
  );
}

function UnassignedZone() {
  const { setNodeRef, isOver } = useDroppable({
    id: "unassigned-drop",
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
            dragId={`unassigned-${s.id}`}
            payload={{ fromTeamId: null }}
            compact
          />
        ))}
      </div>
    </div>
  );
}

export default function SquadsView() {
  const teams = useStore((s) => s.teams);
  const addTeam = useStore((s) => s.addTeam);
  const addStaffToTeam = useStore((s) => s.addStaffToTeam);
  const removeStaffFromTeam = useStore((s) => s.removeStaffFromTeam);
  const moveStaffBetweenTeams = useStore((s) => s.moveStaffBetweenTeams);
  const exportRef = useRef<HTMLDivElement>(null);

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 4 } }));

  const forest = useMemo(() => buildForest(teams), [teams]);

  const onDragEnd = (e: DragEndEvent) => {
    const { active, over } = e;
    if (!over) return;
    const data = over.data.current as
      | { kind?: string; teamId?: string }
      | undefined;
    const ad = active.data.current as
      | { staffId?: string; fromTeamId?: string | null }
      | undefined;
    const draggedId = ad?.staffId;
    if (!draggedId) return;

    const { multiSelected, clearMultiSelect } = useUI.getState();
    // If the dragged staff is in the multi-selection, move all selected
    const staffIds = multiSelected.size > 0 && multiSelected.has(draggedId)
      ? Array.from(multiSelected)
      : [draggedId];

    for (const staffId of staffIds) {
      if (data?.kind === "team" && data.teamId) {
        // Find which team this staff is currently in (for the drop context)
        const fromTeamId = staffId === draggedId
          ? (ad?.fromTeamId ?? null)
          : findFromTeam(staffId);
        if (fromTeamId == null) {
          addStaffToTeam(staffId, data.teamId);
        } else {
          moveStaffBetweenTeams(staffId, fromTeamId, data.teamId);
        }
      } else if (data?.kind === "unassigned") {
        const fromTeamId = staffId === draggedId
          ? (ad?.fromTeamId ?? null)
          : findFromTeam(staffId);
        if (fromTeamId) removeStaffFromTeam(staffId, fromTeamId);
      }
    }

    clearMultiSelect();
  };

  const findFromTeam = (staffId: string): string | null => {
    for (const t of Object.values(teams)) {
      if (t.memberIds.includes(staffId)) return t.id;
    }
    return null;
  };

  return (
    <DndContext sensors={sensors} onDragEnd={onDragEnd}>
      <div className="flex items-center justify-between mb-3">
        <div>
          <h2 className="text-lg font-semibold">Squads</h2>
          <p className="text-sm text-slate-500">
            Drag staff between squads. Hover a staff card to remove from squad. Staff can belong to multiple squads — drop into another to move, or use sidebar to assign.
          </p>
        </div>
        <div className="flex gap-2">
          <button
            className="px-3 py-1.5 text-sm rounded-md bg-slate-900 text-white hover:bg-slate-700"
            onClick={() => {
              const name = prompt("Top-level team name?");
              if (name?.trim()) addTeam({ name: name.trim(), parentId: null });
            }}
          >
            + Team
          </button>
          <ExportButton targetRef={exportRef} filename="squads" />
        </div>
      </div>

      <div ref={exportRef} className="export-safe bg-white rounded-xl p-4 overflow-auto space-y-3">
        <UnassignedZone />
        {forest.length === 0 ? (
          <div className="text-slate-400 text-center py-12">
            No teams yet — click <strong>+ Team</strong> to create one.
          </div>
        ) : (
          <div className="flex flex-wrap gap-3">
            {forest.map((t) => (
              <TeamBox key={t.id} team={t} />
            ))}
          </div>
        )}
      </div>
    </DndContext>
  );
}
