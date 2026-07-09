"use client";

import { useCallback, useMemo, useRef, useState } from "react";
import {
  DndContext,
  DragEndEvent,
  DragStartEvent,
  PointerSensor,
  useDroppable,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import {
  SortableContext,
  useSortable,
  rectSortingStrategy,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { useStore } from "@/lib/store";
import { useUI } from "@/lib/ui";
import { useReadOnly } from "@/lib/readonly";
import { useSearch } from "@/lib/search";
import StaffBox from "./StaffBox";
import ExportButton from "./ExportButton";
import type { Team, TeamId } from "@/lib/types";
import { buildForest, sortMembersByRoleThenName, collectTeamIds, countSubtreeMembers, type Tree } from "@/lib/squad-utils";
import SquadsTreeView from "./SquadsTreeView";

function TeamBox({
  team,
  expanded,
  onToggle,
  expandedTeams,
}: {
  team: Tree;
  expanded: boolean;
  onToggle: (id: TeamId) => void;
  expandedTeams: Set<TeamId>;
}) {
  const removeStaffFromTeam = useStore((s) => s.removeStaffFromTeam);
  const allStaff = useStore((s) => s.staff);
  const allRoles = useStore((s) => s.roles);
  const renameTeam = useStore((s) => s.renameTeam);
  const deleteTeam = useStore((s) => s.deleteTeam);
  const addTeam = useStore((s) => s.addTeam);
  const setTeamSideBySide = useStore((s) => s.setTeamSideBySide);
  const { hasQuery, matchedTeams, roleFilterActive, visibleStaff } = useSearch();
  const readOnly = useReadOnly();
  const exportRef = useRef<HTMLDivElement>(null);

  const filterFn = roleFilterActive ? (id: string) => visibleStaff.has(id) : undefined;
  const visibleMemberIds = filterFn ? team.memberIds.filter(filterFn) : team.memberIds;

  const setDroppable = useDroppable({
    id: `team-drop-${team.id}`,
    data: { kind: "team", teamId: team.id },
  });
  const isOver = setDroppable.isOver;

  const {
    attributes: sortAttributes,
    listeners: sortListeners,
    setNodeRef: setSortRef,
    transform,
    transition,
    isDragging: isSortDragging,
  } = useSortable({ id: `sort-team-${team.id}`, data: { kind: "team-sort", teamId: team.id } });

  const sortStyle = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isSortDragging ? 0.4 : 1,
  };

  const setRefs = (el: HTMLDivElement | null) => {
    setDroppable.setNodeRef(el);
    (exportRef as React.MutableRefObject<HTMLDivElement | null>).current = el;
  };

  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(team.name);
  const dimmed = hasQuery && !matchedTeams.has(team.id);
  const flash = useUI((s) => s.flashTeamId === team.id);

  return (
    <div
      id={`team-box-${team.id}`}
      ref={(el) => {
        setRefs(el);
        setSortRef(el);
      }}
      style={sortStyle}
      className={`scroll-mt-3 rounded-xl border bg-slate-50 p-3 min-w-[220px] transition-all ${
        isOver ? "border-blue-500 bg-blue-50" : "border-slate-200"
      } ${dimmed ? "opacity-40" : ""} ${
        flash ? "ring-2 ring-blue-500 ring-offset-2" : ""
      }`}
    >
      <div className="flex items-center gap-1 mb-2">
        <button
          className="text-slate-400 hover:text-slate-600 px-0.5 text-xs"
          onClick={() => onToggle(team.id)}
          aria-expanded={expanded}
          title={expanded ? "Collapse" : "Expand"}
        >
          {expanded ? "▼" : "▶"}
        </button>
        {!readOnly && (
          <button
            {...sortAttributes}
            {...sortListeners}
            className="cursor-grab active:cursor-grabbing text-slate-400 hover:text-slate-600 px-0.5"
            title="Drag to reorder"
          >
            ⠿
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
            className="flex-1 min-w-0 flex items-baseline gap-1 text-left"
            onDoubleClick={readOnly ? undefined : () => setEditing(true)}
            title={`${team.name}${readOnly ? "" : " — double-click to rename"}`}
          >
            <span className="text-sm font-semibold truncate">{team.name}</span>
            <span className="text-sm font-semibold text-slate-500 shrink-0">
              ({visibleMemberIds.length}
              {team.children.length > 0 && ` · ${countSubtreeMembers(team, filterFn)} total`})
            </span>
          </span>
        )}
        <ExportButton
          targetRef={exportRef}
          filename={`team-${team.name}`}
          compact
          label="PNG"
          title="Export this team subtree as PNG"
        />
        {!readOnly && (
          <button
            className={`text-xs px-1.5 py-0.5 rounded ${
              team.sideBySide
                ? "bg-slate-900 text-white hover:bg-slate-700"
                : "hover:bg-slate-200 text-slate-500"
            }`}
            onClick={() => setTeamSideBySide(team.id, !team.sideBySide)}
            aria-pressed={!!team.sideBySide}
            title={
              team.sideBySide
                ? "Side by side with siblings — click to stack full-width"
                : "Show side by side with sibling boxes"
            }
          >
            ⇆
          </button>
        )}
        {!readOnly && (
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
        )}
        {!readOnly && (
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
        )}
        {!expanded && team.children.length > 0 && (
          <span className="text-xs text-slate-400 ml-1">+{team.children.length} sub</span>
        )}
      </div>

      {expanded ? (
        <>
          <div className="flex flex-wrap gap-1.5 min-h-[36px]">
            {visibleMemberIds.length === 0 && (
              <div className="text-xs text-slate-400 italic">
                {roleFilterActive && team.memberIds.length > 0 ? "No matching staff" : "Drop staff here"}
              </div>
            )}
            {sortMembersByRoleThenName(visibleMemberIds, allStaff, allRoles).map((sid) => (
              <div key={sid} className="relative group">
                <StaffBox
                  staffId={sid}
                  dragId={`squad-${team.id}-${sid}`}
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

          {team.children.length > 0 && (
            <div className="mt-3 pl-3 border-l-2 border-slate-200">
              <SiblingTeams
                siblings={team.children}
                expandedTeams={expandedTeams}
                onToggle={onToggle}
                strategy={verticalListSortingStrategy}
              />
            </div>
          )}
        </>
      ) : (
        <div className="flex flex-wrap gap-1 min-h-[36px]">
          {visibleMemberIds.length === 0 ? (
            <div className="text-xs text-slate-400 italic">
              {roleFilterActive && team.memberIds.length > 0 ? "No matching staff" : "Drop staff here"}
            </div>
          ) : (
            sortMembersByRoleThenName(visibleMemberIds, allStaff, allRoles).map((sid) => {
              const s = allStaff[sid];
              const role = s ? allRoles[s.roleId] : undefined;
              return (
                <span
                  key={sid}
                  className="w-2 h-2 rounded-full"
                  style={{ backgroundColor: role?.color ?? "#94a3b8" }}
                  title={s?.name}
                />
              );
            })
          )}
        </div>
      )}
    </div>
  );
}

/**
 * Renders an ordered list of sibling team boxes. Siblings marked `sideBySide`
 * are collected into a single horizontal row (in order), placed where the first
 * such sibling appears; the rest stack full-width.
 */
function SiblingTeams({
  siblings,
  expandedTeams,
  onToggle,
  strategy,
}: {
  siblings: Tree[];
  expandedTeams: Set<TeamId>;
  onToggle: (id: TeamId) => void;
  strategy: typeof rectSortingStrategy;
}) {
  const renderBox = (c: Tree) => (
    <TeamBox
      team={c}
      expanded={expandedTeams.has(c.id)}
      onToggle={onToggle}
      expandedTeams={expandedTeams}
    />
  );
  const rowTeams = siblings.filter((c) => c.sideBySide);
  let rowEmitted = false;
  const blocks: React.ReactNode[] = [];
  for (const c of siblings) {
    if (c.sideBySide) {
      if (!rowEmitted) {
        rowEmitted = true;
        blocks.push(
          <div key="__sbs_row" className="flex flex-wrap gap-3 items-start">
            {rowTeams.map((rc) => (
              <div key={rc.id} className="flex-1 min-w-[220px]">
                {renderBox(rc)}
              </div>
            ))}
          </div>,
        );
      }
    } else {
      blocks.push(<div key={c.id}>{renderBox(c)}</div>);
    }
  }
  return (
    <SortableContext items={siblings.map((c) => `sort-team-${c.id}`)} strategy={strategy}>
      <div className="space-y-3">{blocks}</div>
    </SortableContext>
  );
}

function UnassignedZone() {
  const { setNodeRef, isOver } = useDroppable({
    id: "unassigned-drop",
    data: { kind: "unassigned" },
  });
  const staff = useStore((s) => s.staff);
  const teams = useStore((s) => s.teams);
  const { roleFilterActive, visibleStaff } = useSearch();

  const inAnyTeam = useMemo(() => {
    const set = new Set<string>();
    for (const t of Object.values(teams)) for (const m of t.memberIds) set.add(m);
    return set;
  }, [teams]);
  const unassigned = Object.values(staff).filter(
    (s) => !inAnyTeam.has(s.id) && (!roleFilterActive || visibleStaff.has(s.id)),
  );

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

function TocRow({
  node,
  depth,
  onJump,
}: {
  node: Tree;
  depth: number;
  onJump: (id: TeamId) => void;
}) {
  return (
    <>
      <button
        className="w-full flex items-center gap-1 text-left text-xs py-0.5 pr-1 rounded hover:bg-slate-100"
        style={{ paddingLeft: depth * 12 + 4 }}
        onClick={() => onJump(node.id)}
        title={node.name}
      >
        <span className="truncate">{node.name}</span>
        <span className="text-slate-400 ml-auto shrink-0">{node.memberIds.length}</span>
      </button>
      {node.children.map((c) => (
        <TocRow key={c.id} node={c} depth={depth + 1} onJump={onJump} />
      ))}
    </>
  );
}

function SquadsTOC({ forest, onJump }: { forest: Tree[]; onJump: (id: TeamId) => void }) {
  return (
    <aside className="hidden xl:block w-56 shrink-0 self-start sticky top-2 max-h-[calc(100vh-1rem)] overflow-y-auto">
      <div className="rounded-xl border border-slate-200 bg-white p-3">
        <div className="text-[11px] font-semibold text-slate-500 uppercase tracking-wide mb-2">
          Contents
        </div>
        <div className="space-y-0.5">
          {forest.map((t) => (
            <TocRow key={t.id} node={t} depth={0} onJump={onJump} />
          ))}
        </div>
      </div>
    </aside>
  );
}

export default function SquadsView() {
  const teams = useStore((s) => s.teams);
  const addTeam = useStore((s) => s.addTeam);
  const addStaffToTeam = useStore((s) => s.addStaffToTeam);
  const removeStaffFromTeam = useStore((s) => s.removeStaffFromTeam);
  const moveStaffBetweenTeams = useStore((s) => s.moveStaffBetweenTeams);
  const reorderTeams = useStore((s) => s.reorderTeams);
  const reparentTeam = useStore((s) => s.reparentTeam);
  const readOnly = useReadOnly();
  const exportRef = useRef<HTMLDivElement>(null);
  const [activeKind, setActiveKind] = useState<"staff" | "team" | null>(null);
  const [subTab, setSubTab] = useState<"nested" | "tree">("nested");

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 4 } }));

  const forest = useMemo(() => buildForest(teams), [teams]);

  const [expandedTeams, setExpandedTeams] = useState<Set<TeamId>>(new Set());

  const allTeamIds = useMemo(() => collectTeamIds(forest), [forest]);
  const allExpanded = allTeamIds.length > 0 && allTeamIds.every((id) => expandedTeams.has(id));

  const toggleTeam = useCallback((id: TeamId) => {
    setExpandedTeams((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const toggleAll = useCallback(() => {
    if (allExpanded) {
      setExpandedTeams(new Set());
    } else {
      setExpandedTeams(new Set(allTeamIds));
    }
  }, [allExpanded, allTeamIds]);

  const jumpToTeam = useCallback(
    (id: TeamId) => {
      // Expand every ancestor so the target box is rendered, then scroll to it.
      setExpandedTeams((prev) => {
        const next = new Set(prev);
        let cur: TeamId | null | undefined = id;
        while (cur) {
          next.add(cur);
          cur = teams[cur]?.parentId ?? null;
        }
        return next;
      });
      useUI.getState().flashTeam(id);
      setTimeout(() => {
        document
          .getElementById(`team-box-${id}`)
          ?.scrollIntoView({ behavior: "smooth", block: "start" });
      }, 60);
    },
    [teams],
  );

  const onDragStart = (e: DragStartEvent) => {
    const data = e.active.data.current as { kind?: string } | undefined;
    setActiveKind(data?.kind === "team-sort" ? "team" : "staff");
  };

  const onDragEnd = (e: DragEndEvent) => {
    setActiveKind(null);
    const { active, over } = e;
    if (!over) return;

    const activeData = active.data.current as Record<string, unknown> | undefined;
    const overData = over.data.current as Record<string, unknown> | undefined;

    // Team reorder/reparent
    if (activeData?.kind === "team-sort") {
      const draggedTeamId = activeData.teamId as string;
      const draggedTeam = teams[draggedTeamId];
      if (!draggedTeam) return;

      if (overData?.kind === "team-sort") {
        const overTeamId = overData.teamId as string;
        const overTeam = teams[overTeamId];
        if (!overTeam) return;

        if (draggedTeam.parentId === overTeam.parentId) {
          // Same parent — reorder
          const parentId = draggedTeam.parentId;
          const siblings = Object.values(teams)
            .filter((t) => t.parentId === parentId)
            .sort((a, b) => (a.order ?? 0) - (b.order ?? 0))
            .map((t) => t.id);
          const oldIdx = siblings.indexOf(draggedTeamId);
          const newIdx = siblings.indexOf(overTeamId);
          if (oldIdx !== -1 && newIdx !== -1 && oldIdx !== newIdx) {
            siblings.splice(oldIdx, 1);
            siblings.splice(newIdx, 0, draggedTeamId);
            reorderTeams(parentId, siblings);
          }
        } else {
          // Different parent — reparent into the over team's parent
          reparentTeam(draggedTeamId, overTeam.parentId);
        }
      } else if (overData?.kind === "team" && overData.teamId) {
        // Dropped onto a team drop zone — reparent into that team
        reparentTeam(draggedTeamId, overData.teamId as string);
      }

      const { clearMultiSelect } = useUI.getState();
      clearMultiSelect();
      return;
    }

    // Staff drag logic (existing code below)
    const ad = activeData as { staffId?: string; fromTeamId?: string | null } | undefined;
    const draggedId = ad?.staffId;
    if (!draggedId) return;

    const { multiSelected, clearMultiSelect } = useUI.getState();
    // If the dragged staff is in the multi-selection, move all selected
    const staffIds = multiSelected.size > 0 && multiSelected.has(draggedId)
      ? Array.from(multiSelected)
      : [draggedId];

    for (const staffId of staffIds) {
      if (overData?.kind === "team" && overData.teamId) {
        // Find which team this staff is currently in (for the drop context)
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

  const findFromTeam = (staffId: string): string | null => {
    for (const t of Object.values(teams)) {
      if (t.memberIds.includes(staffId)) return t.id;
    }
    return null;
  };

  return (
    <>
      <div className="flex items-center justify-between mb-3 gap-3">
        <div className="min-w-0">
          <h2 className="text-lg font-semibold">Squads</h2>
          <p className="text-sm text-slate-500">
            {subTab === "nested"
              ? "Drag staff between squads. Hover a staff card to remove from squad. Staff can belong to multiple squads — drop into another to move, or use sidebar to assign."
              : "Org-chart view of team hierarchy. Drag staff between teams or drag teams to reparent."}
          </p>
        </div>
        <div className="flex gap-2 items-center shrink-0">
          <div className="flex shrink-0 rounded-md border border-slate-300 overflow-hidden text-sm">
            <button
              onClick={() => setSubTab("nested")}
              className={`px-3 py-1.5 ${
                subTab === "nested"
                  ? "bg-slate-900 text-white"
                  : "text-slate-600 hover:bg-slate-100"
              }`}
            >
              Nested
            </button>
            <button
              onClick={() => setSubTab("tree")}
              className={`px-3 py-1.5 ${
                subTab === "tree"
                  ? "bg-slate-900 text-white"
                  : "text-slate-600 hover:bg-slate-100"
              }`}
            >
              Tree
            </button>
          </div>
          {subTab === "nested" && (
            <button
              className="px-3 py-1.5 text-sm rounded-md border border-slate-300 hover:bg-slate-100"
              onClick={toggleAll}
            >
              {allExpanded ? "Collapse All" : "Expand All"}
            </button>
          )}
          {!readOnly && (
            <button
              className="px-3 py-1.5 text-sm rounded-md bg-slate-900 text-white hover:bg-slate-700"
              onClick={() => {
                const name = prompt("Top-level team name?");
                if (name?.trim()) addTeam({ name: name.trim(), parentId: null });
              }}
            >
              + Team
            </button>
          )}
          <ExportButton targetRef={exportRef} filename="squads" />
        </div>
      </div>

      <div className="flex gap-4 items-start">
        <div
          ref={exportRef}
          className="export-safe bg-white rounded-xl p-4 overflow-auto space-y-3 flex-1 min-w-0"
        >
          {subTab === "nested" ? (
            <DndContext sensors={sensors} onDragStart={onDragStart} onDragEnd={onDragEnd}>
              <UnassignedZone />
              {forest.length === 0 ? (
                <div className="text-slate-400 text-center py-12">
                  No teams yet — click <strong>+ Team</strong> to create one.
                </div>
              ) : (
                <SiblingTeams
                  siblings={forest}
                  expandedTeams={expandedTeams}
                  onToggle={toggleTeam}
                  strategy={rectSortingStrategy}
                />
              )}
            </DndContext>
          ) : (
            <SquadsTreeView />
          )}
        </div>
        {subTab === "nested" && forest.length > 0 && (
          <SquadsTOC forest={forest} onJump={jumpToTeam} />
        )}
      </div>
    </>
  );
}
