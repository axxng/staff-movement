# Teams Reordering, Staff Tags, and Role-Based Sorting Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add drag-to-reorder/reparent teams, freeform staff tags with search integration and sidebar management, and sort staff within teams by role then name.

**Architecture:** Extend existing types (Team gets `order`, Staff gets `tags`), add new store actions, update SquadsView for team drag-drop alongside existing staff drag-drop, add tag UI in StaffDetailDrawer and Sidebar, and apply display-only sorting in team member rendering.

**Tech Stack:** @dnd-kit/core + @dnd-kit/sortable (new dep for team reordering), Zustand store, React

---

## File Structure

### Modified files
- `lib/types.ts` — add `order` to Team, `tags` to Staff, new MovementTypes
- `lib/store.ts` — new actions: `addTag`, `removeTag`, `removeTagFromAll`, `reorderTeams`; update `addTeam` to set `order`
- `lib/search.tsx` — include tags in staff matching
- `components/SquadsView.tsx` — team drag-to-reorder/reparent, sort staff by role+name within teams
- `components/StaffBox.tsx` — render tag pills in non-compact mode
- `components/StaffDetailDrawer.tsx` — tag input with autocomplete
- `components/Sidebar.tsx` — add Tags tab

### New dependencies
- `@dnd-kit/sortable` — for team reordering (drag-to-sort within a list)

---

### Task 1: Update types and install @dnd-kit/sortable

**Files:**
- Modify: `lib/types.ts`
- Modify: `package.json`

- [ ] **Step 1: Install @dnd-kit/sortable**

Run: `npm install @dnd-kit/sortable`

- [ ] **Step 2: Update types in lib/types.ts**

Add `order` to Team:

```typescript
export type Team = {
  id: TeamId;
  name: string;
  parentId: TeamId | null;
  memberIds: StaffId[];
  order: number;
};
```

Add `tags` to Staff:

```typescript
export type Staff = {
  id: StaffId;
  name: string;
  roleId: RoleId;
  managerId: StaffId | null;
  tags: string[];
};
```

Add tag movement types to MovementType:

```typescript
export type MovementType =
  | "staff_create"
  | "staff_delete"
  | "staff_rename"
  | "role_change"
  | "manager_change"
  | "team_create"
  | "team_delete"
  | "team_rename"
  | "team_reparent"
  | "team_join"
  | "team_leave"
  | "tag_add"
  | "tag_remove";
```

- [ ] **Step 3: Commit**

```bash
git add package.json package-lock.json lib/types.ts
git commit -m "feat: add order to Team, tags to Staff, tag movement types"
```

---

### Task 2: Add store actions for tags, team ordering, and migration

**Files:**
- Modify: `lib/store.ts`

- [ ] **Step 1: Update Actions type**

Add to the Actions type after the roles section:

```typescript
  // tags
  addTag: (staffId: StaffId, tag: string) => void;
  removeTag: (staffId: StaffId, tag: string) => void;
  removeTagFromAll: (tag: string) => void;
  // team ordering
  reorderTeams: (parentId: TeamId | null, orderedIds: TeamId[]) => void;
```

- [ ] **Step 2: Update addStaff to include tags**

In `addStaff`, change the staff creation line:

```typescript
const staff: Staff = { id, name, roleId, managerId, tags: [] };
```

- [ ] **Step 3: Update addTeam to include order**

In `addTeam`, compute the order from siblings and set it:

```typescript
addTeam: ({ name, parentId = null }) => {
  const id = uid();
  set((state) => {
    const siblings = Object.values(state.teams).filter(
      (t) => t.parentId === parentId,
    );
    const maxOrder = siblings.reduce(
      (max, t) => Math.max(max, t.order ?? 0),
      -1,
    );
    const team: Team = { id, name, parentId, memberIds: [], order: maxOrder + 1 };
    return {
      teams: { ...state.teams, [id]: team },
      movements: recordMovement(state, {
        type: "team_create",
        teamId: id,
        toLabel: name,
        note: `Created team ${name}`,
      }),
    };
  });
  return id;
},
```

