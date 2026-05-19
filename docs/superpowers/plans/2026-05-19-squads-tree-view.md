# Squads Tree View Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add an org-chart-style tree view for squads/teams as a sub-tab within the Squads tab, alongside the existing nested/grid view.

**Architecture:** Extract shared utilities (`buildForest`, `sortMembersByRoleThenName`, `Tree` type) into `lib/squad-utils.ts`. Add a new `SquadsTreeView` component that renders the team hierarchy as a top-down org chart with CSS connector lines (reusing the `.org-tree` pattern from ReportingView). Add sub-tab navigation to `SquadsView` to switch between "Nested" and "Tree" layouts.

**Tech Stack:** React 18, Next.js 14 (App Router), Tailwind CSS, @dnd-kit, Zustand, TypeScript

---

## File Structure

| File | Action | Responsibility |
|------|--------|---------------|
| `lib/squad-utils.ts` | Create | `Tree` type, `buildForest`, `sortMembersByRoleThenName`, `collectTeamIds` |
| `components/SquadsTreeView.tsx` | Create | Org-chart tree layout for teams with DnD, search, collapse |
| `components/SquadsView.tsx` | Modify | Add sub-tab state, import from `squad-utils`, render tree or nested |
| `app/globals.css` | Modify | Add `.squad-tree` connector styles (adapted from `.org-tree`) |

---

### Task 1: Extract shared utilities into `lib/squad-utils.ts`

**Files:**
- Create: `lib/squad-utils.ts`
- Modify: `components/SquadsView.tsx`

- [ ] **Step 1: Create `lib/squad-utils.ts` with extracted utilities**

```ts
import type { Team, TeamId, Staff, Role } from "@/lib/types";

export type Tree = Team & { children: Tree[] };

export function sortMembersByRoleThenName(
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

export function buildForest(teams: Record<TeamId, Team>): Tree[] {
  const childrenOf: Record<string, TeamId[]> = {};
  for (const t of Object.values(teams)) {
    const key = t.parentId ?? "__root__";
    (childrenOf[key] ??= []).push(t.id);
  }
  for (const key of Object.keys(childrenOf)) {
    childrenOf[key].sort((a, b) => (teams[a]?.order ?? 0) - (teams[b]?.order ?? 0));
  }
  const build = (id: TeamId): Tree => ({
    ...teams[id],
    children: (childrenOf[id] ?? []).map(build),
  });
  return (childrenOf["__root__"] ?? []).map(build);
}

export function collectTeamIds(trees: Tree[]): TeamId[] {
  const ids: TeamId[] = [];
  for (const t of trees) {
    ids.push(t.id);
    ids.push(...collectTeamIds(t.children));
  }
  return ids;
}
```

- [ ] **Step 2: Update `SquadsView.tsx` to import from `squad-utils`**

Remove the local `Tree` type, `sortMembersByRoleThenName`, `buildForest`, and `collectTeamIds` definitions. Replace with imports:

```ts
import { buildForest, sortMembersByRoleThenName, collectTeamIds, type Tree } from "@/lib/squad-utils";
```

Remove these lines from `SquadsView.tsx`:
- Line 28: `type Tree = Team & { children: Tree[] };`
- Lines 30-45: `function sortMembersByRoleThenName(...)`
- Lines 47-61: `function buildForest(...)`
- Lines 63-70: `function collectTeamIds(...)`

- [ ] **Step 3: Verify the app compiles**

Run: `npm run build` or open the browser and confirm squads view works identically.

- [ ] **Step 4: Commit**

```bash
git add lib/squad-utils.ts components/SquadsView.tsx
git commit -m "refactor: extract squad tree utilities into lib/squad-utils"
```

---

### Task 2: Add sub-tab navigation to SquadsView

**Files:**
- Modify: `components/SquadsView.tsx`

- [ ] **Step 1: Add sub-tab state and UI to SquadsView**

Inside the `SquadsView` component, add a state variable for the active sub-tab. Place the sub-tab toggle in the header area, between the title/description and the action buttons.

Add this state at the top of the `SquadsView` function (alongside the existing `useState` calls around line 346-352):

```ts
const [subTab, setSubTab] = useState<"nested" | "tree">("nested");
```

Replace the current header `<div>` block (lines 468-495 — the one with `<h2>Squads</h2>`) with:

```tsx
<div className="flex items-center justify-between mb-3">
  <div>
    <h2 className="text-lg font-semibold">Squads</h2>
    <p className="text-sm text-slate-500">
      {subTab === "nested"
        ? "Drag staff between squads. Hover a staff card to remove from squad. Staff can belong to multiple squads — drop into another to move, or use sidebar to assign."
        : "Org-chart view of team hierarchy. Drag staff between teams or drag teams to reparent."}
    </p>
  </div>
  <div className="flex gap-2 items-center">
    <div className="flex rounded-md border border-slate-300 overflow-hidden text-sm">
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
```

