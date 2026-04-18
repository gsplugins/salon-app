"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { authJson, formatApiError, type ApiErrorBody } from "@/lib/auth-api";

const LS_ACCESS = "salon_access_token";
const LS_REFRESH = "salon_refresh_token";

type Me = { id: number; name: string; mobile: string; is_admin: boolean };

type Tab = "login" | "register" | "forgot" | "reset" | "session";

export function AuthPortal() {
  const [tab, setTab] = useState<Tab>("login");
  const [accessToken, setAccessToken] = useState<string | null>(null);
  const [refreshToken, setRefreshToken] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<{ type: "ok" | "err"; text: string } | null>(
    null
  );
  const [me, setMe] = useState<Me | null>(null);

  // forms
  const [loginMobile, setLoginMobile] = useState("");
  const [loginPassword, setLoginPassword] = useState("");
  const [regName, setRegName] = useState("");
  const [regMobile, setRegMobile] = useState("");
  const [regPassword, setRegPassword] = useState("");
  const [regPassword2, setRegPassword2] = useState("");
  const [forgotMobile, setForgotMobile] = useState("");
  const [resetMobile, setResetMobile] = useState("");
  const [resetOtp, setResetOtp] = useState("");
  const [resetPassword, setResetPassword] = useState("");
  const [resetPassword2, setResetPassword2] = useState("");

  const persistTokens = useCallback((access: string | null, refresh: string | null) => {
    setAccessToken(access);
    setRefreshToken(refresh);
    if (typeof window === "undefined") return;
    if (access) localStorage.setItem(LS_ACCESS, access);
    else localStorage.removeItem(LS_ACCESS);
    if (refresh) localStorage.setItem(LS_REFRESH, refresh);
    else localStorage.removeItem(LS_REFRESH);
  }, []);

  useEffect(() => {
    const a = localStorage.getItem(LS_ACCESS);
    const r = localStorage.getItem(LS_REFRESH);
    if (a && r) {
      setAccessToken(a);
      setRefreshToken(r);
      setTab("session");
    }
  }, []);

  const loadMe = useCallback(async (token: string) => {
    const res = await authJson<Me>("/auth/me", { accessToken: token });
    if (res.ok) setMe(res.data);
    else {
      setMe(null);
      if (res.status === 401) {
        persistTokens(null, null);
        setTab("login");
        setNotice({ type: "err", text: "Session expired. Sign in again." });
      }
    }
  }, [persistTokens]);

  useEffect(() => {
    if (tab === "session" && accessToken) void loadMe(accessToken);
  }, [tab, accessToken, loadMe]);

  const showErr = (body: ApiErrorBody) =>
    setNotice({ type: "err", text: formatApiError(body) });

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setNotice(null);
    const res = await authJson<{
      access_token: string;
      refresh_token: string;
      expires_in: number;
    }>("/auth/login", {
      method: "POST",
      body: JSON.stringify({
        mobile: loginMobile,
        password: loginPassword,
      }),
    });
    setBusy(false);
    if (!res.ok) {
      showErr(res.body);
      return;
    }
    persistTokens(res.data.access_token, res.data.refresh_token);
    setTab("session");
    setNotice({
      type: "ok",
      text: `Signed in. Access token expires in ${Math.round(res.data.expires_in / 86400)} days (default).`,
    });
    setLoginPassword("");
  }

  async function handleRegister(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setNotice(null);
    const res = await authJson<{
      access_token: string;
      refresh_token: string;
      expires_in: number;
    }>("/auth/register", {
      method: "POST",
      body: JSON.stringify({
        ...(regName.trim() !== "" ? { name: regName.trim() } : {}),
        mobile: regMobile,
        password: regPassword,
        password_confirmation: regPassword2,
      }),
    });
    setBusy(false);
    if (!res.ok) {
      showErr(res.body);
      return;
    }
    persistTokens(res.data.access_token, res.data.refresh_token);
    setTab("session");
    setNotice({ type: "ok", text: "Account created. You are signed in." });
    setRegPassword("");
    setRegPassword2("");
  }

  async function handleForgot(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setNotice(null);
    const res = await authJson<{ message: string }>("/auth/forgot-password", {
      method: "POST",
      body: JSON.stringify({ mobile: forgotMobile }),
    });
    setBusy(false);
    if (!res.ok) {
      showErr(res.body);
      return;
    }
    setNotice({ type: "ok", text: res.data.message });
  }

  async function handleReset(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setNotice(null);
    const res = await authJson<{ message: string }>("/auth/reset-password", {
      method: "POST",
      body: JSON.stringify({
        mobile: resetMobile,
        otp: resetOtp,
        password: resetPassword,
        password_confirmation: resetPassword2,
      }),
    });
    setBusy(false);
    if (!res.ok) {
      showErr(res.body);
      return;
    }
    persistTokens(null, null);
    setMe(null);
    setTab("login");
    setNotice({ type: "ok", text: `${res.data.message} Sign in with your new password.` });
    setResetPassword("");
    setResetPassword2("");
  }

  async function handleRefresh() {
    if (!refreshToken) return;
    setBusy(true);
    setNotice(null);
    const res = await authJson<{
      access_token: string;
      refresh_token: string;
      expires_in: number;
    }>("/auth/refresh", {
      method: "POST",
      body: JSON.stringify({ refresh_token: refreshToken }),
    });
    setBusy(false);
    if (!res.ok) {
      showErr(res.body);
      persistTokens(null, null);
      setTab("login");
      return;
    }
    persistTokens(res.data.access_token, res.data.refresh_token);
    setNotice({ type: "ok", text: "Tokens rotated (new access + refresh)." });
    void loadMe(res.data.access_token);
  }

  async function handleLogout() {
    if (!accessToken) return;
    setBusy(true);
    const res = await authJson("/auth/logout", {
      method: "POST",
      accessToken: accessToken,
      body: JSON.stringify(
        refreshToken ? { refresh_token: refreshToken } : {}
      ),
    });
    setBusy(false);
    if (!res.ok) showErr(res.body);
    persistTokens(null, null);
    setMe(null);
    setTab("login");
    setNotice({ type: "ok", text: "Signed out." });
  }

  const tabs = useMemo(
    () =>
      [
        { id: "login" as const, label: "Login" },
        { id: "register" as const, label: "Register" },
        { id: "forgot" as const, label: "Forgot password" },
        { id: "reset" as const, label: "Reset with OTP" },
        { id: "session" as const, label: "Session" },
      ] satisfies { id: Tab; label: string }[],
    []
  );

  return (
    <div className="w-full max-w-lg">
      <p className="text-sm text-zinc-600 dark:text-zinc-400">
        All requests use <code className="rounded bg-zinc-100 px-1 text-xs dark:bg-zinc-800">/api/auth/*</code>{" "}
        (proxied to Laravel). Mobile numbers are stored as digits only.
      </p>

      <div
        className="mt-4 flex flex-wrap gap-2 border-b border-rose-100/80 pb-3 dark:border-zinc-800"
        role="tablist"
        aria-label="Authentication"
      >
        {tabs.map((t) => (
          <button
            key={t.id}
            type="button"
            role="tab"
            aria-selected={tab === t.id}
            onClick={() => {
              setTab(t.id);
              setNotice(null);
            }}
            className={`rounded-full px-3 py-1.5 text-sm font-medium transition ${
              tab === t.id
                ? "bg-zinc-900 text-white dark:bg-rose-100 dark:text-zinc-900"
                : "bg-zinc-100 text-zinc-700 hover:bg-zinc-200 dark:bg-zinc-800 dark:text-zinc-300 dark:hover:bg-zinc-700"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {notice && (
        <div
          className={`mt-4 rounded-xl border px-3 py-2 text-sm ${
            notice.type === "ok"
              ? "border-emerald-200 bg-emerald-50 text-emerald-950 dark:border-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-100"
              : "border-red-200 bg-red-50 text-red-950 dark:border-red-900 dark:bg-red-950/40 dark:text-red-100"
          }`}
          role="status"
        >
          {notice.text}
        </div>
      )}

      <div className="mt-6 rounded-2xl border border-rose-100/80 bg-white p-6 shadow-sm dark:border-zinc-800 dark:bg-zinc-900/50">
        {tab === "login" && (
          <form onSubmit={handleLogin} className="space-y-4">
            <h2 className="text-lg font-semibold text-zinc-900 dark:text-white">Sign in</h2>
            <div>
              <label className="block text-xs font-medium text-zinc-500 dark:text-zinc-400">
                Mobile number
              </label>
              <input
                className="mt-1 w-full rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-950"
                value={loginMobile}
                onChange={(e) => setLoginMobile(e.target.value)}
                autoComplete="tel"
                required
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-zinc-500 dark:text-zinc-400">
                Password
              </label>
              <input
                type="password"
                className="mt-1 w-full rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-950"
                value={loginPassword}
                onChange={(e) => setLoginPassword(e.target.value)}
                autoComplete="current-password"
                required
              />
            </div>
            <button
              type="submit"
              disabled={busy}
              className="w-full rounded-full bg-zinc-900 py-2.5 text-sm font-semibold text-white hover:bg-zinc-800 disabled:opacity-60 dark:bg-rose-100 dark:text-zinc-900 dark:hover:bg-white"
            >
              {busy ? "…" : "Sign in"}
            </button>
          </form>
        )}

        {tab === "register" && (
          <form onSubmit={handleRegister} className="space-y-4">
            <h2 className="text-lg font-semibold text-zinc-900 dark:text-white">Create account</h2>
            <p className="text-xs text-zinc-500">Email is not required.</p>
            <div>
              <label className="block text-xs font-medium text-zinc-500">Name (optional)</label>
              <input
                className="mt-1 w-full rounded-lg border border-zinc-200 px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-950"
                value={regName}
                onChange={(e) => setRegName(e.target.value)}
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-zinc-500">Mobile</label>
              <input
                className="mt-1 w-full rounded-lg border border-zinc-200 px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-950"
                value={regMobile}
                onChange={(e) => setRegMobile(e.target.value)}
                required
                autoComplete="tel"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-zinc-500">Password</label>
              <input
                type="password"
                className="mt-1 w-full rounded-lg border border-zinc-200 px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-950"
                value={regPassword}
                onChange={(e) => setRegPassword(e.target.value)}
                required
                minLength={8}
                autoComplete="new-password"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-zinc-500">Confirm password</label>
              <input
                type="password"
                className="mt-1 w-full rounded-lg border border-zinc-200 px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-950"
                value={regPassword2}
                onChange={(e) => setRegPassword2(e.target.value)}
                required
                autoComplete="new-password"
              />
            </div>
            <button
              type="submit"
              disabled={busy}
              className="w-full rounded-full bg-zinc-900 py-2.5 text-sm font-semibold text-white hover:bg-zinc-800 disabled:opacity-60 dark:bg-rose-100 dark:text-zinc-900"
            >
              {busy ? "…" : "Register"}
            </button>
          </form>
        )}

        {tab === "forgot" && (
          <form onSubmit={handleForgot} className="space-y-4">
            <h2 className="text-lg font-semibold text-zinc-900 dark:text-white">SMS OTP</h2>
            <p className="text-xs text-zinc-500">
              Sends a 6-digit code to the registered number. With <code className="rounded bg-zinc-100 px-1 dark:bg-zinc-800">SMS_DRIVER=log</code>, check Laravel logs.
            </p>
            <div>
              <label className="block text-xs font-medium text-zinc-500">Mobile</label>
              <input
                className="mt-1 w-full rounded-lg border border-zinc-200 px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-950"
                value={forgotMobile}
                onChange={(e) => setForgotMobile(e.target.value)}
                required
              />
            </div>
            <button
              type="submit"
              disabled={busy}
              className="w-full rounded-full border border-zinc-300 py-2.5 text-sm font-semibold text-zinc-800 hover:bg-zinc-50 dark:border-zinc-600 dark:text-zinc-100 dark:hover:bg-zinc-800"
            >
              {busy ? "…" : "Send OTP"}
            </button>
          </form>
        )}

        {tab === "reset" && (
          <form onSubmit={handleReset} className="space-y-4">
            <h2 className="text-lg font-semibold text-zinc-900 dark:text-white">Set new password</h2>
            <div>
              <label className="block text-xs font-medium text-zinc-500">Mobile</label>
              <input
                className="mt-1 w-full rounded-lg border border-zinc-200 px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-950"
                value={resetMobile}
                onChange={(e) => setResetMobile(e.target.value)}
                required
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-zinc-500">6-digit OTP</label>
              <input
                className="mt-1 w-full rounded-lg border border-zinc-200 px-3 py-2 text-sm tracking-widest dark:border-zinc-700 dark:bg-zinc-950"
                value={resetOtp}
                onChange={(e) => setResetOtp(e.target.value.replace(/\D/g, "").slice(0, 6))}
                required
                maxLength={6}
                inputMode="numeric"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-zinc-500">New password</label>
              <input
                type="password"
                className="mt-1 w-full rounded-lg border border-zinc-200 px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-950"
                value={resetPassword}
                onChange={(e) => setResetPassword(e.target.value)}
                required
                minLength={8}
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-zinc-500">Confirm password</label>
              <input
                type="password"
                className="mt-1 w-full rounded-lg border border-zinc-200 px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-950"
                value={resetPassword2}
                onChange={(e) => setResetPassword2(e.target.value)}
                required
              />
            </div>
            <button
              type="submit"
              disabled={busy}
              className="w-full rounded-full bg-zinc-900 py-2.5 text-sm font-semibold text-white disabled:opacity-60 dark:bg-rose-100 dark:text-zinc-900"
            >
              {busy ? "…" : "Update password"}
            </button>
          </form>
        )}

        {tab === "session" && (
          <div className="space-y-4">
            <h2 className="text-lg font-semibold text-zinc-900 dark:text-white">JWT session</h2>
            {!accessToken ? (
              <p className="text-sm text-zinc-600 dark:text-zinc-400">
                Sign in or register to see your profile and token actions.
              </p>
            ) : (
              <>
                {me ? (
                  <dl className="space-y-2 rounded-xl bg-zinc-50 p-4 text-sm dark:bg-zinc-800/50">
                    <div className="flex justify-between gap-4">
                      <dt className="text-zinc-500">Name</dt>
                      <dd className="font-medium text-zinc-900 dark:text-white">{me.name}</dd>
                    </div>
                    <div className="flex justify-between gap-4">
                      <dt className="text-zinc-500">Mobile</dt>
                      <dd className="font-mono text-zinc-900 dark:text-white">{me.mobile}</dd>
                    </div>
                    <div className="flex justify-between gap-4">
                      <dt className="text-zinc-500">Admin</dt>
                      <dd>{me.is_admin ? "Yes" : "No"}</dd>
                    </div>
                  </dl>
                ) : (
                  <p className="text-sm text-zinc-500">Loading profile…</p>
                )}
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => void handleRefresh()}
                    disabled={busy || !refreshToken}
                    className="rounded-full bg-zinc-900 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50 dark:bg-rose-100 dark:text-zinc-900"
                  >
                    Refresh tokens
                  </button>
                  <button
                    type="button"
                    onClick={() => void handleLogout()}
                    disabled={busy}
                    className="rounded-full border border-zinc-300 px-4 py-2 text-sm font-semibold dark:border-zinc-600"
                  >
                    Logout
                  </button>
                </div>
                <p className="text-xs text-zinc-500">
                  Access token (JWT) and refresh token are kept in{" "}
                  <code className="rounded bg-zinc-100 px-1 dark:bg-zinc-800">localStorage</code> for this demo. Use
                  secure storage in production mobile apps.
                </p>
              </>
            )}
          </div>
        )}
      </div>

      <p className="mt-6 text-center text-xs text-zinc-500">
        <Link href="/" className="font-medium text-rose-800 hover:underline dark:text-rose-200">
          ← Marketing site
        </Link>
      </p>
    </div>
  );
}