- [ ] **Step 4: Add tag actions**

Add after the `deleteRole` action:

```typescript
addTag: (staffId, tag) => {
  const normalized = tag.trim().toLowerCase();
  if (!normalized) return;
  set((state) => {
    const cur = state.staff[staffId];
    if (!cur) return {} as Partial<Store>;
    if (cur.tags?.includes(normalized)) return {} as Partial<Store>;
    return {
      staff: {
        ...state.staff,
        [staffId]: { ...cur, tags: [...(cur.tags ?? []), normalized] },
      },
      movements: recordMovement(state, {
        type: "tag_add",
        staffId,
        toLabel: normalized,
        note: `Added tag "${normalized}" to ${cur.name}`,
      }),
    };
  });
},

removeTag: (staffId, tag) => {
  set((state) => {
    const cur = state.staff[staffId];
    if (!cur) return {} as Partial<Store>;
    if (!cur.tags?.includes(tag)) return {} as Partial<Store>;
    return {
      staff: {
        ...state.staff,
        [staffId]: { ...cur, tags: cur.tags.filter((t) => t !== tag) },
      },
      movements: recordMovement(state, {
        type: "tag_remove",
        staffId,
        fromLabel: tag,
        note: `Removed tag "${tag}" from ${cur.name}`,
      }),
    };
  });
},

removeTagFromAll: (tag) => {
  set((state) => {
    const newStaff = { ...state.staff };
    let changed = false;
    for (const [id, s] of Object.entries(newStaff)) {
      if (s.tags?.includes(tag)) {
        newStaff[id] = { ...s, tags: s.tags.filter((t) => t !== tag) };
        changed = true;
      }
    }
    if (!changed) return {} as Partial<Store>;
    return { staff: newStaff };
  });
},
```

- [ ] **Step 5: Add reorderTeams action**

Add after the tag actions:

```typescript
reorderTeams: (parentId, orderedIds) => {
  set((state) => {
    const newTeams = { ...state.teams };
    orderedIds.forEach((id, i) => {
      if (newTeams[id]) {
        newTeams[id] = { ...newTeams[id], order: i, parentId };
      }
    });
    return { teams: newTeams };
  });
},
```

- [ ] **Step 6: Update replaceState to handle migration**

In `replaceState`, ensure old data without `tags` or `order` gets defaults:

```typescript
replaceState: (s) => {
  // Migrate: ensure all staff have tags and all teams have order
  const staff: Record<string, Staff> = {};
  for (const [id, st] of Object.entries(s.staff ?? {})) {
    staff[id] = { ...st, tags: st.tags ?? [] };
  }
  const teams: Record<string, Team> = {};
  const byParent: Record<string, typeof teams> = {};
  for (const [id, t] of Object.entries(s.teams ?? {})) {
    const key = t.parentId ?? "__root__";
    (byParent[key] ??= {})[id] = t;
  }
  for (const group of Object.values(byParent)) {
    const sorted = Object.values(group).sort(
      (a, b) => (a.order ?? 0) - (b.order ?? 0),
    );
    sorted.forEach((t, i) => {
      teams[t.id] = { ...t, order: t.order ?? i, memberIds: t.memberIds ?? [] };
    });
  }
  set({
    version: s.version ?? 1,
    staff,
    teams,
    roles: s.roles ?? initialState.roles,
    movements: s.movements ?? [],
  });
},
```

- [ ] **Step 7: Add movementTypeLabel entries**

Find the `movementTypeLabel` function and add cases for the new types:

```typescript
case "tag_add": return "Tag added";
case "tag_remove": return "Tag removed";
```

- [ ] **Step 8: Commit**

```bash
git add lib/store.ts
git commit -m "feat: add tag and team reorder store actions with migration"
```

---

### Task 3: Sort staff within teams by role then name

**Files:**
- Modify: `components/SquadsView.tsx`

- [ ] **Step 1: Add sort helper and apply in TeamBox**

