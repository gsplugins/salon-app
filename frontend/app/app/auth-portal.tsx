"use client";

import Link from "next/link";
import { ArrowRight, Eye, EyeOff, Sparkles, Store } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { authJson, formatApiError, type ApiErrorBody, type AuthMePayload } from "@/lib/auth-api";
import { broadcastSalonAuthChange } from "@/lib/auth-events";
import { getPrimaryDashboardPath, getRoleLabel } from "@/lib/auth-session";
import { canAccessBarberStaffRoutes, canAccessCustomerPortal, canAccessSalonManagement } from "@/lib/role-access";

const LS_ACCESS = "salon_access_token";
const LS_REFRESH = "salon_refresh_token";

type Tab = "login" | "register" | "forgot" | "reset";
type RegisterMode = "customer" | "shop";

function normalizeMobileInput(raw: string): string {
  return raw.replace(/\D/g, "");
}

function slugifyShopSlug(input: string): string {
  return input
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 64);
}

function SectionCard(props: { title: string; subtitle: string; children: React.ReactNode }) {
  const { title, subtitle, children } = props;
  return (
    <section className="rounded-2xl border border-zinc-200/90 bg-white p-6 shadow-sm dark:border-zinc-800 dark:bg-zinc-900/60">
      <h2 className="text-lg font-semibold text-zinc-900 dark:text-white">{title}</h2>
      <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">{subtitle}</p>
      <div className="mt-5">{children}</div>
    </section>
  );
}

