"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import {
  authJson,
  fetchAuthMe,
  formatApiError,
  type AuthMePayload,
} from "@/lib/auth-api";
import { broadcastSalonAuthChange, SALON_AUTH_CHANGE_EVENT } from "@/lib/auth-events";
import { getPrimaryDashboardPath, getRoleLabel } from "@/lib/auth-session";
import { canAccessSalonManagement, canAccessSuperAdmin } from "@/lib/role-access";
import { ChevronDown, LogOut, User } from "lucide-react";

const LS_ACCESS = "salon_access_token";
const LS_REFRESH = "salon_refresh_token";

function readToken(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem(LS_ACCESS);
}

export function AuthHeaderProfile(props: {
  /** Smaller control for tight layouts (e.g. dashboard chrome). */
  variant?: "default" | "compact";
}) {
  const router = useRouter();
  const compact = props.variant === "compact";
  const [me, setMe] = useState<AuthMePayload | null>(null);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);

  const load = useCallback(async () => {
    const token = readToken();
    if (!token) {
      setMe(null);
      return;
    }
    setLoading(true);
    const res = await fetchAuthMe(token);
    setLoading(false);
    if (!res.ok) {
      if (res.status === 401) {
        localStorage.removeItem(LS_ACCESS);
        localStorage.removeItem(LS_REFRESH);
        setMe(null);
        broadcastSalonAuthChange();
      }
      return;
    }
    setMe(res.data);
  }, []);

  useEffect(() => {
     
    void load();
  }, [load]);

  useEffect(() => {
    const onAuth = () => void load();
    const onStorage = (e: StorageEvent) => {
      if (e.key === LS_ACCESS || e.key === LS_REFRESH) void load();
    };
    window.addEventListener(SALON_AUTH_CHANGE_EVENT, onAuth);
    window.addEventListener("storage", onStorage);
    window.addEventListener("focus", onAuth);
    return () => {
      window.removeEventListener(SALON_AUTH_CHANGE_EVENT, onAuth);
      window.removeEventListener("storage", onStorage);
      window.removeEventListener("focus", onAuth);
    };
  }, [load]);

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [open]);

  async function logout() {
    const access = readToken();
    const refresh = typeof window !== "undefined" ? localStorage.getItem(LS_REFRESH) : null;
    if (access) {
      const res = await authJson("/auth/logout", {
        method: "POST",
        accessToken: access,
        body: JSON.stringify(refresh ? { refresh_token: refresh } : {}),
      });
      if (!res.ok) toast.error(formatApiError(res.body));
    }
    localStorage.removeItem(LS_ACCESS);
    localStorage.removeItem(LS_REFRESH);
    setMe(null);
    setOpen(false);
    broadcastSalonAuthChange();
    toast.success("Signed out.");
    router.push("/");
    router.refresh();
  }

  if (loading) {
    return (
      <div
        className={`flex items-center rounded-full bg-zinc-100/80 dark:bg-zinc-800/80 ${compact ? "h-8 w-8" : "h-9 w-24 animate-pulse"}`}
        aria-hidden
      />
    );
  }

  if (!me) {
    return (
      <div className="flex items-center gap-2">
        <Link
          href="/app/auth?tab=login"
          className={`rounded-full font-medium text-rose-800 hover:underline dark:text-rose-200 ${compact ? "text-xs" : "text-sm"}`}
        >
          Sign in
        </Link>
      </div>
    );
  }

  const dash = getPrimaryDashboardPath(me);
  const role = getRoleLabel(me);
  const initial = me.name?.trim()?.charAt(0)?.toUpperCase() || "?";

  return (
    <div className="relative flex items-center" ref={wrapRef}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className={`group flex items-center gap-2 rounded-full border border-[color:var(--border)] bg-[color:var(--surface)] pl-1 pr-2 text-[color:var(--foreground)] shadow-sm transition hover:bg-[color:var(--brand-primary)] hover:text-white ${
          compact ? "py-0.5 pl-0.5" : "py-1"
        }`}
        aria-expanded={open}
        aria-haspopup="menu"
      >
        <span
          className={`flex shrink-0 items-center justify-center overflow-hidden rounded-full bg-gradient-to-br from-rose-500 to-rose-700 text-white shadow-inner ${
            compact ? "h-7 w-7 text-xs" : "h-8 w-8 text-sm"
          } font-semibold`}
        >
          {me.photo_url ? (
            // eslint-disable-next-line @next/next/no-img-element -- user-selected avatar URL/data URL
            <img src={me.photo_url} alt="" className="h-full w-full object-cover" />
          ) : (
            initial
          )}
        </span>
        {!compact ? (
          <span className="hidden max-w-[140px] truncate text-left text-sm font-medium text-[color:var(--foreground)] transition group-hover:text-white sm:block">
            {me.name}
          </span>
        ) : null}
        <ChevronDown className={`h-4 w-4 shrink-0 text-[color:var(--foreground)] transition group-hover:text-white ${open ? "rotate-180" : ""}`} />
      </button>

      {open ? (
        <div
          className="absolute right-0 top-full z-50 mt-2 w-64 rounded-2xl border border-[color:var(--border)] bg-[color:var(--surface)] py-2 shadow-lg"
          role="menu"
        >
          <div className="border-b border-[color:var(--border)] px-4 py-3">
            <p className="truncate font-semibold text-[color:var(--foreground)]">{me.name}</p>
            <p className="truncate text-xs text-[color:var(--paragraph)]">{me.mobile}</p>
            <p className="mt-1 inline-block rounded-full bg-[color:color-mix(in_srgb,var(--brand-glow)_18%,var(--background))] px-2 py-0.5 text-[11px] font-medium text-[color:var(--brand-primary)]">
              {role}
            </p>
          </div>
          <Link
            href={dash}
            role="menuitem"
            className="flex items-center gap-2 px-4 py-2.5 text-sm text-[color:var(--paragraph)] transition hover:bg-[color:var(--brand-primary)] hover:text-white"
            onClick={() => setOpen(false)}
          >
            <User className="h-4 w-4 shrink-0 opacity-70" />
            My dashboard
          </Link>
          {canAccessSalonManagement(me) ? (
            <Link
              href="/app"
              role="menuitem"
              className="flex items-center gap-2 px-4 py-2.5 text-sm text-[color:var(--paragraph)] transition hover:bg-[color:var(--brand-primary)] hover:text-white"
              onClick={() => setOpen(false)}
            >
              Calendar &amp; bookings
            </Link>
          ) : null}
          {canAccessSuperAdmin(me) ? (
            <Link
              href="/admin/dashboard"
              role="menuitem"
              className="flex items-center gap-2 px-4 py-2.5 text-sm text-[color:var(--paragraph)] transition hover:bg-[color:var(--brand-primary)] hover:text-white"
              onClick={() => setOpen(false)}
            >
              Platform admin
            </Link>
          ) : null}
          {me.role === "customer" ? (
            <Link
              href="/shops"
              role="menuitem"
              className="flex items-center gap-2 px-4 py-2.5 text-sm text-[color:var(--paragraph)] transition hover:bg-[color:var(--brand-primary)] hover:text-white"
              onClick={() => setOpen(false)}
            >
              Browse shops
            </Link>
          ) : null}
          <Link
            href="/app"
            role="menuitem"
            className="flex items-center gap-2 px-4 py-2.5 text-sm text-[color:var(--paragraph)] transition hover:bg-[color:var(--brand-primary)] hover:text-white"
            onClick={() => setOpen(false)}
          >
            Account settings
          </Link>
          <button
            type="button"
            role="menuitem"
            className="flex w-full items-center gap-2 border-t border-[color:var(--border)] px-4 py-2.5 text-left text-sm text-red-700 transition hover:bg-red-50"
            onClick={() => void logout()}
          >
            <LogOut className="h-4 w-4 shrink-0" />
            Sign out
          </button>
        </div>
      ) : null}
    </div>
  );
}
