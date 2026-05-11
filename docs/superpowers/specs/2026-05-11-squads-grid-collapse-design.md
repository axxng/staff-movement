# Squads Grid + Collapse

## Problem

The squads view renders all teams as a flat vertical list with all members always visible. With 8+ teams, the page becomes a long scroll that makes it hard to get an overview or focus on specific teams.

## Solution

Two changes to the SquadsView: a responsive CSS grid layout, and per-team collapsible cards with a summary view.

## Design

### Grid Layout

Replace the current `flex flex-wrap gap-3` container for root-level teams with a responsive CSS grid:
- 1 column on small screens
- 2 columns on medium screens (`md`)
- 3 columns on wide screens (`xl`)

Sub-teams remain nested inside their parent card with the existing left-border indent — they do not become separate grid items.

### Collapse Behavior

Each TeamBox gets a chevron toggle (▶/▼) in the header bar, next to the drag handle.

**Collapsed state:**
- Hides the member StaffBox list
- Hides nested sub-team cards
- Shows a row of small role-colored dots (8px circles, one per member) as a composition summary
- If the team has sub-teams, shows a "+N sub" label in the header

**Expanded state:**
- Shows members and sub-teams exactly as current behavior
- No change to existing rendering

**Defaults:**
- All teams start collapsed
- Each sub-team has its own independent collapse toggle

### Expand All / Collapse All

A single toggle button in the header bar, next to the existing "+ Team" button.
- Label reads "Expand All" when any teams are collapsed
- Label reads "Collapse All" when all teams are expanded
- Clicking toggles all teams (including sub-teams) at once

### Drag-Drop Interaction

- Dropping staff onto a collapsed team works — the droppable zone covers the entire card
- Dragging staff out of a team requires the team to be expanded (members must be visible to grab them)
- No change to team reordering drag behavior

### State Management

Collapse state is local UI state — a `Set<TeamId>` tracking which teams are expanded. Stored in component state via `useState`, not persisted to the Zustand store or localStorage.

## Scope

### In scope
- Grid layout for root-level teams in SquadsView
- Collapse/expand toggle per TeamBox
- Role-colored dots summary in collapsed state
- Expand All / Collapse All button in header

### Out of scope
- Persisting collapse state across page reloads
- Changing the UnassignedZone layout
- Changing StaffBox rendering
- Any changes to the data model or store
