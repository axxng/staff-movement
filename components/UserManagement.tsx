"use client";

import { useEffect, useState } from "react";

type User = {
  username: string;
  role: "admin" | "user";
  createdAt: number;
};

export default function UserManagement({ currentUser }: { currentUser: string }) {
  const [users, setUsers] = useState<User[]>([]);
  const [newUsername, setNewUsername] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [newRole, setNewRole] = useState<"admin" | "user">("user");
  const [error, setError] = useState<string | null>(null);
  const [editingPw, setEditingPw] = useState<string | null>(null);
  const [editPwValue, setEditPwValue] = useState("");

  const load = async () => {
    const res = await fetch("/api/users");
    if (res.ok) setUsers(await res.json());
  };

  useEffect(() => {
    load();
  }, []);

  const addUser = async () => {
    if (!newUsername.trim() || !newPassword) return;
    setError(null);
    const res = await fetch("/api/users", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        username: newUsername.trim(),
        password: newPassword,
        role: newRole,
      }),
    });
    if (!res.ok) {
      const data = await res.json();
      setError(data.error);
      return;
    }
    setNewUsername("");
    setNewPassword("");
    setNewRole("user");
    load();
  };

  const changeRole = async (username: string, role: "admin" | "user") => {
    await fetch(`/api/users/${encodeURIComponent(username)}`, {
      method: "PUT",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ role }),
    });
    load();
  };

  const changePw = async (username: string) => {
    if (!editPwValue || editPwValue.length < 4) return;
    const res = await fetch(`/api/users/${encodeURIComponent(username)}`, {
      method: "PUT",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ password: editPwValue }),
    });
    if (res.ok) {
      setEditingPw(null);
      setEditPwValue("");
    }
  };

  const deleteUser = async (username: string) => {
    if (!confirm(`Delete user "${username}"?`)) return;
    await fetch(`/api/users/${encodeURIComponent(username)}`, {
      method: "DELETE",
    });
    load();
  };

  return (
    <div className="p-4 space-y-3 text-xs">
      <div className="space-y-2">
        <input
          className="w-full border rounded px-2 py-1 text-sm"
          placeholder="Username"
          value={newUsername}
          onChange={(e) => setNewUsername(e.target.value)}
        />
        <input
          type="password"
          className="w-full border rounded px-2 py-1 text-sm"
          placeholder="Password"
          value={newPassword}
          onChange={(e) => setNewPassword(e.target.value)}
        />
        <div className="flex gap-2">
          <select
            className="text-sm border rounded px-2 py-1 flex-1"
            value={newRole}
            onChange={(e) => setNewRole(e.target.value as "admin" | "user")}
          >
            <option value="user">User</option>
            <option value="admin">Admin</option>
          </select>
          <button
            className="text-sm bg-slate-900 text-white rounded px-3 py-1"
            onClick={addUser}
          >
            Add
          </button>
        </div>
        {error && <div className="text-red-600">{error}</div>}
      </div>

      <div className="border-t pt-2 space-y-2 max-h-[60vh] overflow-y-auto">
        {users.length === 0 && (
          <div className="text-slate-400">No users.</div>
        )}
        {users
          .sort((a, b) => a.username.localeCompare(b.username))
          .map((u) => (
            <div key={u.username} className="border rounded p-2 space-y-1">
              <div className="flex items-center justify-between">
                <span className="font-semibold">
                  {u.username}
                  {u.username === currentUser && (
                    <span className="text-slate-400 font-normal ml-1">(you)</span>
                  )}
                </span>
                <select
                  className="text-[10px] border rounded px-1"
                  value={u.role}
                  onChange={(e) =>
                    changeRole(u.username, e.target.value as "admin" | "user")
                  }
                  disabled={u.username === currentUser}
                >
                  <option value="user">user</option>
                  <option value="admin">admin</option>
                </select>
              </div>

              {editingPw === u.username ? (
                <div className="flex gap-1">
                  <input
                    type="password"
                    className="flex-1 border rounded px-1 py-0.5"
                    placeholder="New password"
                    value={editPwValue}
                    onChange={(e) => setEditPwValue(e.target.value)}
                    onKeyDown={(e) =>
                      e.key === "Enter" && changePw(u.username)
                    }
                    autoFocus
                  />
                  <button
                    className="text-slate-600 hover:bg-slate-100 px-1 rounded"
                    onClick={() => changePw(u.username)}
                  >
                    Save
                  </button>
                  <button
                    className="text-slate-400 hover:bg-slate-100 px-1 rounded"
                    onClick={() => {
                      setEditingPw(null);
                      setEditPwValue("");
                    }}
                  >
                    Cancel
                  </button>
                </div>
              ) : (
                <div className="flex gap-1">
                  <button
                    className="text-slate-500 hover:bg-slate-100 px-1 rounded"
                    onClick={() => {
                      setEditingPw(u.username);
                      setEditPwValue("");
                    }}
                  >
                    Change password
                  </button>
                  {u.username !== currentUser && (
                    <button
                      className="text-red-500 hover:bg-red-50 px-1 rounded"
                      onClick={() => deleteUser(u.username)}
                    >
                      Delete
                    </button>
                  )}
                </div>
              )}
            </div>
          ))}
      </div>
    </div>
  );
}