- [ ] **Step 2: Conditionally render nested vs tree content**

Replace the current content `<div>` (lines 497-521 — the `ref={exportRef}` div) with:

```tsx
<div ref={exportRef} className="export-safe bg-white rounded-xl p-4 overflow-auto space-y-3">
  {subTab === "nested" ? (
    <>
      <UnassignedZone />
      {forest.length === 0 ? (
        <div className="text-slate-400 text-center py-12">
          No teams yet — click <strong>+ Team</strong> to create one.
        </div>
      ) : (
        <SortableContext
          items={forest.map((t) => `sort-team-${t.id}`)}
          strategy={rectSortingStrategy}
        >
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
            {forest.map((t) => (
              <TeamBox
                key={t.id}
                team={t}
                expanded={expandedTeams.has(t.id)}
                onToggle={toggleTeam}
                expandedTeams={expandedTeams}
              />
            ))}
          </div>
        </SortableContext>
      )}
    </>
  ) : (
    <div className="text-slate-400 text-center py-12">
      Tree view coming soon...
    </div>
  )}
</div>
```

- [ ] **Step 3: Verify sub-tabs work**

Run the dev server, switch between Nested and Tree sub-tabs. Nested should work exactly as before. Tree shows the placeholder text.

- [ ] **Step 4: Commit**

```bash
git add components/SquadsView.tsx
git commit -m "feat: add sub-tab navigation (Nested/Tree) to squads view"
```

---

### Task 3: Add CSS connector styles for squad tree

**Files:**
- Modify: `app/globals.css`

- [ ] **Step 1: Add `.squad-tree` styles to `globals.css`**

Add the following block after the existing `.org-tree` styles (after line 95, before the `/* For html-to-image */` comment):

```css
/* Squad org-chart tree connectors */
.squad-tree, .squad-tree ul {
  list-style: none;
  margin: 0;
  padding: 0;
  position: relative;
}

.squad-tree ul {
  display: flex;
  justify-content: center;
  padding-top: 28px;
  gap: 12px;
}

.squad-tree li {
  position: relative;
  padding: 28px 8px 0 8px;
  text-align: center;
}

.squad-tree li::before,
.squad-tree li::after {
  content: "";
  position: absolute;
  top: 0;
  height: 28px;
  border-top: 2px solid #cbd5e1;
  width: 50%;
}

.squad-tree li::before {
  left: 0;
  border-right: 2px solid #cbd5e1;
}

.squad-tree li::after {
  left: 50%;
}

.squad-tree > li::before,
.squad-tree > li::after {
  display: none;
}

.squad-tree li:only-child::before,
.squad-tree li:only-child::after {
  display: none;
}

.squad-tree li:only-child {
  padding-top: 28px;
}

.squad-tree li:first-child::before,
.squad-tree li:last-child::after {
  border: 0 none;
}

.squad-tree li:last-child::before {
  border-right: 2px solid #cbd5e1;
  border-radius: 0 6px 0 0;
}

.squad-tree li:first-child::after {
  border-radius: 6px 0 0 0;
}

.squad-tree li > .squad-node-wrap::before {
  content: "";
  position: absolute;
  top: -28px;
  left: 50%;
  height: 28px;
  border-left: 2px solid #cbd5e1;
}

.squad-node-wrap {
  display: inline-block;
  position: relative;
}
```

- [ ] **Step 2: Commit**

```bash
git add app/globals.css
git commit -m "style: add squad-tree CSS connector styles for org-chart layout"
```

---

### Task 4: Build `SquadsTreeView` component

**Files:**
- Create: `components/SquadsTreeView.tsx`

- [ ] **Step 1: Create the `SquadsTreeView` component**

```tsx
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
import { useStore } from "@/lib/store";
import { useUI } from "@/lib/ui";
import { useReadOnly } from "@/lib/readonly";
import { useSearch } from "@/lib/search";
import StaffBox from "./StaffBox";
import ExportButton from "./ExportButton";
import { buildForest, sortMembersByRoleThenName, collectTeamIds, type Tree } from "@/lib/squad-utils";
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
  const reparentTeam = useStore((s) => s.reparentTeam);
  const exportRef = useRef<HTMLDivElement>(null);

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
```

- [ ] **Step 2: Verify the component compiles**

Run: `npx tsc --noEmit`

Expected: No type errors in `SquadsTreeView.tsx`.

- [ ] **Step 3: Commit**

```bash
git add components/SquadsTreeView.tsx
git commit -m "feat: add SquadsTreeView org-chart component with DnD and search"
```

---

### Task 5: Wire `SquadsTreeView` into `SquadsView`

