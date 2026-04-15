"use client";

import { useState } from "react";
import { verifyPassword } from "@/lib/sync";

export default function PasswordPrompt({
  onSubmit,
}: {
  onSubmit: (pw: string) => void;
}) {
  const [pw, setPw] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    if (!pw) return;
    setBusy(true);
    setErr(null);
    const ok = await verifyPassword(pw);
    setBusy(false);
    if (ok) {
      onSubmit(pw);
    } else {
      setErr("Wrong password");
    }
  };

  return (
    <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50">
      <div className="bg-white rounded-xl shadow-xl p-6 w-[360px] space-y-4">
        <div>
          <h2 className="text-base font-semibold">Workspace locked</h2>
          <p className="text-xs text-slate-500 mt-1">
            Enter the password to unlock cross-device sync.
          </p>
        </div>
        <input
          type="password"
          autoFocus
          className="w-full border rounded px-3 py-2 text-sm"
          value={pw}
          onChange={(e) => setPw(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && submit()}
          placeholder="Password"
        />
        {err && <div className="text-xs text-red-600">{err}</div>}
        <button
          className="w-full bg-slate-900 text-white text-sm rounded py-2 hover:bg-slate-700 disabled:opacity-50"
          onClick={submit}
          disabled={busy || !pw}
        >
          {busy ? "Checking…" : "Unlock"}
        </button>
        <p className="text-[10px] text-slate-400">
          Stored in this browser only. Clear it from the sidebar to sign out.
        </p>
      </div>
    </div>
  );
}
