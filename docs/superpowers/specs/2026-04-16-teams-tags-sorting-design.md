# Teams Reordering, Staff Tags, and Role-Based Sorting Design

## Overview

Three enhancements to the staff movement tracker:
1. Drag-to-reorder and reparent team boxes in Squads view
2. Freeform tags on staff with autocomplete, search integration, and a sidebar Tags tab
3. Sort staff within each team by role then alphabetically

## 1. Rearrangeable Teams

### Data model
Add `order: number` to the `Team` type. Teams sort by `order` ascending within their parent group (siblings). New teams get `order = max sibling order + 1`.

### Interaction
- Team headers get a drag handle to distinguish from rename (double-click) and other team header buttons.
- Dragging a team between siblings at the same level reorders them (updates `order` values).
- Dropping a team onto another team reparents it (uses existing `reparentTeam` action, assigns order at end of new parent's children).
- Uses the existing `@dnd-kit` DndContext in SquadsView, extended to support both staff and team draggables/droppables. Differentiated by `data.kind` field (`"staff"` vs `"team-reorder"` vs `"team-reparent"`).

### Sorting
`buildForest` sorts children by `order` ascending. Existing teams without `order` get assigned sequential orders on first load.

## 2. Staff Tags

### Data model
Add `tags: string[]` to the `Staff` type. Stored lowercase, trimmed, deduplicated.

### Tag input (StaffDetailDrawer)
- Text field with autocomplete dropdown showing all tags used across any staff.
- Type to filter existing tags, Enter to add (new or selected), × on each pill to remove.
- Adding/removing a tag records a movement (type: `"tag_add"` / `"tag_remove"`).

### Tags on StaffBox
- In non-compact mode, show tag pills below the role label. Small, semi-transparent background, truncated if too many.
- In compact mode (inside team boxes), tags are hidden to keep cards small.

### Search integration
The search system (`lib/search.tsx`) matches against `staff.tags` in addition to name, team name, etc. A staff member matches if any tag contains the query substring.

### Sidebar Tags tab
- New tab in the sidebar (visible to all logged-in users, not guests).
- Lists all tags currently in use, each with a count of staff who have it.
- Click a tag to set it as the search query (highlights those staff across all views).
- Add a tag to multiple staff at once: select a tag, then pick staff from a dropdown.
- Delete a tag: removes it from all staff who have it (with confirmation).

### Movement types
Add `"tag_add"` and `"tag_remove"` to `MovementType`. Recorded with `staffId`, `toLabel` (tag name) for add, `fromLabel` (tag name) for remove.

## 3. Sort Staff Within Teams by Role Then Name

In `SquadsView`'s `TeamBox`, the `memberIds` rendering is sorted by:
1. Role order — the index of the role in the roles object (Engineer=0, EM=1, PM=2, etc.)
2. Alphabetical name within each role group

No visual separators between groups — the natural clustering by role color is sufficient.

This is a display-only sort; it does not modify `memberIds` in the store.

## Files affected

### Modified
- `lib/types.ts` — add `order` to Team, `tags` to Staff, new MovementTypes
- `lib/store.ts` — tag actions (`addTag`, `removeTag`), team reorder action, sorting helpers, migration for existing teams without `order`
- `lib/search.tsx` — include tags in matching
- `components/SquadsView.tsx` — team drag-to-reorder/reparent, sort staff by role+name
- `components/StaffBox.tsx` — render tag pills in non-compact mode
- `components/StaffDetailDrawer.tsx` — tag input with autocomplete
- `components/Sidebar.tsx` — add Tags tab

### New
- (none — all changes fit into existing files)
