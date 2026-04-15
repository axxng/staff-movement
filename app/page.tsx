"use client";

import { useEffect, useState } from "react";
import Sidebar from "@/components/Sidebar";
import ReportingView from "@/components/ReportingView";
import SquadsView from "@/components/SquadsView";
import HistoryView from "@/components/HistoryView";
import BackupBar from "@/components/BackupBar";
import SyncIndicator from "@/components/SyncIndicator";
import PasswordPrompt from "@/components/PasswordPrompt";
import StaffDetailDrawer from "@/components/StaffDetailDrawer";
import { useStore, useTemporal } from "@/lib/store";
import { fetchConfig, useSync, type SyncConfig } from "@/lib/sync";
import { SearchProvider, useSearch } from "@/lib/search";

type Tab = "reporting" | "squads" | "history";

const PW_KEY = "staff-movement-password";

function HeaderSearch() {
  const { query, setQuery } = useSearch();
  return (
    <input
      className="text-sm border rounded px-3 py-1.5 w-56"
      placeholder="Search people or teams…"
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
        ↶ Undo
      </button>
      <button
        className="px-2 py-1.5 text-xs rounded-md border border-slate-300 hover:bg-slate-100 disabled:opacity-40"
        onClick={() => useStore.temporal.getState().redo()}
        disabled={futureStates === 0}
        title="Redo (Ctrl/Cmd+Shift+Z)"
      >
        ↷ Redo
      </button>
    </div>
  );
}

function PageInner() {
  const [tab, setTab] = useState<Tab>("squads");
  const [hydrated, setHydrated] = useState(false);
  const [config, setConfig] = useState<SyncConfig | null>(null);
  const [password, setPassword] = useState<string | null>(null);

  useEffect(() => {
    setHydrated(true);
    setPassword(localStorage.getItem(PW_KEY));
    fetchConfig().then(setConfig);
    // Persist hydration counts as a "set" inside zundo. Clear the
    // initial entry so the user can't undo themselves back to empty.
    useStore.temporal.getState().clear();
  }, []);

  const sync = useSync({ enabled: hydrated, config, password });

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

  const handlePasswordSubmit = (pw: string) => {
    localStorage.setItem(PW_KEY, pw);
    setPassword(pw);
  };

  const signOut = () => {
    localStorage.removeItem(PW_KEY);
    setPassword(null);
  };

  const showPasswordModal =
    hydrated &&
    config?.hasStorage &&
    config.authRequired &&
    !password &&
    sync.status === "auth-required";

  return (
    <div className="flex min-h-screen">
      <Sidebar />
      <main className="flex-1 min-w-0 flex flex-col">
        <header className="border-b bg-white px-6 py-3 flex items-center justify-between gap-3 flex-wrap">
          <div className="flex gap-1">
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
          <div className="flex items-center gap-3 flex-wrap">
            <HeaderSearch />
            <UndoRedoButtons />
            <div className="text-xs text-slate-500">
              {hydrated
                ? `${totals.staff} staff · ${totals.teams} teams · ${totals.movements} events`
                : "…"}
            </div>
            <SyncIndicator
              status={sync.status}
              lastSyncedAt={sync.lastSyncedAt}
              onClick={sync.forceSync}
            />
            {password && (
              <button
                className="text-xs text-slate-500 hover:text-slate-900"
                onClick={signOut}
                title="Forget password on this device"
              >
                Sign out
              </button>
            )}
            {hydrated && totals.staff === 0 && totals.teams === 0 && (
              <button
                className="px-3 py-1.5 text-xs rounded-md border border-slate-300 hover:bg-slate-100"
                onClick={seedSample}
              >
                Load sample
              </button>
            )}
            <BackupBar />
          </div>
        </header>

        <section className="flex-1 p-6 overflow-auto">
          {!hydrated ? (
            <div className="text-slate-400 text-sm">Loading…</div>
          ) : tab === "squads" ? (
            <SquadsView />
          ) : tab === "reporting" ? (
            <ReportingView />
          ) : (
            <HistoryView />
          )}
        </section>
      </main>

      {showPasswordModal && <PasswordPrompt onSubmit={handlePasswordSubmit} />}
      <StaffDetailDrawer />
    </div>
  );
}

export default function Home() {
  return (
    <SearchProvider>
      <PageInner />
    </SearchProvider>
  );
}
