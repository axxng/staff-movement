# Squads Tree View

## Problem

The squads view only offers a nested card/grid layout. For larger org structures, an org-chart-style tree view makes it easier to visualize the full team hierarchy at a glance with clear parent-child relationships shown through connecting lines.

## Solution

Add a sub-tab system within the Squads top-level tab. Two sub-tabs — "Nested" (current grid/card view) and "Tree" (new org-chart view) — let users switch between layouts without leaving the Squads context.

## Design

### Sub-Tab Navigation

The Squads tab gains two sub-tabs rendered just below the main tab bar:
- **Nested** — the current SquadsView grid layout (default)
- **Tree** — the new org-chart tree layout

Sub-tab state is local component state (`useState`), not persisted. Switching sub-tabs preserves search query and other shared state.

### Tree Layout

The tree renders top-down, similar to ReportingView's org-chart style:
- Root teams sit at the top row
- Child teams branch downward with CSS connector lines (vertical + horizontal)
- Connector line styles reuse the same approach as ReportingView in `globals.css`

Each team renders as a card containing:
- Team name header with member count
- Staff members listed inside using the existing `StaffBox` component
- Sub-teams rendered as child nodes below, connected by lines

The entire tree wraps in a scrollable container (both horizontal and vertical) to handle wide hierarchies.

### Expand/Collapse

Teams can be collapsed to hide their **sub-tree** (child teams and their descendants). Collapsing a team does not hide the staff within that team node — only the branches below it.

A collapsed team shows an indicator (e.g., chevron or "+N sub-teams") to signal hidden children.

Collapse state is a local `Set<TeamId>` via `useState`, same pattern as the nested view.

### Search Integration

Same search behavior as the nested view:
- Matched staff and teams are highlighted
- Non-matches are dimmed
- Uses the existing `SearchProvider` context

### Drag & Drop

Same interactions as the nested view, using `@dnd-kit`:
- Drag staff between teams
- Drag teams to reparent under a different parent
- Multi-select drag (Ctrl+Click)
- Drop on "Unassigned" zone at the top
- All drag actions disabled in read-only mode

### Permissions

Identical to the current nested view. Drag handles and mutation actions (add team, delete, rename) are hidden when not logged in. No new permission logic.

### Unassigned Staff

An "Unassigned" zone renders above the tree (same as the nested view) for staff not belonging to any team. Acts as a drop target.

## Components

### Modified
- **`SquadsView.tsx`** — adds sub-tab state and conditional rendering. Shared utilities (`buildForest`, `sortMembersByRoleThenName`) are extracted to a shared module so both views can use them.

### New
- **`SquadsTreeView.tsx`** — the org-chart tree layout component. Receives the forest (tree data), staff, roles, and handlers as props. Contains its own DndContext wrapping the tree.
- **`lib/squad-utils.ts`** — extracted `buildForest`, `sortMembersByRoleThenName`, `collectTeamIds`, and the `Tree` type.

### Reused (no changes)
- `StaffBox` — staff card rendering
- `ExportButton` — PNG export (works on whichever sub-tab is active)
- `StaffDetailDrawer` — staff detail side panel
- `lib/search.tsx` — search context
- `lib/readonly.tsx` — read-only context
- `lib/store.ts` — Zustand store (no schema changes)

## CSS

Tree connector lines added to `globals.css`, following the same pattern as the existing ReportingView connectors. Styles use `border-left`, `border-top`, and pseudo-elements for the L-shaped and T-shaped connectors.

## Scope

### In scope
- Sub-tab navigation within Squads tab (Nested / Tree)
- Org-chart tree rendering with CSS connector lines
- Staff displayed inside team nodes
- Expand/collapse sub-trees
- Drag-and-drop (staff between teams, reparent teams, multi-select)
- Search highlighting/dimming
- Read-only mode support
- Unassigned staff zone
- Export as PNG

### Out of scope
- Persisting sub-tab or collapse state across page reloads
- Zoom/pan controls
- Minimap or overview panel
- Any changes to the data model or Zustand store schema
- Changes to ReportingView or HistoryView
