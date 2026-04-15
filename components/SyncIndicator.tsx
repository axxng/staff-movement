"use client";

import type { SyncStatus } from "@/lib/sync";

const STATUS_META: Record<
  SyncStatus,
  { label: string; dot: string; tip: string }
> = {
  idle: { label: "—", dot: "bg-slate-300", tip: "Not started" },
  loading: { label: "Loading…", dot: "bg-blue-400 animate-pulse", tip: "Loading from server" },
  syncing: { label: "Syncing…", dot: "bg-blue-500 animate-pulse", tip: "Saving to server" },
  saved: { label: "Synced", dot: "bg-green-500", tip: "Up to date with server" },
  error: { label: "Sync error", dot: "bg-red-500", tip: "Failed to reach the server (will retry on next change)" },
  offline: { label: "Offline", dot: "bg-slate-400", tip: "Network unavailable" },
  "auth-required": { label: "Locked", dot: "bg-amber-500", tip: "Password required" },
  "local-only": { label: "Local only", dot: "bg-slate-400", tip: "Server storage not configured — data lives in this browser only" },
};

export default function SyncIndicator({
  status,
  lastSyncedAt,
  onClick,
}: {
  status: SyncStatus;
  lastSyncedAt: number | null;
  onClick?: () => void;
}) {
  const meta = STATUS_META[status];
  const ts =
    lastSyncedAt && status === "saved"
      ? `· ${new Date(lastSyncedAt).toLocaleTimeString()}`
      : "";
  return (
    <button
      onClick={onClick}
      title={meta.tip}
      className="flex items-center gap-1.5 text-xs text-slate-600 hover:text-slate-900"
    >
      <span className={`w-2 h-2 rounded-full ${meta.dot}`} />
      <span>
        {meta.label} {ts}
      </span>
    </button>
  );
}
