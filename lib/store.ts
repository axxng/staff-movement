"use client";

import { useEffect, useState } from "react";
import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import { temporal } from "zundo";
import type {
  AppState,
  Movement,
  MovementType,
  Role,
  RoleId,
  Staff,
  StaffId,
  Team,
  TeamId,
} from "./types";

const uid = () =>
  typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : Math.random().toString(36).slice(2) + Date.now().toString(36);

const DEFAULT_ROLES: Role[] = [
  { id: "engineer", label: "Engineer", color: "#3b82f6" },
  { id: "em", label: "Engineering Manager", color: "#8b5cf6" },
  { id: "pm", label: "Product Manager", color: "#10b981" },
  { id: "designer", label: "Designer", color: "#ec4899" },
  { id: "data", label: "Data", color: "#f59e0b" },
  { id: "qa", label: "QA", color: "#14b8a6" },
  { id: "director", label: "Director", color: "#ef4444" },
  { id: "other", label: "Other", color: "#64748b" },
];

const initialState: AppState = {
  version: 1,
  staff: {},
  teams: {},
  roles: Object.fromEntries(DEFAULT_ROLES.map((r) => [r.id, r])),
  movements: [],
};

type Actions = {
  // staff
  addStaff: (input: { name: string; roleId: RoleId; managerId?: StaffId | null }) => StaffId;
  renameStaff: (id: StaffId, name: string) => void;
  deleteStaff: (id: StaffId) => void;
  setManager: (id: StaffId, managerId: StaffId | null) => void;
  setRole: (id: StaffId, roleId: RoleId) => void;
  // teams
  addTeam: (input: { name: string; parentId?: TeamId | null }) => TeamId;
  renameTeam: (id: TeamId, name: string) => void;
  deleteTeam: (id: TeamId) => void;
  reparentTeam: (id: TeamId, parentId: TeamId | null) => void;
  // membership
  addStaffToTeam: (staffId: StaffId, teamId: TeamId) => void;
  removeStaffFromTeam: (staffId: StaffId, teamId: TeamId) => void;
  moveStaffBetweenTeams: (staffId: StaffId, fromTeamId: TeamId, toTeamId: TeamId) => void;
  // roles
  addRole: (label: string, color: string) => RoleId;
  updateRole: (id: RoleId, patch: Partial<Omit<Role, "id">>) => void;
  deleteRole: (id: RoleId) => void;
  // history
  clearHistory: () => void;
  // import / export / reset
  replaceState: (s: AppState) => void;
  resetAll: () => void;
};

type Store = AppState & Actions;

const recordMovement = (
  state: AppState,
  m: Omit<Movement, "id" | "timestamp">,
): Movement[] => {
  const movement: Movement = {
    id: uid(),
    timestamp: Date.now(),
    ...m,
  };
  return [movement, ...state.movements];
};

const labelForStaff = (s: Staff | undefined) => (s ? s.name : null);
const labelForTeam = (t: Team | undefined) => (t ? t.name : null);
const labelForRole = (r: Role | undefined) => (r ? r.label : null);

