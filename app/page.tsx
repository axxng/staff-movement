"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Sidebar from "@/components/Sidebar";
import ReportingView from "@/components/ReportingView";
import SquadsView from "@/components/SquadsView";
import HistoryView from "@/components/HistoryView";
import BackupBar from "@/components/BackupBar";
import SyncIndicator from "@/components/SyncIndicator";
import StaffDetailDrawer from "@/components/StaffDetailDrawer";
import { useStore, useTemporal, setCurrentActor } from "@/lib/store";
import { fetchConfig, useSync, type SyncConfig } from "@/lib/sync";
import { SearchProvider, useSearch } from "@/lib/search";
import { useUI } from "@/lib/ui";
import { ReadOnlyProvider } from "@/lib/readonly";
import type { SessionUser } from "@/lib/types";

type Tab = "reporting" | "squads" | "history";

function HeaderSearch() {
  const { query, setQuery } = useSearch();
  return (
    <input
      className="text-sm border rounded px-3 py-1.5 w-40 sm:w-56"
      placeholder="Search..."
      value={query}
      onChange={(e) => setQuery(e.target.value)}
    />
  );
}

function UndoRedoButtons() {
  const pastStates = useTemporal((s) => s.pastStates.length);
  const futureStates = useTemporal((s) => s.futureStates.length);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const isMac = navigator.platform.toLowerCase().includes("mac");
      const mod = isMac ? e.metaKey : e.ctrlKey;
      if (!mod) return;
      const k = e.key.toLowerCase();
      if (k === "z" && !e.shiftKey) {
        e.preventDefault();
        useStore.temporal.getState().undo();
      } else if ((k === "z" && e.shiftKey) || k === "y") {
        e.preventDefault();
        useStore.temporal.getState().redo();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  return (
    <div className="flex gap-1">
      <button
        className="px-2 py-1.5 text-xs rounded-md border border-slate-300 hover:bg-slate-100 disabled:opacity-40"
        onClick={() => useStore.temporal.getState().undo()}
        disabled={pastStates === 0}
        title="Undo (Ctrl/Cmd+Z)"
      >
        Undo
      </button>
      <button
        className="px-2 py-1.5 text-xs rounded-md border border-slate-300 hover:bg-slate-100 disabled:opacity-40"
        onClick={() => useStore.temporal.getState().redo()}
        disabled={futureStates === 0}
        title="Redo (Ctrl/Cmd+Shift+Z)"
      >
        Redo
      </button>
    </div>
  );
}

function SelectionBadge() {
  const count = useUI((s) => s.multiSelected.size);
  const clear = useUI((s) => s.clearMultiSelect);
  if (count === 0) return null;
  return (
    <div className="flex items-center gap-1 px-2 py-1 text-xs bg-blue-100 text-blue-700 rounded-md">
      <span>{count} selected</span>
      <button
        className="ml-1 hover:text-blue-900"
        onClick={clear}
        title="Clear selection"
      >
        ×
      </button>
    </div>
  );
}

const GUEST_USER: SessionUser = { username: "Guest", role: "guest" };

function PageInner({ user }: { user: SessionUser }) {
  const router = useRouter();
  const [tab, setTab] = useState<Tab>("squads");
  const [hydrated, setHydrated] = useState(false);
  const [config, setConfig] = useState<SyncConfig | null>(null);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const isGuest = user.role === "guest";

  useEffect(() => {
    setHydrated(true);
    fetchConfig().then(setConfig);
    useStore.temporal.getState().clear();
  }, []);

  const sync = useSync({ enabled: hydrated, config });

  // If sync gets a 401 and user is not a guest, redirect to login
  useEffect(() => {
    if (sync.status === "auth-required" && !isGuest) {
      router.replace("/login");
    }
  }, [sync.status, router, isGuest]);

  const totals = useStore((s) => ({
    staff: Object.keys(s.staff).length,
    teams: Object.keys(s.teams).length,
    movements: s.movements.length,
  }));

  const seedSample = () => {
    const { addStaff, addTeam, addStaffToTeam } = useStore.getState();
    const dir = addStaff({ name: "Avery Director", roleId: "director" });
    const em1 = addStaff({ name: "Sam EM", roleId: "em", managerId: dir });
    const em2 = addStaff({ name: "Jules EM", roleId: "em", managerId: dir });
    const e1 = addStaff({ name: "Riley Eng", roleId: "engineer", managerId: em1 });
    const e2 = addStaff({ name: "Quinn Eng", roleId: "engineer", managerId: em1 });
    const e3 = addStaff({ name: "Morgan Eng", roleId: "engineer", managerId: em2 });
    const pm = addStaff({ name: "Casey PM", roleId: "pm", managerId: dir });
    const des = addStaff({ name: "Drew Designer", roleId: "designer", managerId: dir });
    const platform = addTeam({ name: "Platform" });
    const growth = addTeam({ name: "Growth" });
    const api = addTeam({ name: "API", parentId: platform });
    const infra = addTeam({ name: "Infra", parentId: platform });
    addTeam({ name: "Edge", parentId: infra });
    addStaffToTeam(e1, api);
    addStaffToTeam(e2, infra);
    addStaffToTeam(e3, growth);
    addStaffToTeam(pm, growth);
    addStaffToTeam(des, growth);
    addStaffToTeam(des, platform);
  };

  const signOut = async () => {
    await fetch("/api/auth/logout", { method: "POST" });
    router.replace("/login");
  };

  return (
    <div className="flex min-h-screen">
      {!isGuest && <Sidebar user={user} open={sidebarOpen} onClose={() => setSidebarOpen(false)} />}
      <main className="flex-1 min-w-0 flex flex-col">
        <header className="border-b bg-white px-4 sm:px-6 py-3 flex items-center justify-between gap-2 sm:gap-3 flex-wrap">
          <div className="flex items-center gap-2">
            {!isGuest && (
              <button
                className="xl:hidden text-slate-600 hover:text-slate-900 p-1"
                onClick={() => setSidebarOpen(true)}
                title="Open sidebar"
              >
                <svg width="20" height="20" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M3 5a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm0 5a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm0 5a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1z" clipRule="evenodd" />
                </svg>
              </button>
            )}
            {(["squads", "reporting", "history"] as const).map((t) => (
              <button
                key={t}
                onClick={() => setTab(t)}
                className={`px-3 py-1.5 text-sm rounded-md capitalize ${
                  tab === t
                    ? "bg-slate-900 text-white"
                    : "text-slate-600 hover:bg-slate-100"
                }`}
              >
                {t}
              </button>
            ))}
          </div>
          <div className="flex items-center gap-2 sm:gap-3 flex-wrap">
            <SelectionBadge />
            <HeaderSearch />
            {!isGuest && <UndoRedoButtons />}
            <div className="text-xs text-slate-500 hidden sm:block">
              {hydrated
                ? `${totals.staff} staff \u00b7 ${totals.teams} teams \u00b7 ${totals.movements} events`
                : "\u2026"}
            </div>
            {!isGuest && (
              <SyncIndicator
                status={sync.status}
                lastSyncedAt={sync.lastSyncedAt}
                onClick={sync.forceSync}
              />
            )}
            {isGuest ? (
              <div className="flex items-center gap-2">
                <span className="text-xs text-slate-500">Viewing as guest</span>
                <button
                  className="px-2.5 py-1.5 text-xs rounded-md border border-slate-300 hover:bg-slate-100"
                  onClick={() => router.push("/login")}
                >
                  Sign in
                </button>
              </div>
            ) : (
              <div className="flex items-center gap-2">
                <span className="text-xs text-slate-500 hidden sm:inline">{user.username}</span>
                <button
                  className="px-2.5 py-1.5 text-xs rounded-md border border-slate-300 hover:bg-slate-100"
                  onClick={signOut}
                >
                  Sign out
                </button>
              </div>
            )}
            {!isGuest && hydrated && totals.staff === 0 && totals.teams === 0 && (
              <button
                className="px-3 py-1.5 text-xs rounded-md border border-slate-300 hover:bg-slate-100"
                onClick={seedSample}
              >
                Load sample
              </button>
            )}
            {!isGuest && <BackupBar />}
          </div>
        </header>

        <section className="flex-1 p-3 sm:p-6 overflow-auto">
          {!hydrated ? (
            <div className="text-slate-400 text-sm">Loading...</div>
          ) : tab === "squads" ? (
            <SquadsView />
          ) : tab === "reporting" ? (
            <ReportingView />
          ) : (
            <HistoryView />
          )}
        </section>
      </main>

      <StaffDetailDrawer />
    </div>
  );
}

export default function Home() {
  const [user, setUser] = useState<SessionUser | null>(null);
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    fetch("/api/auth/me")
      .then((res) => {
        if (!res.ok) throw new Error("not authed");
        return res.json();
      })
      .then((data: SessionUser) => {
        setCurrentActor(data.username);
        setUser(data);
        setChecking(false);
      })
      .catch(() => {
        setCurrentActor(undefined);
        setUser(GUEST_USER);
        setChecking(false);
      });
  }, []);

  if (checking || !user) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-sm text-slate-400">Loading...</div>
      </div>
    );
  }

  return (
    <ReadOnlyProvider readOnly={user.role === "guest"}>
      <SearchProvider>
        <PageInner user={user} />
      </SearchProvider>
    </ReadOnlyProvider>
  );
}
