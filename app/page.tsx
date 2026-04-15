"use client";

import { useEffect, useState } from "react";
import Sidebar from "@/components/Sidebar";
import ReportingView from "@/components/ReportingView";
import SquadsView from "@/components/SquadsView";
import HistoryView from "@/components/HistoryView";
import BackupBar from "@/components/BackupBar";
import { useStore } from "@/lib/store";

type Tab = "reporting" | "squads" | "history";

export default function Home() {
  const [tab, setTab] = useState<Tab>("squads");
  const [hydrated, setHydrated] = useState(false);

  // Avoid hydration mismatch from persisted localStorage state
  useEffect(() => {
    setHydrated(true);
  }, []);

  const totals = useStore((s) => ({
    staff: Object.keys(s.staff).length,
    teams: Object.keys(s.teams).length,
    movements: s.movements.length,
  }));

  const seedSample = () => {
    const { addStaff, addTeam, addStaffToTeam, setManager } = useStore.getState();
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
    setManager(em1, dir);
  };

  return (
    <div className="flex min-h-screen">
      <Sidebar />
      <main className="flex-1 min-w-0 flex flex-col">
        <header className="border-b bg-white px-6 py-3 flex items-center justify-between">
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
          <div className="flex items-center gap-3">
            <div className="text-xs text-slate-500">
              {hydrated
                ? `${totals.staff} staff · ${totals.teams} teams · ${totals.movements} events`
                : "…"}
            </div>
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
    </div>
  );
}
