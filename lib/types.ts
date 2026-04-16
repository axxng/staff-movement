export type RoleId = string;

export type Role = {
  id: RoleId;
  label: string;
  color: string; // hex
};

export type StaffId = string;

export type Staff = {
  id: StaffId;
  name: string;
  roleId: RoleId;
  managerId: StaffId | null;
  tags: string[];
};

export type TeamId = string;

export type Team = {
  id: TeamId;
  name: string;
  parentId: TeamId | null;
  memberIds: StaffId[];
  order: number;
};

export type MovementType =
  | "staff_create"
  | "staff_delete"
  | "staff_rename"
  | "role_change"
  | "manager_change"
  | "team_create"
  | "team_delete"
  | "team_rename"
  | "team_reparent"
  | "team_join"
  | "team_leave"
  | "tag_add"
  | "tag_remove";

export type Movement = {
  id: string;
  timestamp: number;
  type: MovementType;
  actor?: string;
  staffId?: StaffId;
  teamId?: TeamId;
  fromId?: string | null;
  toId?: string | null;
  fromLabel?: string | null;
  toLabel?: string | null;
  note?: string;
};

export type AppState = {
  version: number;
  staff: Record<StaffId, Staff>;
  teams: Record<TeamId, Team>;
  roles: Record<RoleId, Role>;
  movements: Movement[];
};

export type AuthUser = {
  username: string;
  passwordHash: string;
  role: "admin" | "user";
  createdAt: number;
};

export type SessionUser = {
  username: string;
  role: "admin" | "user" | "guest";
};