export function AuthPortal() {
  const [tab, setTab] = useState<Tab>("login");
  const [accessToken, setAccessToken] = useState<string | null>(null);
  const [refreshToken, setRefreshToken] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<{ type: "ok" | "err"; text: string } | null>(null);
  const [me, setMe] = useState<AuthMePayload | null>(null);

  const [showLoginPassword, setShowLoginPassword] = useState(false);
  const [showRegPassword, setShowRegPassword] = useState(false);
  const [showRegPassword2, setShowRegPassword2] = useState(false);

  const [loginMobile, setLoginMobile] = useState("");
  const [loginPassword, setLoginPassword] = useState("");
  const [regName, setRegName] = useState("");
  const [regMobile, setRegMobile] = useState("");
  const [regPassword, setRegPassword] = useState("");
  const [regPassword2, setRegPassword2] = useState("");
  const [registerMode, setRegisterMode] = useState<RegisterMode>("customer");
  const [shopName, setShopName] = useState("");
  const [shopSlug, setShopSlug] = useState("");
  const [shopSlugTouched, setShopSlugTouched] = useState(false);
  const [shopDescription, setShopDescription] = useState("");
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
    broadcastSalonAuthChange();
  }, []);

  useEffect(() => {
    const a = localStorage.getItem(LS_ACCESS);
    const r = localStorage.getItem(LS_REFRESH);
    if (a && r) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- restore session from localStorage
      setAccessToken(a);
      setRefreshToken(r);
    }
  }, []);

  useEffect(() => {
    if (registerMode !== "shop" || shopSlugTouched) return;
    const s = slugifyShopSlug(shopName);
    // eslint-disable-next-line react-hooks/set-state-in-effect -- keep slug synced until user edits
    setShopSlug(s);
  }, [shopName, registerMode, shopSlugTouched]);

  const loadMe = useCallback(
    async (token: string) => {
      const res = await authJson<AuthMePayload>("/auth/me", { accessToken: token });
      if (res.ok) {
        setMe(res.data);
        return;
      }
      setMe(null);
      if (res.status === 401) {
        persistTokens(null, null);
        setNotice({ type: "err", text: "Session expired. Sign in again." });
      }
    },
    [persistTokens]
  );

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- fetch profile for role-aware dashboard card
    if (accessToken) void loadMe(accessToken);
  }, [accessToken, loadMe]);

  const showErr = (body: ApiErrorBody) => setNotice({ type: "err", text: formatApiError(body) });

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
        mobile: normalizeMobileInput(loginMobile),
        password: loginPassword,
      }),
    });
    setBusy(false);
    if (!res.ok) return showErr(res.body);
    persistTokens(res.data.access_token, res.data.refresh_token);
    setNotice({
      type: "ok",
      text: `Signed in. Access token expires in ${Math.round(res.data.expires_in / 86400)} days.`,
    });
    setLoginPassword("");
  }

  async function handleRegisterCustomer(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setNotice(null);
    const res = await authJson<{
      access_token: string;
      refresh_token: string;
    }>("/auth/register", {
      method: "POST",
      body: JSON.stringify({
        ...(regName.trim() !== "" ? { name: regName.trim() } : {}),
        mobile: normalizeMobileInput(regMobile),
        password: regPassword,
        password_confirmation: regPassword2,
      }),
    });
    setBusy(false);
    if (!res.ok) return showErr(res.body);
    persistTokens(res.data.access_token, res.data.refresh_token);
    setNotice({ type: "ok", text: "Customer account created and signed in." });
    setRegPassword("");
    setRegPassword2("");
  }

  async function handleRegisterShop(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setNotice(null);
    const slug = slugifyShopSlug(shopSlug || shopName);
    const res = await authJson<{
      access_token: string;
      refresh_token: string;
    }>("/auth/register-barber", {
      method: "POST",
      body: JSON.stringify({
        ...(regName.trim() !== "" ? { name: regName.trim() } : {}),
        mobile: normalizeMobileInput(regMobile),
        password: regPassword,
        password_confirmation: regPassword2,
        shop_name: shopName.trim(),
        shop_slug: slug,
        ...(shopDescription.trim() !== "" ? { description: shopDescription.trim() } : {}),
      }),
    });
    setBusy(false);
    if (!res.ok) return showErr(res.body);
    persistTokens(res.data.access_token, res.data.refresh_token);
    setNotice({ type: "ok", text: "Shop account created with trial subscription. You're signed in as owner." });
    setRegPassword("");
    setRegPassword2("");
    setShopName("");
    setShopSlug("");
    setShopDescription("");
    setShopSlugTouched(false);
  }

  async function handleForgot(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setNotice(null);
    const res = await authJson<{ message: string }>("/auth/forgot-password", {
      method: "POST",
      body: JSON.stringify({ mobile: normalizeMobileInput(forgotMobile) }),
    });
    setBusy(false);
    if (!res.ok) return showErr(res.body);
    setNotice({ type: "ok", text: res.data.message });
  }

  async function handleReset(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setNotice(null);
    const res = await authJson<{ message: string }>("/auth/reset-password", {
      method: "POST",
      body: JSON.stringify({
        mobile: normalizeMobileInput(resetMobile),
        otp: resetOtp,
        password: resetPassword,
        password_confirmation: resetPassword2,
      }),
    });
    setBusy(false);
    if (!res.ok) return showErr(res.body);
    persistTokens(null, null);
    setMe(null);
    setTab("login");
    setNotice({ type: "ok", text: `${res.data.message} Please sign in with your new password.` });
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
    }>("/auth/refresh", {
      method: "POST",
      body: JSON.stringify({ refresh_token: refreshToken }),
    });
    setBusy(false);
    if (!res.ok) {
      showErr(res.body);
      persistTokens(null, null);
      return;
    }
    persistTokens(res.data.access_token, res.data.refresh_token);
    setNotice({ type: "ok", text: "Session refreshed." });
    void loadMe(res.data.access_token);
  }

  async function handleLogout() {
    if (!accessToken) return;
    setBusy(true);
    const res = await authJson("/auth/logout", {
      method: "POST",
      accessToken,
      body: JSON.stringify(refreshToken ? { refresh_token: refreshToken } : {}),
    });
    setBusy(false);
    if (!res.ok) showErr(res.body);
    persistTokens(null, null);
    setMe(null);
    setNotice({ type: "ok", text: "Signed out." });
  }

  const roleLabel = me ? getRoleLabel(me) : null;
  const primaryPath = me ? getPrimaryDashboardPath(me) : null;
  const featureChips = me
    ? canAccessSalonManagement(me)
      ? ["Bookings & queue", "Staff & services", "Reports & reviews"]
      : canAccessCustomerPortal(me)
        ? ["Quick booking", "Loyalty & history", "Visit tracking"]
        : ["Role-based access"]
    : [];

  const tabs: { id: Tab; label: string }[] = [
    { id: "login", label: "Login" },
    { id: "register", label: "Register" },
    { id: "forgot", label: "Forgot password" },
    { id: "reset", label: "Reset OTP" },
  ];

  return (
    <div className="w-full space-y-6">

      {accessToken && me ? (
        <section className="rounded-2xl border border-zinc-200/90 bg-white p-5 shadow-sm dark:border-zinc-800 dark:bg-zinc-900/60">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-rose-800 dark:text-rose-200">Signed in</p>
              <h2 className="mt-1 text-lg font-semibold text-zinc-900 dark:text-white">
                {me.name} · {roleLabel}
              </h2>
              <p className="text-xs text-zinc-500">{me.mobile}</p>
            </div>
            {primaryPath ? (
              <Link
                href={primaryPath}
                className="inline-flex min-h-10 items-center gap-2 rounded-full bg-zinc-900 px-4 py-2 text-sm font-semibold text-white dark:bg-rose-100 dark:text-zinc-900"
              >
                Open dashboard
                <ArrowRight className="h-4 w-4" />
              </Link>
            ) : null}
          </div>
          <ul className="mt-4 grid gap-2 sm:grid-cols-3">
            {featureChips.map((chip) => (
              <li key={chip} className="rounded-xl border border-zinc-200 bg-zinc-50/80 px-3 py-2 text-sm text-zinc-700 dark:border-zinc-700 dark:bg-zinc-950/40 dark:text-zinc-300">
                {chip}
              </li>
            ))}
          </ul>
          <div className="mt-4 flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => void handleRefresh()}
              disabled={busy || !refreshToken}
              className="min-h-10 rounded-full border border-zinc-300 px-4 py-2 text-sm font-medium disabled:opacity-60 dark:border-zinc-600"
            >
              Refresh token
            </button>
            <button
              type="button"
              onClick={() => void handleLogout()}
              disabled={busy}
              className="min-h-10 rounded-full border border-zinc-300 px-4 py-2 text-sm font-medium disabled:opacity-60 dark:border-zinc-600"
            >
              Sign out
            </button>
          </div>
          {canAccessBarberStaffRoutes(me) ? (
            <p className="mt-3 text-xs text-zinc-500">
              Open the{" "}
              <Link href="/staff/dashboard" className="font-semibold text-rose-800 underline dark:text-rose-200">
                staff portal
              </Link>{" "}
              for schedule, earnings, and profile.
            </p>
          ) : null}
          {canAccessCustomerPortal(me) ? (
            <p className="mt-3 text-xs text-zinc-500">
              Open the{" "}
              <Link href="/customer/dashboard" className="font-semibold text-rose-800 underline dark:text-rose-200">
                customer portal
              </Link>{" "}
              for bookings and loyalty.
            </p>
          ) : null}
        </section>
      ) : null}

      {notice ? (
        <div
          className={`rounded-xl border px-3 py-2 text-sm ${
            notice.type === "ok"
              ? "border-emerald-200 bg-emerald-50 text-emerald-950 dark:border-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-100"
              : "border-red-200 bg-red-50 text-red-950 dark:border-red-900 dark:bg-red-950/40 dark:text-red-100"
          }`}
        >
          {notice.text}
        </div>
      ) : null}

      <div className="rounded-2xl border border-zinc-200/90 bg-white p-4 shadow-sm dark:border-zinc-800 dark:bg-zinc-900/60 sm:p-6">
        <div className="mb-5 flex flex-wrap gap-2 border-b border-zinc-100 pb-4 dark:border-zinc-800" role="tablist" aria-label="Auth tabs">
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

        {tab === "login" ? (
          <SectionCard
            title="Sign in"
            subtitle="Use your mobile and password. Role-based features unlock automatically after login."
          >
            <form onSubmit={handleLogin} className="space-y-4">
              <label className="block text-xs font-medium text-zinc-500 dark:text-zinc-400">
                Mobile number
                <input
                  className="mt-1 w-full rounded-xl border border-zinc-200 bg-white px-3 py-2.5 text-sm shadow-sm dark:border-zinc-700 dark:bg-zinc-950"
                  value={loginMobile}
                  onChange={(e) => setLoginMobile(e.target.value)}
                  autoComplete="tel"
                  inputMode="tel"
                  placeholder="e.g. 01711 000000"
                  required
                />
              </label>
              <label className="block text-xs font-medium text-zinc-500 dark:text-zinc-400">
                Password
                <div className="relative mt-1">
                  <input
                    type={showLoginPassword ? "text" : "password"}
                    className="w-full rounded-xl border border-zinc-200 bg-white py-2.5 pl-3 pr-11 text-sm shadow-sm dark:border-zinc-700 dark:bg-zinc-950"
                    value={loginPassword}
                    onChange={(e) => setLoginPassword(e.target.value)}
                    autoComplete="current-password"
                    required
                  />
                  <button
                    type="button"
                    className="absolute right-2 top-1/2 -translate-y-1/2 rounded-lg p-1.5 text-zinc-500 hover:bg-zinc-100 hover:text-zinc-800 dark:hover:bg-zinc-800 dark:hover:text-zinc-200"
                    onClick={() => setShowLoginPassword((v) => !v)}
                    aria-label={showLoginPassword ? "Hide password" : "Show password"}
                  >
                    {showLoginPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </label>
              <button
                type="submit"
                disabled={busy}
                className="w-full rounded-full bg-zinc-900 py-3 text-sm font-semibold text-white shadow-sm hover:bg-zinc-800 disabled:opacity-60 dark:bg-rose-100 dark:text-zinc-900 dark:hover:bg-white"
              >
                {busy ? "Signing in..." : "Sign in"}
              </button>
              <p className="text-center text-xs text-zinc-500">
                New here?{" "}
                <button
                  type="button"
                  className="font-medium text-rose-800 underline dark:text-rose-200"
                  onClick={() => {
                    setTab("register");
                    setRegisterMode("customer");
                    setNotice(null);
                  }}
                >
                  Create an account
                </button>
              </p>
            </form>
          </SectionCard>
        ) : null}

        {tab === "register" ? (
          <SectionCard
            title="Create account"
            subtitle="Customers can self-register. Shop owners can register business accounts with booking URL."
          >
            <form onSubmit={registerMode === "shop" ? handleRegisterShop : handleRegisterCustomer} className="space-y-5">
              <div className="grid gap-3 sm:grid-cols-2">
                <button
                  type="button"
                  onClick={() => setRegisterMode("customer")}
                  className={`rounded-2xl border px-4 py-4 text-left transition ${
                    registerMode === "customer"
                      ? "border-rose-400 bg-rose-50/90 ring-1 ring-rose-200 dark:border-rose-700 dark:bg-rose-950/40 dark:ring-rose-800"
                      : "border-zinc-200 bg-white hover:border-zinc-300 dark:border-zinc-700 dark:bg-zinc-950/40"
                  }`}
                >
                  <Sparkles className="h-6 w-6 text-rose-600 dark:text-rose-300" aria-hidden />
                  <p className="mt-2 font-semibold text-zinc-900 dark:text-white">Customer</p>
                  <p className="mt-1 text-xs text-zinc-500">Book visits and track loyalty.</p>
                </button>
                <button
                  type="button"
                  onClick={() => setRegisterMode("shop")}
                  className={`rounded-2xl border px-4 py-4 text-left transition ${
                    registerMode === "shop"
                      ? "border-rose-400 bg-rose-50/90 ring-1 ring-rose-200 dark:border-rose-700 dark:bg-rose-950/40 dark:ring-rose-800"
                      : "border-zinc-200 bg-white hover:border-zinc-300 dark:border-zinc-700 dark:bg-zinc-950/40"
                  }`}
                >
                  <Store className="h-6 w-6 text-rose-600 dark:text-rose-300" aria-hidden />
                  <p className="mt-2 font-semibold text-zinc-900 dark:text-white">Shop owner</p>
                  <p className="mt-1 text-xs text-zinc-500">Create business and booking link.</p>
                </button>
              </div>

              {registerMode === "shop" ? (
                <div className="grid gap-3 sm:grid-cols-2">
                  <label className="text-xs font-medium text-zinc-500 sm:col-span-2">
                    Business name
                    <input
                      className="mt-1 w-full rounded-lg border border-zinc-200 px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-950"
                      value={shopName}
                      onChange={(e) => setShopName(e.target.value)}
                      required
                      autoComplete="organization"
                      placeholder="Lumière Studio"
                    />
                  </label>
                  <label className="text-xs font-medium text-zinc-500 sm:col-span-2">
                    Public shop slug
                    <input
                      className="mt-1 w-full rounded-lg border border-zinc-200 px-3 py-2 font-mono text-sm dark:border-zinc-700 dark:bg-zinc-950"
                      value={shopSlug}
                      onChange={(e) => {
                        setShopSlugTouched(true);
                        setShopSlug(e.target.value);
                      }}
                      required
                      pattern="[a-z0-9]+(?:-[a-z0-9]+)*"
                      title="Lowercase letters, numbers and hyphen only"
                      placeholder="lumiere-studio"
                    />
                    <p className="mt-1 text-[11px] text-zinc-500">
                      Booking URL preview: <span className="font-mono">/s/{shopSlug || "your-slug"}/book</span>
                    </p>
                  </label>
                  <label className="text-xs font-medium text-zinc-500 sm:col-span-2">
                    Shop description (optional)
                    <textarea
                      rows={2}
                      className="mt-1 w-full resize-none rounded-lg border border-zinc-200 px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-950"
                      value={shopDescription}
                      onChange={(e) => setShopDescription(e.target.value)}
                      placeholder="What makes your salon special?"
                    />
                  </label>
                </div>
              ) : null}

              <div className="grid gap-3 sm:grid-cols-2">
                <label className="text-xs font-medium text-zinc-500">
                  Your name {registerMode === "customer" ? "(optional)" : ""}
                  <input
                    className="mt-1 w-full rounded-lg border border-zinc-200 px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-950"
                    value={regName}
                    onChange={(e) => setRegName(e.target.value)}
                    required={registerMode === "shop"}
                    autoComplete="name"
                  />
                </label>
                <label className="text-xs font-medium text-zinc-500">
                  Mobile
                  <input
                    className="mt-1 w-full rounded-lg border border-zinc-200 px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-950"
                    value={regMobile}
                    onChange={(e) => setRegMobile(e.target.value)}
                    required
                    autoComplete="tel"
                    inputMode="tel"
                  />
                </label>
                <label className="text-xs font-medium text-zinc-500">
                  Password (min 8 chars)
                  <div className="relative mt-1">
                    <input
                      type={showRegPassword ? "text" : "password"}
                      className="w-full rounded-xl border border-zinc-200 py-2.5 pl-3 pr-11 text-sm dark:border-zinc-700 dark:bg-zinc-950"
                      value={regPassword}
                      onChange={(e) => setRegPassword(e.target.value)}
                      required
                      minLength={8}
                      autoComplete="new-password"
                    />
                    <button
                      type="button"
                      className="absolute right-2 top-1/2 -translate-y-1/2 rounded-lg p-1.5 text-zinc-500 hover:bg-zinc-100 dark:hover:bg-zinc-800"
                      onClick={() => setShowRegPassword((v) => !v)}
                      aria-label={showRegPassword ? "Hide password" : "Show password"}
                    >
                      {showRegPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                </label>
                <label className="text-xs font-medium text-zinc-500">
                  Confirm password
                  <div className="relative mt-1">
                    <input
                      type={showRegPassword2 ? "text" : "password"}
                      className="w-full rounded-xl border border-zinc-200 py-2.5 pl-3 pr-11 text-sm dark:border-zinc-700 dark:bg-zinc-950"
                      value={regPassword2}
                      onChange={(e) => setRegPassword2(e.target.value)}
                      required
                      autoComplete="new-password"
                    />
                    <button
                      type="button"
                      className="absolute right-2 top-1/2 -translate-y-1/2 rounded-lg p-1.5 text-zinc-500 hover:bg-zinc-100 dark:hover:bg-zinc-800"
                      onClick={() => setShowRegPassword2((v) => !v)}
                      aria-label={showRegPassword2 ? "Hide password" : "Show password"}
                    >
                      {showRegPassword2 ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                </label>
              </div>

              <button
                type="submit"
                disabled={busy}
                className="w-full rounded-full bg-zinc-900 py-3 text-sm font-semibold text-white shadow-sm hover:bg-zinc-800 disabled:opacity-60 dark:bg-rose-100 dark:text-zinc-900"
              >
                {busy ? "Please wait..." : registerMode === "shop" ? "Create shop account" : "Create customer account"}
              </button>
            </form>
          </SectionCard>
        ) : null}

        {tab === "forgot" ? (
          <SectionCard title="Forgot password" subtitle="Request OTP by SMS for your registered mobile number.">
            <form onSubmit={handleForgot} className="space-y-4">
              <label className="block text-xs font-medium text-zinc-500 dark:text-zinc-400">
                Mobile
                <input
                  className="mt-1 w-full rounded-lg border border-zinc-200 px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-950"
                  value={forgotMobile}
                  onChange={(e) => setForgotMobile(e.target.value)}
                  required
                />
              </label>
              <button
                type="submit"
                disabled={busy}
                className="w-full rounded-full border border-zinc-300 py-2.5 text-sm font-semibold text-zinc-800 hover:bg-zinc-50 disabled:opacity-60 dark:border-zinc-600 dark:text-zinc-100 dark:hover:bg-zinc-800"
              >
                {busy ? "Sending..." : "Send OTP"}
              </button>
            </form>
          </SectionCard>
        ) : null}

        {tab === "reset" ? (
          <SectionCard title="Reset password with OTP" subtitle="Enter mobile, 6-digit OTP, and your new password.">
            <form onSubmit={handleReset} className="space-y-4">
              <label className="block text-xs font-medium text-zinc-500 dark:text-zinc-400">
                Mobile
                <input
                  className="mt-1 w-full rounded-lg border border-zinc-200 px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-950"
                  value={resetMobile}
                  onChange={(e) => setResetMobile(e.target.value)}
                  required
                />
              </label>
              <label className="block text-xs font-medium text-zinc-500 dark:text-zinc-400">
                OTP
                <input
                  className="mt-1 w-full rounded-lg border border-zinc-200 px-3 py-2 text-sm tracking-widest dark:border-zinc-700 dark:bg-zinc-950"
                  value={resetOtp}
                  onChange={(e) => setResetOtp(e.target.value.replace(/\D/g, "").slice(0, 6))}
                  required
                  maxLength={6}
                  inputMode="numeric"
                />
              </label>
              <label className="block text-xs font-medium text-zinc-500 dark:text-zinc-400">
                New password
                <input
                  type="password"
                  className="mt-1 w-full rounded-lg border border-zinc-200 px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-950"
                  value={resetPassword}
                  onChange={(e) => setResetPassword(e.target.value)}
                  minLength={8}
                  required
                />
              </label>
              <label className="block text-xs font-medium text-zinc-500 dark:text-zinc-400">
                Confirm password
                <input
                  type="password"
                  className="mt-1 w-full rounded-lg border border-zinc-200 px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-950"
                  value={resetPassword2}
                  onChange={(e) => setResetPassword2(e.target.value)}
                  required
                />
              </label>
              <button
                type="submit"
                disabled={busy}
                className="w-full rounded-full bg-zinc-900 py-2.5 text-sm font-semibold text-white disabled:opacity-60 dark:bg-rose-100 dark:text-zinc-900"
              >
                {busy ? "Updating..." : "Update password"}
              </button>
            </form>
          </SectionCard>
        ) : null}
      </div>

      <p className="text-center text-xs text-zinc-500">
        <Link href="/" className="font-medium text-rose-800 hover:underline dark:text-rose-200">
          Back to marketing site
        </Link>
      </p>

    </div>
  );
}
