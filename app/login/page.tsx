"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

type Mode = "loading" | "login" | "setup";

export default function LoginPage() {
  const router = useRouter();
  const [mode, setMode] = useState<Mode>("loading");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    // Check if already logged in
    fetch("/api/auth/me")
      .then((res) => {
        if (res.ok) {
          router.replace("/");
          return;
        }
        // Not logged in — check if setup needed
        return fetch("/api/config").then((r) => r.json());
      })
      .then((config) => {
        if (!config) return; // redirected
        setMode(config.hasUsers ? "login" : "setup");
      })
      .catch(() => setMode("login"));
  }, [router]);

  const submit = async () => {
    if (!username.trim() || !password) return;
    setBusy(true);
    setError(null);

    const endpoint = mode === "setup" ? "/api/auth/setup" : "/api/auth/login";
    try {
      const res = await fetch(endpoint, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          username: username.trim(),
          password,
        }),
      });
      if (!res.ok) {
        const data = await res.json();
        setError(data.error || "Something went wrong");
        setBusy(false);
        return;
      }
      router.replace("/");
    } catch {
      setError("Network error");
      setBusy(false);
    }
  };

  if (mode === "loading") {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <div className="text-sm text-slate-400">Loading...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50">
      <div className="bg-white rounded-xl shadow-lg p-8 w-[380px] space-y-5">
        <div>
          <h1 className="text-lg font-bold">Staff Movement</h1>
          <p className="text-xs text-slate-500 mt-1">
            {mode === "setup"
              ? "Create your admin account to get started."
              : "Sign in to continue."}
          </p>
        </div>

        <div className="space-y-3">
          <input
            type="email"
            autoFocus
            className="w-full border rounded px-3 py-2 text-sm"
            placeholder="Email"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && submit()}
          />
          <input
            type="password"
            className="w-full border rounded px-3 py-2 text-sm"
            placeholder="Password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && submit()}
          />
        </div>

        {error && <div className="text-xs text-red-600">{error}</div>}

        <button
          className="w-full bg-slate-900 text-white text-sm rounded py-2.5 hover:bg-slate-700 disabled:opacity-50"
          onClick={submit}
          disabled={busy || !username.trim() || !password}
        >
          {busy
            ? "Please wait..."
            : mode === "setup"
              ? "Create Admin Account"
              : "Sign In"}
        </button>

        {mode === "setup" && (
          <p className="text-[10px] text-slate-400">
            This account will have full admin access. You can create more
            accounts later.
          </p>
        )}
      </div>
    </div>
  );
}
