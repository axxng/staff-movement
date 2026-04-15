"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { useStore } from "./store";
import type { AppState } from "./types";

export type SyncStatus =
  | "idle"
  | "loading"
  | "syncing"
  | "saved"
  | "error"
  | "offline" // storage not configured server-side
  | "auth-required"
  | "local-only";

export type SyncConfig = {
  hasStorage: boolean;
  authRequired: boolean;
};

const passwordHeader = (pw: string | null): HeadersInit => {
  const h: Record<string, string> = {};
  if (pw) h["x-app-password"] = pw;
  return h;
};

export const fetchConfig = async (): Promise<SyncConfig | null> => {
  try {
    const res = await fetch("/api/config", { cache: "no-store" });
    if (!res.ok) return null;
    return (await res.json()) as SyncConfig;
  } catch {
    return null;
  }
};

export const verifyPassword = async (pw: string): Promise<boolean> => {
  try {
    const res = await fetch("/api/state", {
      headers: passwordHeader(pw),
      cache: "no-store",
    });
    return res.status !== 401;
  } catch {
    return false;
  }
};

type UseSyncArgs = {
  enabled: boolean;
  config: SyncConfig | null;
  password: string | null;
};

export function useSync({ enabled, config, password }: UseSyncArgs) {
  const [status, setStatus] = useState<SyncStatus>("idle");
  const [lastSyncedAt, setLastSyncedAt] = useState<number | null>(null);
  const baseUpdatedAtRef = useRef<number | null>(null);
  const suppressRef = useRef(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const initialLoadDoneRef = useRef(false);

  const save = useCallback(
    async (pw: string | null) => {
      setStatus("syncing");
      const cur = useStore.getState();
      const body = {
        state: {
          version: cur.version,
          staff: cur.staff,
          teams: cur.teams,
          roles: cur.roles,
          movements: cur.movements,
        } as AppState,
        baseUpdatedAt: baseUpdatedAtRef.current,
      };
      try {
        const res = await fetch("/api/state", {
          method: "PUT",
          headers: { "content-type": "application/json", ...passwordHeader(pw) },
          body: JSON.stringify(body),
        });
        if (res.status === 409) {
          const json = (await res.json()) as {
            state: AppState | null;
            updatedAt: number;
          };
          baseUpdatedAtRef.current = json.updatedAt;
          if (json.state) {
            suppressRef.current = true;
            useStore.getState().replaceState(json.state);
            setTimeout(() => {
              suppressRef.current = false;
            }, 0);
          }
          setLastSyncedAt(json.updatedAt);
          setStatus("saved");
          return;
        }
        if (res.status === 401) {
          setStatus("auth-required");
          return;
        }
        if (res.status === 503) {
          setStatus("local-only");
          return;
        }
        if (!res.ok) throw new Error("save failed");
        const json = (await res.json()) as { ok: true; updatedAt: number };
        baseUpdatedAtRef.current = json.updatedAt;
        setLastSyncedAt(json.updatedAt);
        setStatus("saved");
      } catch (err) {
        console.error("sync save failed", err);
        setStatus("error");
      }
    },
    [],
  );

  // Initial load when enabled / config / password change
  useEffect(() => {
    if (!enabled || !config) return;
    if (!config.hasStorage) {
      setStatus("local-only");
      return;
    }
    if (config.authRequired && !password) {
      setStatus("auth-required");
      return;
    }

    let cancelled = false;
    setStatus("loading");
    initialLoadDoneRef.current = false;
    (async () => {
      try {
        const res = await fetch("/api/state", {
          headers: passwordHeader(password),
          cache: "no-store",
        });
        if (cancelled) return;
        if (res.status === 401) {
          setStatus("auth-required");
          return;
        }
        if (res.status === 503) {
          setStatus("local-only");
          return;
        }
        if (!res.ok) throw new Error("load failed");
        const json = (await res.json()) as {
          state: AppState | null;
          updatedAt: number | null;
        };
        if (cancelled) return;
        baseUpdatedAtRef.current = json.updatedAt;
        setLastSyncedAt(json.updatedAt);

        const hasServerState =
          json.state &&
          (Object.keys(json.state.staff ?? {}).length > 0 ||
            Object.keys(json.state.teams ?? {}).length > 0 ||
            (json.state.movements ?? []).length > 0);

        if (hasServerState && json.state) {
          suppressRef.current = true;
          useStore.getState().replaceState(json.state);
          setTimeout(() => {
            suppressRef.current = false;
            initialLoadDoneRef.current = true;
          }, 0);
          setStatus("saved");
        } else {
          // Server is empty — push local state if we have any
          const cur = useStore.getState();
          const hasLocal =
            Object.keys(cur.staff).length > 0 ||
            Object.keys(cur.teams).length > 0;
          initialLoadDoneRef.current = true;
          if (hasLocal) {
            await save(password);
          } else {
            setStatus("saved");
          }
        }
      } catch (err) {
        console.error("sync load failed", err);
        if (!cancelled) setStatus("error");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [enabled, config, password, save]);

  // Subscribe to local store changes and push to server
  useEffect(() => {
    if (!enabled || !config?.hasStorage) return;
    if (config.authRequired && !password) return;
    const unsub = useStore.subscribe((state, prev) => {
      if (suppressRef.current) return;
      if (!initialLoadDoneRef.current) return;
      if (
        state.staff === prev.staff &&
        state.teams === prev.teams &&
        state.roles === prev.roles &&
        state.movements === prev.movements
      ) {
        return;
      }
      if (debounceRef.current) clearTimeout(debounceRef.current);
      debounceRef.current = setTimeout(() => {
        save(password);
      }, 600);
    });
    return () => {
      unsub();
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [enabled, config, password, save]);

  const forceSync = useCallback(() => save(password), [save, password]);

  return { status, lastSyncedAt, forceSync };
}