In `SquadsView.tsx`, add a helper function before the `TeamBox` component:

```typescript
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
```

Add the `Staff` and `Role` imports from `@/lib/types` (they may already be there as `Team` and `TeamId`).

- [ ] **Step 2: Use the sort helper in TeamBox rendering**

Inside `TeamBox`, add store selectors for staff and roles:

```typescript
const allStaff = useStore((s) => s.staff);
const allRoles = useStore((s) => s.roles);
```

Replace the member rendering loop. Change:

```typescript
{team.memberIds.map((sid) => (
```

to:

```typescript
{sortMembersByRoleThenName(team.memberIds, allStaff, allRoles).map((sid) => (
```

- [ ] **Step 3: Commit**

```bash
git add components/SquadsView.tsx
git commit -m "feat: sort staff within teams by role then alphabetical name"
```

---

### Task 4: Team drag-to-reorder and reparent in SquadsView

**Files:**
- Modify: `components/SquadsView.tsx`

- [ ] **Step 1: Update imports**

Add to imports:

```typescript
import {
  SortableContext,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
```

Also import `DragStartEvent` from `@dnd-kit/core`.

- [ ] **Step 2: Update buildForest to sort by order**

Replace `buildForest`:

```typescript
function buildForest(teams: Record<TeamId, Team>): Tree[] {
  const childrenOf: Record<string, TeamId[]> = {};
  for (const t of Object.values(teams)) {
    const key = t.parentId ?? "__root__";
    (childrenOf[key] ??= []).push(t.id);
  }
  // Sort children by order
  for (const key of Object.keys(childrenOf)) {
    childrenOf[key].sort((a, b) => (teams[a]?.order ?? 0) - (teams[b]?.order ?? 0));
  }
  const build = (id: TeamId): Tree => ({
    ...teams[id],
    children: (childrenOf[id] ?? []).map(build),
  });
  return (childrenOf["__root__"] ?? []).map(build);
}
```

- [ ] **Step 3: Make TeamBox sortable**

Add `useSortable` to `TeamBox`. Change the component signature to also accept a `sortableId` prop:

At the top of `TeamBox`, add:

```typescript
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
```

Update the outermost `<div>` of TeamBox to merge refs and apply sort style:

```typescript
<div
  ref={(el) => {
    setRefs(el);
    setSortRef(el);
  }}
  style={sortStyle}
  className={...existing classes...}
>
```

Add a drag handle to the team header (before the team name):

```typescript
<button
  {...sortAttributes}
  {...sortListeners}
  className="cursor-grab active:cursor-grabbing text-slate-400 hover:text-slate-600 px-0.5"
  title="Drag to reorder"
>
  ⠿
</button>
```

- [ ] **Step 4: Wrap forest rendering in SortableContext**

In `SquadsView`, wrap the forest rendering:

```typescript
<SortableContext
  items={forest.map((t) => `sort-team-${t.id}`)}
  strategy={verticalListSortingStrategy}
>
  <div className="flex flex-wrap gap-3">
    {forest.map((t) => (
      <TeamBox key={t.id} team={t} />
    ))}
  </div>
</SortableContext>
```

Also wrap children inside `TeamBox`:

```typescript
{team.children.length > 0 && (
  <div className="mt-3 pl-3 border-l-2 border-slate-200 space-y-2">
    <SortableContext
      items={team.children.map((c) => `sort-team-${c.id}`)}
      strategy={verticalListSortingStrategy}
    >
      {team.children.map((c) => (
        <TeamBox key={c.id} team={c} />
      ))}
    </SortableContext>
  </div>
)}
```

- [ ] **Step 5: Update onDragEnd to handle team reorder**

Add `reorderTeams` and `reparentTeam` to the store selectors in `SquadsView`:

```typescript
const reorderTeams = useStore((s) => s.reorderTeams);
const reparentTeam = useStore((s) => s.reparentTeam);
```

Add state to track what's being dragged:

```typescript
const [activeKind, setActiveKind] = useState<"staff" | "team" | null>(null);
```

