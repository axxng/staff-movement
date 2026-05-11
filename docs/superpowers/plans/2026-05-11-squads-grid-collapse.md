# Squads Grid + Collapse Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the squads view less overwhelming by switching to a responsive grid layout and adding collapsible team cards with role-colored dot summaries.

**Architecture:** All changes are in `components/SquadsView.tsx`. We add a `Set<TeamId>` of expanded teams as local state in the parent `SquadsView` component, pass `expanded`/`onToggle` props down to `TeamBox`, and switch the root container from flex-wrap to CSS grid. Collapsed teams render dots instead of StaffBox components.

**Tech Stack:** React, Tailwind CSS, @dnd-kit (existing)

**Spec:** `docs/superpowers/specs/2026-05-11-squads-grid-collapse-design.md`

---

### Task 1: Add expand/collapse state management to SquadsView

**Files:**
- Modify: `components/SquadsView.tsx:276-429` (SquadsView component)

- [ ] **Step 1: Add expanded state and helper functions**

In the `SquadsView` component, after the existing `useState` for `activeKind` (line 286), add:

```tsx
const [expandedTeams, setExpandedTeams] = useState<Set<TeamId>>(new Set());

const toggleTeam = (teamId: TeamId) => {
  setExpandedTeams((prev) => {
    const next = new Set(prev);
    if (next.has(teamId)) next.delete(teamId);
    else next.add(teamId);
    return next;
  });
};

const allTeamIds = useMemo(() => {
  return Object.keys(teams);
}, [teams]);

const allExpanded = allTeamIds.length > 0 && allTeamIds.every((id) => expandedTeams.has(id));

const toggleAll = () => {
  if (allExpanded) {
    setExpandedTeams(new Set());
  } else {
    setExpandedTeams(new Set(allTeamIds));
  }
};
```

Add `TeamId` to the existing import from `@/lib/types` if not already there (it is already imported on line 25).

- [ ] **Step 2: Verify build**

Run: `npm run build`
Expected: Build succeeds (new state is unused so far but valid)

- [ ] **Step 3: Commit**

```bash
git add components/SquadsView.tsx
git commit -m "feat(squads): add expand/collapse state management"
```

---

### Task 2: Add Expand All / Collapse All button

**Files:**
- Modify: `components/SquadsView.tsx:384-407` (header section of SquadsView return)

- [ ] **Step 1: Add the toggle button next to "+ Team"**

In the `SquadsView` return JSX, find the `<div className="flex gap-2">` block (line 393). Add the toggle button before the `ExportButton`:

```tsx
<div className="flex gap-2">
  <button
    className="px-3 py-1.5 text-sm rounded-md border border-slate-300 hover:bg-slate-100"
    onClick={toggleAll}
  >
    {allExpanded ? "Collapse All" : "Expand All"}
  </button>
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
```

- [ ] **Step 2: Verify build**

Run: `npm run build`
Expected: Build succeeds

- [ ] **Step 3: Commit**

```bash
git add components/SquadsView.tsx
git commit -m "feat(squads): add expand all / collapse all button"
```

---

### Task 3: Pass expanded state to TeamBox and add chevron toggle

**Files:**
- Modify: `components/SquadsView.tsx:62-231` (TeamBox component)

- [ ] **Step 1: Update TeamBox props to accept expanded state**

Change the TeamBox function signature from:

```tsx
function TeamBox({ team }: { team: Tree }) {
```

to:

```tsx
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
```

- [ ] **Step 2: Add chevron toggle to the header**

In the TeamBox header `<div className="flex items-center gap-1 mb-2">`, add a chevron button as the first child (before the drag handle):

```tsx
<button
  className="text-xs text-slate-400 hover:text-slate-600 w-4"
  onClick={() => onToggle(team.id)}
  title={expanded ? "Collapse" : "Expand"}
>
  {expanded ? "▼" : "▶"}
</button>
```

- [ ] **Step 3: Conditionally render members and children based on expanded state**

Replace the existing member rendering block (the `<div className="flex flex-wrap gap-1.5 min-h-[36px]">` and its contents, lines 189-215) with:

```tsx
{expanded ? (
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
) : (
  <div className="flex flex-wrap gap-1 mt-1">
    {sortMembersByRoleThenName(team.memberIds, allStaff, allRoles).map((sid) => {
      const s = allStaff[sid];
      const r = s ? allRoles[s.roleId] : undefined;
      return (
        <div
          key={sid}
          className="w-2 h-2 rounded-full"
          style={{ backgroundColor: r?.color ?? "#94a3b8" }}
          title={s?.name}
        />
      );
    })}
  </div>
)}
```

- [ ] **Step 4: Conditionally render children and add "+N sub" hint**

Replace the existing children block (lines 217-228) with:

```tsx
{team.children.length > 0 && !expanded && (
  <span className="text-[10px] text-slate-400 ml-auto">
    +{team.children.length} sub
  </span>
)}

{team.children.length > 0 && expanded && (
  <div className="mt-3 pl-3 border-l-2 border-slate-200 space-y-2">
    <SortableContext
      items={team.children.map((c) => `sort-team-${c.id}`)}
      strategy={verticalListSortingStrategy}
    >
      {team.children.map((c) => (
        <TeamBox
          key={c.id}
          team={c}
          expanded={expandedTeams.has(c.id)}
          onToggle={onToggle}
          expandedTeams={expandedTeams}
        />
      ))}
    </SortableContext>
  </div>
)}
```

Note: The "+N sub" span needs to be placed inside the header `<div className="flex items-center gap-1 mb-2">`, after the delete button. Move it there so it appears in the header row when collapsed.

- [ ] **Step 5: Verify build**

Run: `npm run build`
Expected: Build fails — TeamBox call sites don't pass new props yet. That's expected, fixed in next task.

- [ ] **Step 6: Commit**

```bash
git add components/SquadsView.tsx
git commit -m "feat(squads): add chevron toggle and collapsed dot summary to TeamBox"
```

---

### Task 4: Update TeamBox call sites and switch to grid layout

**Files:**
- Modify: `components/SquadsView.tsx:409-429` (SquadsView return JSX)

- [ ] **Step 1: Pass props to TeamBox in the forest rendering**

Find the forest rendering block (around line 420):

```tsx
<div className="flex flex-wrap gap-3">
  {forest.map((t) => (
    <TeamBox key={t.id} team={t} />
  ))}
</div>
```

Replace with:

```tsx
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
```

This also switches from `flex flex-wrap` to the responsive grid.

- [ ] **Step 2: Verify build**

Run: `npm run build`
Expected: Build succeeds

- [ ] **Step 3: Manual verification**

Run: `npm run dev`

Verify in the browser:
1. Teams render in a 2-column grid (on a medium-width window)
2. All teams start collapsed, showing role-colored dots
3. Clicking a chevron expands/collapses that team
4. "Expand All" button expands all teams; label changes to "Collapse All"
5. Sub-teams appear nested inside expanded parents with left border
6. Sub-teams have their own independent collapse toggle
7. Collapsed parent with sub-teams shows "+N sub" in header
8. Dragging staff onto a collapsed team works (drop target covers whole card)
9. Search still highlights/dims correctly

- [ ] **Step 4: Commit**

```bash
git add components/SquadsView.tsx
git commit -m "feat(squads): switch to responsive grid layout and wire up collapse props"
```
