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
import StaffBox from "./StaffBox";
import ExportButton from "./ExportButton";
import type { StaffId } from "@/lib/types";

type Node = {
  id: StaffId;
  children: Node[];
};

function buildTree(staffMap: Record<string, { id: string; managerId: string | null }>): {
  roots: Node[];
} {
  const childrenOf: Record<string, StaffId[]> = {};
  const all = Object.values(staffMap);
  for (const s of all) {
    const key = s.managerId ?? "__root__";
    (childrenOf[key] ??= []).push(s.id);
  }
  const build = (id: StaffId): Node => ({
    id,
    children: (childrenOf[id] ?? [])
      .slice()
      .sort((a, b) => staffMap[a].id.localeCompare(staffMap[b].id))
      .map(build),
  });
  const roots = (childrenOf["__root__"] ?? []).map(build);
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
        Top of the org (drop here to clear manager)
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
  const setManager = useStore((s) => s.setManager);
  const exportRef = useRef<HTMLDivElement>(null);

  const { roots } = useMemo(() => buildTree(staff), [staff]);

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 4 } }));

  const onDragEnd = (e: DragEndEvent) => {
    const { active, over } = e;
    if (!over) return;
    const data = over.data.current as { kind?: string; managerId?: string | null } | undefined;
    if (data?.kind !== "manager") return;
    const staffId = (active.data.current as { staffId?: string } | undefined)?.staffId;
    if (!staffId) return;
    setManager(staffId, data.managerId ?? null);
  };

  const isEmpty = Object.keys(staff).length === 0;

  return (
    <DndContext sensors={sensors} onDragEnd={onDragEnd}>
      <div className="flex items-center justify-between mb-3">
        <div>
          <h2 className="text-lg font-semibold">Reporting lines</h2>
          <p className="text-sm text-slate-500">
            Drag a person onto another to make them their manager. Drop on the top zone to clear.
          </p>
        </div>
        <ExportButton targetRef={exportRef} filename="reporting-lines" />
      </div>

      <div ref={exportRef} className="export-safe bg-white rounded-xl p-6 overflow-auto">
        {isEmpty ? (
          <div className="text-slate-400 text-center py-12">
            No staff yet — add some from the sidebar.
          </div>
        ) : (
          <>
            <RootDrop>
              <ul className="org-tree flex flex-wrap gap-3 justify-center">
                {roots.map((r) => (
                  <TreeNode key={r.id} node={r} />
                ))}
              </ul>
            </RootDrop>
          </>
        )}
      </div>
    </DndContext>
  );
}