Add `onDragStart` handler:

```typescript
const onDragStart = (e: DragStartEvent) => {
  const data = e.active.data.current as { kind?: string } | undefined;
  setActiveKind(data?.kind === "team-sort" ? "team" : "staff");
};
```

Update `onDragEnd` — add team reorder logic at the top, before existing staff logic:

```typescript
const onDragEnd = (e: DragEndEvent) => {
  setActiveKind(null);
  const { active, over } = e;
  if (!over) return;

  const activeData = active.data.current as Record<string, unknown> | undefined;
  const overData = over.data.current as Record<string, unknown> | undefined;

  // Team reorder
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
        // Different parent — reparent into the over team's parent at that position
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

  // ... existing staff drag logic below (keep as-is) ...
```

Add `onDragStart` to the `DndContext`:

```typescript
<DndContext sensors={sensors} onDragStart={onDragStart} onDragEnd={onDragEnd}>
```

- [ ] **Step 6: Commit**

```bash
git add components/SquadsView.tsx
git commit -m "feat: drag-to-reorder and reparent teams in squads view"
```

---

### Task 5: Display tags on StaffBox

**Files:**
- Modify: `components/StaffBox.tsx`

- [ ] **Step 1: Render tag pills in non-compact mode**

In `StaffBox`, read tags from store:

```typescript
const tags = useStore((s) => s.staff[staffId]?.tags ?? []);
```

After the role label div (the `{!compact && role && ...}` block), add:

```typescript
{!compact && tags.length > 0 && (
  <div className="flex flex-wrap gap-0.5 mt-0.5">
    {tags.slice(0, 3).map((tag) => (
      <span
        key={tag}
        className="text-[8px] px-1 rounded bg-black/15"
      >
        {tag}
      </span>
    ))}
    {tags.length > 3 && (
      <span className="text-[8px] px-1 opacity-60">+{tags.length - 3}</span>
    )}
  </div>
)}
```

- [ ] **Step 2: Commit**

```bash
git add components/StaffBox.tsx
git commit -m "feat: show tag pills on staff boxes in non-compact mode"
```

---

### Task 6: Tag input in StaffDetailDrawer

**Files:**
- Modify: `components/StaffDetailDrawer.tsx`

- [ ] **Step 1: Add tag management section**

Add store selectors at the top of the component:

```typescript
const addTag = useStore((s) => s.addTag);
const removeTag = useStore((s) => s.removeTag);
const allTags = useStore((s) => {
  const set = new Set<string>();
  for (const st of Object.values(s.staff)) {
    for (const t of st.tags ?? []) set.add(t);
  }
  return Array.from(set).sort();
});
```

Add state for the tag input (inside the component, after existing state):

```typescript
const [tagInput, setTagInput] = useState("");
const [showTagSuggestions, setShowTagSuggestions] = useState(false);
```

Import `useState` (add it to the existing import from "react").

After the "Teams" section in the drawer (the section that shows team chips with remove buttons), add a Tags section:

```typescript
{/* Tags */}
<section>
  <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1">
    Tags
  </h3>
  <div className="flex flex-wrap gap-1 mb-2">
    {(staff.tags ?? []).map((tag) => (
      <span
        key={tag}
        className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded bg-slate-200 text-xs"
      >
        {tag}
        <button
          className="text-slate-400 hover:text-red-500"
          onClick={() => removeTag(staff.id, tag)}
        >
          ×
        </button>
      </span>
    ))}
  </div>
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
</section>
```

- [ ] **Step 2: Reset tag input state when staff selection changes**

Add a useEffect to reset tag input when selectedStaffId changes:

```typescript
useEffect(() => {
  setTagInput("");
  setShowTagSuggestions(false);
}, [selectedStaffId]);
```

- [ ] **Step 3: Commit**

```bash
git add components/StaffDetailDrawer.tsx
git commit -m "feat: add tag input with autocomplete in staff detail drawer"
```

---

### Task 7: Tags tab in Sidebar

