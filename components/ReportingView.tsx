"use client";

import { useMemo, useRef } from "react";
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
import StaffBox from "./StaffBox";
import ExportButton from "./ExportButton";
import type { Staff, Role, StaffId } from "@/lib/types";

type Node = {
  id: StaffId;
  children: Node[];
};

function buildTree(
  staffMap: Record<string, Staff>,
  roles: Record<string, Role>,
): { roots: Node[] } {
  const childrenOf: Record<string, StaffId[]> = {};
  const all = Object.values(staffMap);
  for (const s of all) {
    const key = s.managerId ?? "__root__";
    (childrenOf[key] ??= []).push(s.id);
  }
  const roleOrder = Object.keys(roles);
  const sortByRoleThenName = (ids: StaffId[]) =>
    ids.slice().sort((a, b) => {
      const sa = staffMap[a];
      const sb = staffMap[b];
      if (!sa || !sb) return 0;
      const ra = roleOrder.indexOf(sa.roleId);
      const rb = roleOrder.indexOf(sb.roleId);
      if (ra !== rb) return (ra === -1 ? 999 : ra) - (rb === -1 ? 999 : rb);
      return sa.name.localeCompare(sb.name);
    });
  const build = (id: StaffId): Node => ({
    id,
    children: sortByRoleThenName(childrenOf[id] ?? []).map(build),
  });
  const roots = sortByRoleThenName(childrenOf["__root__"] ?? []).map(build);
  return { roots };
}

function DroppableStaff({
  staffId,
  children,
}: {
  staffId: string;
  children: React.ReactNode;
}) {
  const { setNodeRef, isOver } = useDroppable({
    id: `manager-drop-${staffId}`,
    data: { kind: "manager", managerId: staffId },
  });
  return (
    <div
      ref={setNodeRef}
      className={`inline-block rounded-lg ${
        isOver ? "ring-2 ring-blue-500 ring-offset-2" : ""
      }`}
    >
      {children}
    </div>
  );
}

function RootDrop({ children }: { children: React.ReactNode }) {
  const { setNodeRef, isOver } = useDroppable({
    id: "manager-drop-root",
    data: { kind: "manager", managerId: null },
  });
  return (
    <div
      ref={setNodeRef}
      className={`min-h-[120px] p-4 rounded-xl border-2 border-dashed ${
        isOver ? "border-blue-500 bg-blue-50" : "border-slate-300 bg-white"
      }`}
    >
      <div className="text-xs uppercase tracking-wide text-slate-500 mb-2">
        Unassigned (drop here to clear manager)
      </div>
      {children}
    </div>
  );
}

function TreeNode({ node }: { node: Node }) {
  return (
    <li>
      <div className="node-wrap">
        <DroppableStaff staffId={node.id}>
          <StaffBox staffId={node.id} dragId={`reporting-${node.id}`} />
        </DroppableStaff>
      </div>
      {node.children.length > 0 && (
        <ul>
          {node.children.map((c) => (
            <TreeNode key={c.id} node={c} />
          ))}
        </ul>
      )}
    </li>
  );
}

export default function ReportingView() {
  const staff = useStore((s) => s.staff);
  const roles = useStore((s) => s.roles);
  const setManager = useStore((s) => s.setManager);
  const exportRef = useRef<HTMLDivElement>(null);

  const { roots } = useMemo(() => buildTree(staff, roles), [staff, roles]);

  // Separate roots into org leaders (have reports) and unassigned (no reports, no manager)
  const { leaders, unassigned } = useMemo(() => {
    const leaders: Node[] = [];
    const unassigned: Node[] = [];
    for (const r of roots) {
      if (r.children.length > 0) {
        leaders.push(r);
      } else {
        unassigned.push(r);
      }
    }
    return { leaders, unassigned };
  }, [roots]);

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 4 } }));

  const onDragEnd = (e: DragEndEvent) => {
    const { active, over } = e;
    if (!over) return;
    const data = over.data.current as { kind?: string; managerId?: string | null } | undefined;
    if (data?.kind !== "manager") return;
    const draggedId = (active.data.current as { staffId?: string } | undefined)?.staffId;
    if (!draggedId) return;

    const { multiSelected, clearMultiSelect } = useUI.getState();
    const staffIds = multiSelected.size > 0 && multiSelected.has(draggedId)
      ? Array.from(multiSelected)
      : [draggedId];

    for (const staffId of staffIds) {
      setManager(staffId, data.managerId ?? null);
    }

    clearMultiSelect();
  };

  const isEmpty = Object.keys(staff).length === 0;

  return (
    <DndContext sensors={sensors} onDragEnd={onDragEnd}>
      <div className="flex items-center justify-between mb-3">
        <div>
          <h2 className="text-lg font-semibold">Reporting lines</h2>
          <p className="text-sm text-slate-500">
            Drag a person onto another to make them their manager. Drop on the dashed zone to clear.
          </p>
        </div>
        <ExportButton targetRef={exportRef} filename="reporting-lines" />
      </div>

      <div ref={exportRef} className="export-safe space-y-4 overflow-auto">
        {isEmpty ? (
          <div className="text-slate-400 text-center py-12">
            No staff yet — add some from the sidebar.
          </div>
        ) : (
          <>
            {leaders.map((r) => (
              <div
                key={r.id}
                className="bg-white rounded-xl border border-slate-200 p-4 sm:p-6 overflow-x-auto"
              >
                <div className="min-w-fit w-full flex justify-center">
                  <ul className="org-tree inline-flex gap-3">
                    <TreeNode node={r} />
                  </ul>
                </div>
              </div>
            ))}

            {/* Unassigned — no manager, no reports */}
            <RootDrop>
              {unassigned.length === 0 ? (
                <div className="text-xs text-slate-400 italic">
                  Everyone has a manager or reports — drop here to unassign.
                </div>
              ) : (
                <div className="flex flex-wrap gap-2">
                  {unassigned.map((r) => (
                    <DroppableStaff key={r.id} staffId={r.id}>
                      <StaffBox staffId={r.id} dragId={`reporting-${r.id}`} />
                    </DroppableStaff>
                  ))}
                </div>
              )}
            </RootDrop>
          </>
        )}
      </div>
    </DndContext>
  );
}