**Files:**
- Modify: `components/SquadsView.tsx`

- [ ] **Step 1: Import `SquadsTreeView` in `SquadsView.tsx`**

Add this import near the top of the file (alongside the other component imports):

```ts
import SquadsTreeView from "./SquadsTreeView";
```

- [ ] **Step 2: Replace the tree placeholder with the actual component**

In the content area where we added the placeholder in Task 2, replace:

```tsx
<div className="text-slate-400 text-center py-12">
  Tree view coming soon...
</div>
```

with:

```tsx
<SquadsTreeView />
```

- [ ] **Step 3: Move the DndContext to wrap both views properly**

The nested view currently wraps its content in a `<DndContext>` at the top level of `SquadsView`. Since `SquadsTreeView` has its own `DndContext`, we need the outer `DndContext` to only wrap the nested content. The current structure already handles this correctly — the outer `DndContext` wraps the entire return, but the tree sub-tab renders `<SquadsTreeView />` which has its own `DndContext`.

However, having nested DndContexts causes conflicts. We need to restructure so that only one DndContext is active at a time.

Update the return of `SquadsView` to conditionally wrap with DndContext only for the nested sub-tab:

```tsx
return (
  <>
    <div className="flex items-center justify-between mb-3">
      {/* ... header with sub-tabs (from Task 2) ... */}
    </div>

    <div ref={exportRef} className="export-safe bg-white rounded-xl p-4 overflow-auto space-y-3">
      {subTab === "nested" ? (
        <DndContext sensors={sensors} onDragStart={onDragStart} onDragEnd={onDragEnd}>
          <UnassignedZone />
          {forest.length === 0 ? (
            <div className="text-slate-400 text-center py-12">
              No teams yet — click <strong>+ Team</strong> to create one.
            </div>
          ) : (
            <SortableContext
              items={forest.map((t) => `sort-team-${t.id}`)}
              strategy={rectSortingStrategy}
            >
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
                {forest.map((t) => (
                  <TeamBox
                    key={t.id}
                    team={t}
                    expanded={expandedTeams.has(t.id)}
                    onToggle={toggleTeam}
                    expandedTeams={expandedTeams}
                  />
                ))}
              </div>
            </SortableContext>
          )}
        </DndContext>
      ) : (
        <SquadsTreeView />
      )}
    </div>
  </>
);
```

This means the outer `<DndContext>` that currently wraps the entire `SquadsView` return should be removed. The `DndContext` now only wraps the nested sub-tab content, and `SquadsTreeView` brings its own.

- [ ] **Step 4: Verify both sub-tabs work**

Run the dev server:
1. Switch to "Nested" — should work exactly as before (grid layout, drag-and-drop, collapse/expand)
2. Switch to "Tree" — should show org-chart tree with connector lines, staff inside nodes
3. Try dragging staff between teams in tree view
4. Try search in both views — dimming should work
5. Verify read-only mode works (sign out, view as guest)

- [ ] **Step 5: Commit**

```bash
git add components/SquadsView.tsx
git commit -m "feat: wire SquadsTreeView into squads sub-tab navigation"
```

---

### Task 6: Manual integration test

**Files:** None (testing only)

- [ ] **Step 1: Test nested view is unchanged**

1. Open the app, go to Squads tab (defaults to Nested)
2. Expand/collapse teams
3. Drag staff between teams
4. Drag teams to reorder
5. Use Ctrl+Click to multi-select, drag multiple staff
6. Use "Expand All" / "Collapse All"
7. Use "+ Team" to create a team, "+sub" to add sub-teams
8. Double-click to rename a team
9. Delete a team
10. Search for a staff member — confirm highlighting/dimming

- [ ] **Step 2: Test tree view**

1. Switch to "Tree" sub-tab
2. Verify root teams render as separate org-chart cards
3. Verify child teams branch downward with connector lines
4. Verify staff are listed inside each team node
5. Collapse a team with children — verify sub-tree hides, "+N sub" label shows
6. Drag staff from one team to another
7. Drag staff to unassigned zone
8. Drag unassigned staff into a team
9. Ctrl+Click to multi-select, drag multiple staff
10. Search — verify dimming/highlighting works
11. Double-click to rename a team
12. Use "+sub" to add sub-team
13. Delete a team

- [ ] **Step 3: Test read-only mode**

1. Sign out (view as guest)
2. Switch between Nested and Tree sub-tabs
3. Verify no drag handles, no +sub buttons, no delete buttons, no rename on double-click in both views

- [ ] **Step 4: Test export**

1. Click the Export PNG button in each sub-tab
2. Verify the exported image captures the active view

- [ ] **Step 5: Commit any fixes found during testing**

```bash
git add -A
git commit -m "fix: address issues found during squads tree view integration testing"
```

(Only if fixes were needed.)