**Files:**
- Modify: `components/Sidebar.tsx`

- [ ] **Step 1: Update sections to include tags**

Change the sections definition to include "tags" for non-guest users. Replace:

```typescript
const sections = user.role === "admin"
  ? (["staff", "roles", "membership", "users"] as const)
  : (["staff", "roles", "membership"] as const);
```

with:

```typescript
const sections = user.role === "admin"
  ? (["staff", "roles", "membership", "tags", "users"] as const)
  : (["staff", "roles", "membership", "tags"] as const);
```

- [ ] **Step 2: Add store selectors and state for tag management**

Add at the top of the Sidebar component (with other store selectors):

```typescript
const addTag = useStore((s) => s.addTag);
const removeTagFromAll = useStore((s) => s.removeTagFromAll);
```

Add state:

```typescript
const [newTag, setNewTag] = useState("");
```

Compute all tags with counts:

```typescript
const tagCounts = useMemo(() => {
  const counts: Record<string, number> = {};
  for (const s of Object.values(staff)) {
    for (const t of s.tags ?? []) {
      counts[t] = (counts[t] ?? 0) + 1;
    }
  }
  return Object.entries(counts).sort(([a], [b]) => a.localeCompare(b));
}, [staff]);
```

Import `useMemo` from "react" (add to existing import).

Also import `useSearch` from `@/lib/search`:

```typescript
import { useSearch } from "@/lib/search";
```

Inside the component:

```typescript
const { setQuery } = useSearch();
```

- [ ] **Step 3: Add the Tags section**

Before the users section (`{openSection === "users" && ...}`), add:

```typescript
{openSection === "tags" && (
  <div className="p-4 space-y-3 text-xs">
    <div className="flex gap-2">
      <input
        className="flex-1 border rounded px-2 py-1 text-sm"
        placeholder="New tag name"
        value={newTag}
        onChange={(e) => setNewTag(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter" && newTag.trim()) {
            // Tag will be created when assigned to a staff member
            setNewTag("");
          }
        }}
      />
    </div>
    <p className="text-slate-400">
      Tags are created by adding them to staff in their detail drawer.
      Click a tag below to search for staff with that tag.
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
```

- [ ] **Step 4: Commit**

```bash
git add components/Sidebar.tsx
git commit -m "feat: add tags tab in sidebar with search and bulk delete"
```

---

### Task 8: Search includes tags

**Files:**
- Modify: `lib/search.tsx`

- [ ] **Step 1: Update search matching to include tags**

In `search.tsx`, in the staff matching loop, change:

```typescript
const blob = `${s.name} ${role?.label ?? ""}`.toLowerCase();
if (blob.includes(q)) ms.add(s.id);
```

to:

```typescript
const tagStr = (s.tags ?? []).join(" ");
const blob = `${s.name} ${role?.label ?? ""} ${tagStr}`.toLowerCase();
if (blob.includes(q)) ms.add(s.id);
```

- [ ] **Step 2: Commit**

```bash
git add lib/search.tsx
git commit -m "feat: include tags in search matching"
```

---

### Task 9: Build verification and deploy

- [ ] **Step 1: Run type check**

Run: `npx tsc --noEmit`
Expected: No errors.

- [ ] **Step 2: Run build**

Run: `npm run build` (or deploy which runs build)

- [ ] **Step 3: Fix any errors**

If there are build errors, fix them.

- [ ] **Step 4: Deploy**

Run: `npx vercel --prod --yes`

- [ ] **Step 5: Verify**

1. Teams show sorted by order, drag handle appears on team headers
2. Drag a team to reorder within siblings
3. Drag a team onto another to reparent
4. Staff within teams are sorted by role then name
5. StaffBox shows tag pills in reporting view (non-compact)
6. StaffDetailDrawer has tag input with autocomplete
7. Sidebar has Tags tab listing all tags with counts
8. Clicking a tag in sidebar searches for it
9. Deleting a tag in sidebar removes it from all staff
10. Search finds staff by tag
