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
  const selectStaff = useUI((s) => s.selectStaff);
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

  return (
    <div
      ref={setNodeRef}
      {...listeners}
      {...attributes}
      onClick={onClick ?? (() => selectStaff(staffId))}
      className={`select-none cursor-grab active:cursor-grabbing rounded-lg shadow-sm border border-black/10 transition-all ${
        compact ? "px-2 py-1 text-xs" : "px-3 py-2 text-sm"
      } ${isDragging ? "opacity-40" : ""} ${dimmed ? "opacity-25" : ""} ${
        highlighted ? "ring-2 ring-amber-400 ring-offset-1" : ""
      }`}
      style={{ backgroundColor: bg, color: fg, minWidth: compact ? 80 : 120 }}
      title={`${staff.name} — ${role?.label ?? ""}`}
    >
      <div className="font-semibold leading-tight whitespace-nowrap">{staff.name}</div>
      {!compact && role && (
        <div className="text-[10px] opacity-80 leading-tight">{role.label}</div>
      )}
    </div>
  );
}
