"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowRight, Eye, EyeOff, Loader2, LogIn, Sparkles, Store, UserPlus } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { authJson, fetchAuthMe, formatApiError, type ApiErrorBody, type AuthMePayload } from "@/lib/auth-api";
import { broadcastSalonAuthChange } from "@/lib/auth-events";
import { getPrimaryDashboardPath, getRoleLabel } from "@/lib/auth-session";
import { canAccessBarberStaffRoutes, canAccessCustomerPortal, canAccessSalonManagement } from "@/lib/role-access";
import { normalizeMobile } from "@/lib/normalize-mobile";

const LS_ACCESS = "salon_access_token";
const LS_REFRESH = "salon_refresh_token";

type Tab = "login" | "register" | "forgot" | "reset";
type AuthMode = "login" | "register";
type LoginView = "login" | "forgot" | "reset";
type RegisterMode = "customer" | "shop";

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
    <section className="section-wrap p-6 shadow-sm">
      <h2 className="text-lg font-semibold text-white">{title}</h2>
      <p className="mt-1 text-sm text-slate-300">{subtitle}</p>
      <div className="mt-5">{children}</div>
    </section>
  );
}

export function AuthPortal({ initialTab = "login" }: { initialTab?: Tab }) {
  const router = useRouter();
  const [mode, setMode] = useState<AuthMode>(initialTab === "register" ? "register" : "login");
  const [loginView, setLoginView] = useState<LoginView>(
    initialTab === "forgot" ? "forgot" : initialTab === "reset" ? "reset" : "login"
  );
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
       
      setAccessToken(a);
      setRefreshToken(r);
    }
  }, []);

  useEffect(() => {
    if (registerMode !== "shop" || shopSlugTouched) return;
    const s = slugifyShopSlug(shopName);
     
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
     
    if (accessToken) void loadMe(accessToken);
  }, [accessToken, loadMe]);

  const showErr = (body: ApiErrorBody) => setNotice({ type: "err", text: formatApiError(body) });

  const redirectToRoleDashboard = useCallback(
    async (token: string) => {
      const meRes = await fetchAuthMe(token);
      if (!meRes.ok) {
        setNotice({ type: "err", text: formatApiError(meRes.body) });
        return;
      }
      setMe(meRes.data);
      router.push(getPrimaryDashboardPath(meRes.data));
    },
    [router]
  );

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
        mobile: normalizeMobile(loginMobile.trim()),
        password: loginPassword.trim(),
      }),
    });
    setBusy(false);
    if (!res.ok) return showErr(res.body);
    persistTokens(res.data.access_token, res.data.refresh_token);
    setLoginPassword("");
    await redirectToRoleDashboard(res.data.access_token);
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
        mobile: normalizeMobile(regMobile.trim()),
        password: regPassword,
        password_confirmation: regPassword2,
      }),
    });
    setBusy(false);
    if (!res.ok) return showErr(res.body);
    persistTokens(res.data.access_token, res.data.refresh_token);
    setRegPassword("");
    setRegPassword2("");
    await redirectToRoleDashboard(res.data.access_token);
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
        mobile: normalizeMobile(regMobile.trim()),
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
    setRegPassword("");
    setRegPassword2("");
    setShopName("");
    setShopSlug("");
    setShopDescription("");
    setShopSlugTouched(false);
    await redirectToRoleDashboard(res.data.access_token);
  }

  async function handleForgot(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setNotice(null);
    const res = await authJson<{ message: string }>("/auth/forgot-password", {
      method: "POST",
      body: JSON.stringify({ mobile: normalizeMobile(forgotMobile.trim()) }),
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
        mobile: normalizeMobile(resetMobile.trim()),
        otp: resetOtp,
        password: resetPassword,
        password_confirmation: resetPassword2,
      }),
    });
    setBusy(false);
    if (!res.ok) return showErr(res.body);
    persistTokens(null, null);
    setMe(null);
    setMode("login");
    setLoginView("login");
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

  useEffect(() => {
    setMode(initialTab === "register" ? "register" : "login");
    setLoginView(initialTab === "forgot" ? "forgot" : initialTab === "reset" ? "reset" : "login");
  }, [initialTab]);

  useEffect(() => {
    if (!accessToken || !me || !primaryPath) return;
    router.replace(primaryPath);
  }, [accessToken, me, primaryPath, router]);

  return (
    <div className="w-full">
      {busy ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-[2px]">
          <div className="rounded-2xl border border-[#3b4a59] bg-[#1f3a4a] px-5 py-4 text-sm font-medium text-white shadow-xl">
            <span className="inline-flex items-center gap-2">
              <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
              Processing...
            </span>
          </div>
        </div>
      ) : null}

      <div className="overflow-hidden rounded-[28px] border border-[#2b333c] bg-[#1e262f]">
        <div className="grid min-h-[720px] lg:grid-cols-[0.95fr_1.25fr]">
          <aside className="relative border-r border-[#2b333c] bg-[#171e25] px-10 py-12">
            <div className="mx-auto flex h-full w-full max-w-sm flex-col items-center justify-center text-center">
              <div className="mb-8 flex items-end gap-2">
                <span className="h-16 w-2 rounded-full bg-[#c6a43f]" />
                <span className="h-16 w-2 rounded-full bg-[#ffffff]" />
                <span className="h-16 w-2 rounded-full bg-[#b0b8c1]" />
                <span className="h-16 w-2 rounded-full bg-[#c6a43f]" />
                <span className="h-16 w-2 rounded-full bg-[#ffffff]" />
              </div>
              <h2 className="text-5xl font-semibold tracking-[0.08em] text-[#c6a43f]">THE</h2>
              <h3 className="mt-2 text-5xl font-semibold tracking-[0.08em] text-[#c6a43f]">
                BLADE & CO.
              </h3>
              <p className="mt-4 text-sm uppercase tracking-[0.35em] text-[#b0b8c1]">Est. 1987</p>
              <div className="my-10 h-px w-14 bg-[#3b4a59]" />
              <p className="max-w-[240px] text-lg italic leading-relaxed text-[#b0b8c1]">
                &quot;A cut above the rest - precision, style, and tradition.&quot;
              </p>
              <div className="my-10 h-px w-14 bg-[#3b4a59]" />
              <p className="text-sm uppercase tracking-[0.3em] text-[#b0b8c1]">Book · Style · Relax</p>
            </div>
          </aside>

          <section className="flex items-center bg-[#0f151b] px-6 py-10 sm:px-10">
            <div className="mx-auto w-full max-w-xl rounded-2xl border border-[#2b333c] bg-[#111922] p-6 sm:p-8">
              {accessToken && me ? (
                <section className="mb-6 rounded-2xl border border-[#3b4a59] bg-[#1f3a4a] p-5">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[#c6a43f]">Signed in</p>
                      <h2 className="mt-1 text-lg font-semibold text-white">
                        {me.name} · {roleLabel}
                      </h2>
                      <p className="text-xs text-[#b0b8c1]">{me.mobile}</p>
                    </div>
                    {primaryPath ? (
                      <Link
                        href={primaryPath}
                        className="inline-flex min-h-10 items-center gap-2 rounded-full bg-[#c6a43f] px-4 py-2 text-sm font-semibold text-[#1e262f] hover:bg-[#d4b14b]"
                      >
                        Open dashboard
                        <ArrowRight className="h-4 w-4" />
                      </Link>
                    ) : null}
                  </div>
                  <ul className="mt-4 grid gap-2 sm:grid-cols-3">
                    {featureChips.map((chip) => (
                      <li key={chip} className="rounded-xl border border-[#3b4a59] bg-[#1e262f] px-3 py-2 text-sm text-[#b0b8c1]">
                        {chip}
                      </li>
                    ))}
                  </ul>
                  <div className="mt-4 flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={() => void handleRefresh()}
                      disabled={busy || !refreshToken}
                      className="min-h-10 rounded-full border border-[#3b4a59] px-4 py-2 text-sm font-medium text-[#b0b8c1] disabled:opacity-60"
                    >
                      Refresh token
                    </button>
                    <button
                      type="button"
                      onClick={() => void handleLogout()}
                      disabled={busy}
                      className="min-h-10 rounded-full border border-[#3b4a59] px-4 py-2 text-sm font-medium text-[#b0b8c1] disabled:opacity-60"
                    >
                      Sign out
                    </button>
                  </div>
                  {canAccessBarberStaffRoutes(me) ? (
                    <p className="mt-3 text-xs text-[#b0b8c1]">
                      Open the{" "}
                      <Link href="/staff/dashboard" className="font-semibold text-[#c6a43f] underline">
                        staff portal
                      </Link>{" "}
                      for schedule, earnings, and profile.
                    </p>
                  ) : null}
                  {canAccessCustomerPortal(me) ? (
                    <p className="mt-3 text-xs text-[#b0b8c1]">
                      Open the{" "}
                      <Link href="/customer/dashboard" className="font-semibold text-[#c6a43f] underline">
                        customer portal
                      </Link>{" "}
                      for bookings and loyalty.
                    </p>
                  ) : null}
                </section>
              ) : null}

              {notice ? (
                <div
                  className={`mb-5 rounded-xl border px-3 py-2 text-sm ${
                    notice.type === "ok"
                      ? "border-[#3b4a59] bg-[#1f3a4a] text-white"
                      : "border-[#7f1d1d] bg-[#3b1212] text-white"
                  }`}
                >
                  {notice.text}
                </div>
              ) : null}

              <div className="mb-8 flex items-center gap-0 border-b border-[#2b333c] pb-4">
                <button
                  type="button"
                  onClick={() => {
                    setMode("login");
                    setLoginView("login");
                    setNotice(null);
                  }}
                  className={`inline-flex min-h-10 items-center justify-center gap-2 border border-[#2b333c] px-6 py-2 text-sm font-semibold tracking-[0.2em] transition ${
                    mode === "login"
                      ? "text-[#c6a43f]"
                      : "text-[#b0b8c1] hover:text-white"
                  }`}
                >
                  <LogIn className="h-4 w-4" aria-hidden />
                  SIGN IN
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setMode("register");
                    setNotice(null);
                  }}
                  className={`inline-flex min-h-10 items-center justify-center gap-2 border border-l-0 border-[#2b333c] px-6 py-2 text-sm font-semibold tracking-[0.2em] transition ${
                    mode === "register"
                      ? "text-[#c6a43f]"
                      : "text-[#b0b8c1] hover:text-white"
                  }`}
                >
                  <UserPlus className="h-4 w-4" aria-hidden />
                  REGISTER
                </button>
              </div>

              {mode === "login" && loginView === "login" ? (
                <div>
                  <h2 className="text-4xl font-semibold text-white">Welcome back</h2>
                  <p className="mt-2 text-xl text-[#b0b8c1]">Sign in to manage your appointments</p>
                  <form onSubmit={handleLogin} className="mt-8 space-y-6">
                    <label className="block text-sm font-medium uppercase tracking-[0.18em] text-[#b0b8c1]">
                Mobile number
                <input
                  className="mt-2 w-full rounded-xl border border-[#3b4a59] bg-white px-5 py-3 text-2xl text-[#1e262f] shadow-sm placeholder:text-[#6b7280]"
                  value={loginMobile}
                  onChange={(e) => setLoginMobile(e.target.value)}
                  autoComplete="tel"
                  inputMode="tel"
                  placeholder="01711 000000"
                  required
                />
              </label>
                    <label className="block text-sm font-medium uppercase tracking-[0.18em] text-[#b0b8c1]">
                Password
                <div className="relative mt-2">
                  <input
                    type={showLoginPassword ? "text" : "password"}
                    className="w-full rounded-xl border border-[#3b4a59] bg-white py-3 pl-5 pr-12 text-2xl text-[#1e262f] shadow-sm"
                    value={loginPassword}
                    onChange={(e) => setLoginPassword(e.target.value)}
                    autoComplete="current-password"
                    required
                  />
                  <button
                    type="button"
                    disabled={busy}
                    className="absolute right-2 top-1/2 -translate-y-1/2 rounded-lg p-1.5 text-[#475569] hover:bg-[#e5e7eb]"
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
                className="inline-flex w-full min-h-12 items-center justify-center gap-2 rounded-xl border border-[#3b4a59] bg-transparent px-4 py-3 text-base font-semibold uppercase tracking-[0.2em] text-[#c6a43f] hover:bg-[#1f3a4a] disabled:opacity-60"
              >
                {busy ? "Signing in..." : (
                  <>
                    <ArrowRight className="h-4 w-4" aria-hidden />
                    SIGN IN
                  </>
                )}
              </button>
                    <div className="flex items-center justify-end">
                      <button
                        type="button"
                        className="text-lg text-[#b0b8c1] hover:text-[#c6a43f]"
                        disabled={busy}
                        onClick={() => {
                          setLoginView("forgot");
                          setNotice(null);
                        }}
                      >
                        Forgot password?
                      </button>
                    </div>
                    <p className="pt-2 text-center text-lg text-[#b0b8c1]">
                New here?{" "}
                <button
                  type="button"
                  className="font-medium text-[#c6a43f] underline"
                  disabled={busy}
                  onClick={() => {
                    setMode("register");
                    setRegisterMode("customer");
                    setNotice(null);
                  }}
                >
                  Register now
                </button>
              </p>
                  </form>
                </div>
              ) : null}

              {mode === "register" ? (
                <div>
                  <h2 className="text-4xl font-semibold text-white">Create account</h2>
                  <p className="mt-2 text-xl text-[#b0b8c1]">Register as customer or shop owner</p>
                  <form onSubmit={registerMode === "shop" ? handleRegisterShop : handleRegisterCustomer} className="mt-7 space-y-5">
              <div className="grid gap-3 sm:grid-cols-2">
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => setRegisterMode("customer")}
                        className={`rounded-2xl border px-4 py-4 text-left transition ${
                    registerMode === "customer"
                            ? "border-[#c6a43f] bg-[#1f3a4a]"
                            : "border-[#3b4a59] bg-[#1e262f] hover:border-[#c6a43f]"
                  }`}
                >
                        <Sparkles className="h-6 w-6 text-[#c6a43f]" aria-hidden />
                        <p className="mt-2 font-semibold text-white">Customer</p>
                        <p className="mt-1 text-xs text-[#b0b8c1]">Book visits and track loyalty.</p>
                </button>
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => setRegisterMode("shop")}
                        className={`rounded-2xl border px-4 py-4 text-left transition ${
                    registerMode === "shop"
                            ? "border-[#c6a43f] bg-[#1f3a4a]"
                            : "border-[#3b4a59] bg-[#1e262f] hover:border-[#c6a43f]"
                  }`}
                >
                        <Store className="h-6 w-6 text-[#c6a43f]" aria-hidden />
                        <p className="mt-2 font-semibold text-white">Shop owner</p>
                        <p className="mt-1 text-xs text-[#b0b8c1]">Create business and booking link.</p>
                </button>
              </div>

              {registerMode === "shop" ? (
                <div className="grid gap-3 sm:grid-cols-2">
                        <label className="text-xs font-medium text-[#b0b8c1] sm:col-span-2">
                    Business name
                    <input
                            className="mt-1 w-full rounded-lg border border-[#3b4a59] bg-[#0f151b] px-3 py-2 text-sm text-white"
                      value={shopName}
                      onChange={(e) => setShopName(e.target.value)}
                      required
                      autoComplete="organization"
                      placeholder="BarbarShop Studio"
                    />
                  </label>
                        <label className="text-xs font-medium text-[#b0b8c1] sm:col-span-2">
                    Public shop slug
                    <input
                            className="mt-1 w-full rounded-lg border border-[#3b4a59] bg-[#0f151b] px-3 py-2 font-mono text-sm text-white"
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
                          <p className="mt-1 text-[11px] text-[#b0b8c1]">
                      Booking URL preview: <span className="font-mono">/s/{shopSlug || "your-slug"}/book</span>
                    </p>
                  </label>
                        <label className="text-xs font-medium text-[#b0b8c1] sm:col-span-2">
                    Shop description (optional)
                    <textarea
                      rows={2}
                            className="mt-1 w-full resize-none rounded-lg border border-[#3b4a59] bg-[#0f151b] px-3 py-2 text-sm text-white"
                      value={shopDescription}
                      onChange={(e) => setShopDescription(e.target.value)}
                      placeholder="What makes your salon special?"
                    />
                  </label>
                </div>
              ) : null}

              <div className="grid gap-3 sm:grid-cols-2">
                      <label className="text-xs font-medium text-[#b0b8c1]">
                  Your name {registerMode === "customer" ? "(optional)" : ""}
                  <input
                          className="mt-1 w-full rounded-lg border border-[#3b4a59] bg-[#0f151b] px-3 py-2 text-sm text-white"
                    value={regName}
                    onChange={(e) => setRegName(e.target.value)}
                    required={registerMode === "shop"}
                    autoComplete="name"
                  />
                </label>
                      <label className="text-xs font-medium text-[#b0b8c1]">
                  Mobile
                  <input
                          className="mt-1 w-full rounded-lg border border-[#3b4a59] bg-[#0f151b] px-3 py-2 text-sm text-white"
                    value={regMobile}
                    onChange={(e) => setRegMobile(e.target.value)}
                    required
                    autoComplete="tel"
                    inputMode="tel"
                  />
                </label>
                      <label className="text-xs font-medium text-[#b0b8c1]">
                  Password (min 8 chars)
                  <div className="relative mt-1">
                    <input
                      type={showRegPassword ? "text" : "password"}
                            className="w-full rounded-xl border border-[#3b4a59] bg-[#0f151b] py-2.5 pl-3 pr-11 text-sm text-white"
                      value={regPassword}
                      onChange={(e) => setRegPassword(e.target.value)}
                      required
                      minLength={8}
                      autoComplete="new-password"
                    />
                    <button
                      type="button"
                      disabled={busy}
                            className="absolute right-2 top-1/2 -translate-y-1/2 rounded-lg p-1.5 text-[#b0b8c1] hover:bg-[#1f3a4a]"
                      onClick={() => setShowRegPassword((v) => !v)}
                      aria-label={showRegPassword ? "Hide password" : "Show password"}
                    >
                      {showRegPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                </label>
                      <label className="text-xs font-medium text-[#b0b8c1]">
                  Confirm password
                  <div className="relative mt-1">
                    <input
                      type={showRegPassword2 ? "text" : "password"}
                            className="w-full rounded-xl border border-[#3b4a59] bg-[#0f151b] py-2.5 pl-3 pr-11 text-sm text-white"
                      value={regPassword2}
                      onChange={(e) => setRegPassword2(e.target.value)}
                      required
                      autoComplete="new-password"
                    />
                    <button
                      type="button"
                      disabled={busy}
                            className="absolute right-2 top-1/2 -translate-y-1/2 rounded-lg p-1.5 text-[#b0b8c1] hover:bg-[#1f3a4a]"
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
                      className="w-full min-h-12 rounded-xl border border-[#3b4a59] bg-transparent px-4 py-3 text-sm font-semibold uppercase tracking-[0.2em] text-[#c6a43f] hover:bg-[#1f3a4a] disabled:opacity-60"
              >
                {busy ? "Please wait..." : registerMode === "shop" ? "Create shop account" : "Create customer account"}
              </button>
                    <button
                      type="button"
                      className="w-full text-center text-sm text-[#b0b8c1]"
                      onClick={() => {
                        setMode("login");
                        setLoginView("login");
                        setNotice(null);
                      }}
                    >
                      Already have an account? <span className="text-[#c6a43f]">Sign in now</span>
                    </button>
                  </form>
                </div>
              ) : null}

              {mode === "login" && loginView === "forgot" ? (
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
                className="w-full min-h-11 rounded-full border border-zinc-300 px-4 py-2.5 text-sm font-semibold text-zinc-800 hover:bg-zinc-50 disabled:opacity-60 dark:border-zinc-600 dark:text-zinc-100 dark:hover:bg-zinc-800"
              >
                {busy ? "Sending..." : "Send OTP"}
              </button>
              <button
                type="button"
                disabled={busy}
                className="w-full min-h-11 rounded-full border border-zinc-300 px-4 py-2.5 text-sm font-semibold text-zinc-800 hover:bg-zinc-50 dark:border-zinc-600 dark:text-zinc-100 dark:hover:bg-zinc-800"
                onClick={() => setLoginView("login")}
              >
                Back to login
              </button>
                  </form>
                </SectionCard>
              ) : null}

              {mode === "login" && loginView === "reset" ? (
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
                className="w-full min-h-11 rounded-full bg-blue-500 px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-60"
              >
                {busy ? "Updating..." : "Update password"}
              </button>
              <button
                type="button"
                disabled={busy}
                className="w-full min-h-11 rounded-full border border-zinc-300 px-4 py-2.5 text-sm font-semibold text-zinc-800 hover:bg-zinc-50 dark:border-zinc-600 dark:text-zinc-100 dark:hover:bg-zinc-800"
                onClick={() => setLoginView("login")}
              >
                Back to login
              </button>
                  </form>
                </SectionCard>
              ) : null}
            </div>
          </section>
        </div>
      </div>

      <p className="mt-4 text-center text-xs text-[#b0b8c1]">
        <Link href="/" className="font-medium text-[#c6a43f] hover:underline">
          Back to marketing site
        </Link>
      </p>
    </div>
  );
}