export const useStore = create<Store>()(
  persist(
    temporal(
      (set, get) => ({
      ...initialState,

      addStaff: ({ name, roleId, managerId = null }) => {
        const id = uid();
        set((state) => {
          const staff: Staff = { id, name, roleId, managerId };
          return {
            staff: { ...state.staff, [id]: staff },
            movements: recordMovement(state, {
              type: "staff_create",
              staffId: id,
              toLabel: name,
              note: `Created ${name}`,
            }),
          };
        });
        return id;
      },

      renameStaff: (id, name) => {
        set((state) => {
          const cur = state.staff[id];
          if (!cur || cur.name === name) return {} as Partial<Store>;
          return {
            staff: { ...state.staff, [id]: { ...cur, name } },
            movements: recordMovement(state, {
              type: "staff_rename",
              staffId: id,
              fromLabel: cur.name,
              toLabel: name,
            }),
          };
        });
      },

      deleteStaff: (id) => {
        set((state) => {
          const cur = state.staff[id];
          if (!cur) return {} as Partial<Store>;
          const newStaff = { ...state.staff };
          delete newStaff[id];
          // detach as manager
          for (const sid of Object.keys(newStaff)) {
            if (newStaff[sid].managerId === id) {
              newStaff[sid] = { ...newStaff[sid], managerId: null };
            }
          }
          // remove from teams
          const newTeams: Record<TeamId, Team> = {};
          for (const [tid, t] of Object.entries(state.teams)) {
            newTeams[tid] = {
              ...t,
              memberIds: t.memberIds.filter((m) => m !== id),
            };
          }
          return {
            staff: newStaff,
            teams: newTeams,
            movements: recordMovement(state, {
              type: "staff_delete",
              staffId: id,
              fromLabel: cur.name,
              note: `Deleted ${cur.name}`,
            }),
          };
        });
      },

      setManager: (id, managerId) => {
        set((state) => {
          const cur = state.staff[id];
          if (!cur) return {} as Partial<Store>;
          if (cur.managerId === managerId) return {} as Partial<Store>;
          // prevent cycles
          let cursor: StaffId | null = managerId;
          while (cursor) {
            if (cursor === id) return {} as Partial<Store>;
            cursor = state.staff[cursor]?.managerId ?? null;
          }
          return {
            staff: { ...state.staff, [id]: { ...cur, managerId } },
            movements: recordMovement(state, {
              type: "manager_change",
              staffId: id,
              fromId: cur.managerId,
              toId: managerId,
              fromLabel: labelForStaff(state.staff[cur.managerId ?? ""]),
              toLabel: labelForStaff(state.staff[managerId ?? ""]),
              note: `${cur.name}'s manager changed`,
            }),
          };
        });
      },

      setRole: (id, roleId) => {
        set((state) => {
          const cur = state.staff[id];
          if (!cur || cur.roleId === roleId) return {} as Partial<Store>;
          return {
            staff: { ...state.staff, [id]: { ...cur, roleId } },
            movements: recordMovement(state, {
              type: "role_change",
              staffId: id,
              fromId: cur.roleId,
              toId: roleId,
              fromLabel: labelForRole(state.roles[cur.roleId]),
              toLabel: labelForRole(state.roles[roleId]),
            }),
          };
        });
      },

      addTeam: ({ name, parentId = null }) => {
        const id = uid();
        set((state) => {
          const team: Team = { id, name, parentId, memberIds: [] };
          return {
            teams: { ...state.teams, [id]: team },
            movements: recordMovement(state, {
              type: "team_create",
              teamId: id,
              toLabel: name,
              note: `Created team ${name}`,
            }),
          };
        });
        return id;
      },

      renameTeam: (id, name) => {
        set((state) => {
          const cur = state.teams[id];
          if (!cur || cur.name === name) return {} as Partial<Store>;
          return {
            teams: { ...state.teams, [id]: { ...cur, name } },
            movements: recordMovement(state, {
              type: "team_rename",
              teamId: id,
              fromLabel: cur.name,
              toLabel: name,
            }),
          };
        });
      },

      deleteTeam: (id) => {
        set((state) => {
          const cur = state.teams[id];
          if (!cur) return {} as Partial<Store>;
          const newTeams = { ...state.teams };
          delete newTeams[id];
          // re-parent any children to the deleted team's parent
          for (const tid of Object.keys(newTeams)) {
            if (newTeams[tid].parentId === id) {
              newTeams[tid] = { ...newTeams[tid], parentId: cur.parentId };
            }
          }
          return {
            teams: newTeams,
            movements: recordMovement(state, {
              type: "team_delete",
              teamId: id,
              fromLabel: cur.name,
            }),
          };
        });
      },

      reparentTeam: (id, parentId) => {
        set((state) => {
          const cur = state.teams[id];
          if (!cur) return {} as Partial<Store>;
          if (cur.parentId === parentId) return {} as Partial<Store>;
          // cycle check
          let cursor: TeamId | null = parentId;
          while (cursor) {
            if (cursor === id) return {} as Partial<Store>;
            cursor = state.teams[cursor]?.parentId ?? null;
          }
          return {
            teams: { ...state.teams, [id]: { ...cur, parentId } },
            movements: recordMovement(state, {
              type: "team_reparent",
              teamId: id,
              fromId: cur.parentId,
              toId: parentId,
              fromLabel: labelForTeam(state.teams[cur.parentId ?? ""]),
              toLabel: labelForTeam(state.teams[parentId ?? ""]),
            }),
          };
        });
      },

      addStaffToTeam: (staffId, teamId) => {
        set((state) => {
          const team = state.teams[teamId];
          const staff = state.staff[staffId];
          if (!team || !staff) return {} as Partial<Store>;
          if (team.memberIds.includes(staffId)) return {} as Partial<Store>;
          return {
            teams: {
              ...state.teams,
              [teamId]: { ...team, memberIds: [...team.memberIds, staffId] },
            },
            movements: recordMovement(state, {
              type: "team_join",
              staffId,
              teamId,
              toLabel: team.name,
              note: `${staff.name} joined ${team.name}`,
            }),
          };
        });
      },

      removeStaffFromTeam: (staffId, teamId) => {
        set((state) => {
          const team = state.teams[teamId];
          const staff = state.staff[staffId];
          if (!team || !staff) return {} as Partial<Store>;
          if (!team.memberIds.includes(staffId)) return {} as Partial<Store>;
          return {
            teams: {
              ...state.teams,
              [teamId]: {
                ...team,
                memberIds: team.memberIds.filter((m) => m !== staffId),
              },
            },
            movements: recordMovement(state, {
              type: "team_leave",
              staffId,
              teamId,
              fromLabel: team.name,
              note: `${staff.name} left ${team.name}`,
            }),
          };
        });
      },

      moveStaffBetweenTeams: (staffId, fromTeamId, toTeamId) => {
        if (fromTeamId === toTeamId) return;
        set((state) => {
          const from = state.teams[fromTeamId];
          const to = state.teams[toTeamId];
          const staff = state.staff[staffId];
          if (!from || !to || !staff) return {} as Partial<Store>;
          const newTeams = { ...state.teams };
          newTeams[fromTeamId] = {
            ...from,
            memberIds: from.memberIds.filter((m) => m !== staffId),
          };
          if (!to.memberIds.includes(staffId)) {
            newTeams[toTeamId] = { ...to, memberIds: [...to.memberIds, staffId] };
          }
          return {
            teams: newTeams,
            movements: [
              {
                id: uid(),
                timestamp: Date.now(),
                type: "team_leave",
                staffId,
                teamId: fromTeamId,
                fromLabel: from.name,
                note: `${staff.name} moved from ${from.name} to ${to.name}`,
              },
              {
                id: uid(),
                timestamp: Date.now() + 1,
                type: "team_join",
                staffId,
                teamId: toTeamId,
                toLabel: to.name,
                note: `${staff.name} moved from ${from.name} to ${to.name}`,
              },
              ...state.movements,
            ],
          };
        });
      },

      addRole: (label, color) => {
        const id = uid();
        set((state) => ({
          roles: { ...state.roles, [id]: { id, label, color } },
        }));
        return id;
      },

      updateRole: (id, patch) => {
        set((state) => {
          const cur = state.roles[id];
          if (!cur) return {} as Partial<Store>;
          return { roles: { ...state.roles, [id]: { ...cur, ...patch } } };
        });
      },

      deleteRole: (id) => {
        set((state) => {
          const newRoles = { ...state.roles };
          delete newRoles[id];
          // reassign staff to "other" if exists, else first remaining
          const fallback = newRoles["other"]?.id ?? Object.keys(newRoles)[0];
          const newStaff = { ...state.staff };
          if (fallback) {
            for (const sid of Object.keys(newStaff)) {
              if (newStaff[sid].roleId === id) {
                newStaff[sid] = { ...newStaff[sid], roleId: fallback };
              }
            }
          }
          return { roles: newRoles, staff: newStaff };
        });
      },

      clearHistory: () => set({ movements: [] }),

      replaceState: (s) =>
        set({
          version: s.version ?? 1,
          staff: s.staff ?? {},
          teams: s.teams ?? {},
          roles: s.roles ?? initialState.roles,
          movements: s.movements ?? [],
        }),

      resetAll: () => set({ ...initialState }),
    }),
      {
        // Only diff the data slice for undo so action references don't
        // get serialised into history.
        partialize: (s) => ({
          version: s.version,
          staff: s.staff,
          teams: s.teams,
          roles: s.roles,
          movements: s.movements,
        }),
        limit: 100,
        equality: (a, b) =>
          a.staff === b.staff &&
          a.teams === b.teams &&
          a.roles === b.roles &&
          a.movements === b.movements,
      },
    ),
    {
      name: "staff-movement-v1",
      storage: createJSONStorage(() => localStorage),
      partialize: (s) => ({
        version: s.version,
        staff: s.staff,
        teams: s.teams,
        roles: s.roles,
        movements: s.movements,
      }),
    },
  ),
);

// Hook into the zundo temporal store for undo/redo state
type TemporalState = ReturnType<typeof useStore.temporal.getState>;

export const useTemporal = <T,>(selector: (s: TemporalState) => T): T => {
  const [, force] = useState({});
  useEffect(() => {
    const unsub = useStore.temporal.subscribe(() => force({}));
    return () => unsub();
  }, []);
  return selector(useStore.temporal.getState());
};

export const movementTypeLabel = (t: MovementType): string => {
  switch (t) {
    case "staff_create": return "Created";
    case "staff_delete": return "Deleted";
    case "staff_rename": return "Renamed";
    case "role_change": return "Role changed";
    case "manager_change": return "Manager changed";
    case "team_create": return "Team created";
    case "team_delete": return "Team deleted";
    case "team_rename": return "Team renamed";
    case "team_reparent": return "Team moved";
    case "team_join": return "Joined team";
    case "team_leave": return "Left team";
  }
};
