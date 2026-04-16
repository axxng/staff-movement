"use client";

import { useDraggable } from "@dnd-kit/core";
import { useStore } from "@/lib/store";
import { useUI } from "@/lib/ui";
import { useSearch } from "@/lib/search";
import { contrastText } from "@/lib/utils";

type Props = {
  staffId: string;
  dragId: string; // unique drag id (may include source context)
  payload?: Record<string, unknown>;
  compact?: boolean;
  onClick?: () => void;
};

export default function StaffBox({ staffId, dragId, payload, compact, onClick }: Props) {
  const staff = useStore((s) => s.staff[staffId]);
  const role = useStore((s) => (staff ? s.roles[staff.roleId] : undefined));
  const tags = useStore((s) => s.staff[staffId]?.tags ?? []);
  const selectStaff = useUI((s) => s.selectStaff);
  const isMultiSelected = useUI((s) => s.multiSelected.has(staffId));
  const toggleMultiSelect = useUI((s) => s.toggleMultiSelect);
  const addToMultiSelect = useUI((s) => s.addToMultiSelect);
  const { hasQuery, matchedStaff } = useSearch();

  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: dragId,
    data: { staffId, ...payload },
  });

  if (!staff) return null;

  const bg = role?.color ?? "#64748b";
  const fg = contrastText(bg);
  const dimmed = hasQuery && !matchedStaff.has(staffId);
  const highlighted = hasQuery && matchedStaff.has(staffId);

  const handleClick = (e: React.MouseEvent) => {
    if (e.ctrlKey || e.metaKey) {
      e.stopPropagation();
      toggleMultiSelect(staffId);
      return;
    }
    if (onClick) {
      onClick();
    } else {
      selectStaff(staffId);
    }
  };

  const handleDragStart = () => {
    // If dragging a non-selected item, include it in the selection
    if (!isMultiSelected && useUI.getState().multiSelected.size > 0) {
      addToMultiSelect(staffId);
    }
  };

  return (
    <div
      ref={setNodeRef}
      {...listeners}
      {...attributes}
      onClick={handleClick}
      onDragStart={handleDragStart}
      className={`select-none cursor-grab active:cursor-grabbing rounded-lg shadow-sm border transition-all ${
        compact ? "px-2 py-1 text-xs" : "px-3 py-2 text-sm"
      } ${isDragging ? "opacity-40" : ""} ${dimmed ? "opacity-25" : ""} ${
        highlighted ? "ring-2 ring-amber-400 ring-offset-1" : ""
      } ${isMultiSelected ? "ring-2 ring-blue-500 ring-offset-1 border-blue-500" : "border-black/10"}`}
      style={{ backgroundColor: bg, color: fg, minWidth: compact ? 80 : 120 }}
      title={`${staff.name} — ${role?.label ?? ""}${isMultiSelected ? " (selected)" : ""}`}
    >
      <div className="font-semibold leading-tight whitespace-nowrap">{staff.name}</div>
      {!compact && role && (
        <div className="text-[10px] opacity-80 leading-tight">{role.label}</div>
      )}
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
    </div>
  );
}
