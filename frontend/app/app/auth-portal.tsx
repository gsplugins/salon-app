"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowRight, Eye, EyeOff, LogIn, Sparkles, Store, UserPlus } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { authJson, fetchAuthMe, formatApiError, type ApiErrorBody, type AuthMePayload } from "@/lib/auth-api";
import { broadcastSalonAuthChange } from "@/lib/auth-events";
import { getPrimaryDashboardPath, getRoleLabel } from "@/lib/auth-session";
import { canAccessBarberStaffRoutes, canAccessCustomerPortal, canAccessSalonManagement } from "@/lib/role-access";
import { normalizeMobile } from "@/lib/normalize-mobile";
import { CuttingLoader } from "@/components/ui/cutting-loader";

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
    <section className="rounded-2xl border border-[color:var(--border)] bg-[color:var(--surface)] p-6 shadow-sm">
      <h2 className="text-lg font-semibold text-[color:var(--foreground)]">{title}</h2>
      <p className="mt-1 text-sm text-[color:var(--paragraph)]">{subtitle}</p>
      <div className="mt-5">{children}</div>
    </section>
  );
}

function loginRegisterFirstHint(message: string): string {
  const text = message.toLowerCase();
  if (
    text.includes("invalid") ||
    text.includes("not found") ||
    text.includes("no user") ||
    text.includes("wrong password") ||
    text.includes("credentials")
  ) {
    return "Phone number not registered (or password is incorrect). Please register first.";
  }
  return message;
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
    if (!res.ok) {
      const mappedMessage = loginRegisterFirstHint(formatApiError(res.body));
      setNotice({ type: "err", text: mappedMessage });
      return;
    }
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
          <div className="rounded-2xl border border-[color:var(--border)] bg-[color:var(--surface)] px-6 py-5 shadow-xl">
            <CuttingLoader compact label="Processing..." />
          </div>
        </div>
      ) : null}

      <div className="overflow-hidden rounded-[28px] border border-[color:var(--border)] bg-[color:var(--surface)] shadow-sm">
        <div className="grid min-h-[720px] lg:grid-cols-[0.95fr_1.25fr]">
          <aside className="relative border-r border-[color:var(--border)] bg-[color:var(--surface-elevated)] px-10 py-12">
            <div className="mx-auto flex h-full w-full max-w-sm flex-col items-center justify-center text-center">
              <div className="mb-8 flex items-end gap-2">
                <span className="h-16 w-2 rounded-full bg-[color:var(--brand-primary)]" />
                <span className="h-16 w-2 rounded-full bg-[color:var(--surface)]" />
                <span className="h-16 w-2 rounded-full bg-[color:var(--border)]" />
                <span className="h-16 w-2 rounded-full bg-[color:var(--brand-primary)]" />
                <span className="h-16 w-2 rounded-full bg-[color:var(--surface)]" />
              </div>
              <h2 className="text-5xl font-semibold tracking-[0.08em] text-[color:var(--brand-primary)]">THE</h2>
              <h3 className="mt-2 text-5xl font-semibold tracking-[0.08em] text-[color:var(--brand-primary)]">
                BLADE & CO.
              </h3>
              <p className="mt-4 text-sm uppercase tracking-[0.35em] text-[color:var(--caption)]">Est. 1987</p>
              <div className="my-10 h-px w-14 bg-[color:var(--border)]" />
              <p className="max-w-[240px] text-lg italic leading-relaxed text-[color:var(--paragraph)]">
                &quot;A cut above the rest - precision, style, and tradition.&quot;
              </p>
              <div className="my-10 h-px w-14 bg-[color:var(--border)]" />
              <p className="text-sm uppercase tracking-[0.3em] text-[color:var(--caption)]">Book · Style · Relax</p>
            </div>
          </aside>

          <section className="flex items-center bg-[color:var(--background)] px-4 py-8 sm:px-8 sm:py-10">
            <div className="mx-auto w-full max-w-xl rounded-2xl border border-[color:var(--border)] bg-[color:var(--surface)] p-5 sm:p-8">
              {accessToken && me ? (
                <section className="mb-6 rounded-2xl border border-[color:var(--border)] bg-[color:var(--surface-elevated)] p-5">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[color:var(--brand-primary)]">Signed in</p>
                      <h2 className="mt-1 text-lg font-semibold text-[color:var(--foreground)]">
                        {me.name} · {roleLabel}
                      </h2>
                      <p className="text-xs text-[color:var(--paragraph)]">{me.mobile}</p>
                    </div>
                    {primaryPath ? (
                      <Link
                        href={primaryPath}
                        className="inline-flex min-h-10 items-center gap-2 rounded-full bg-[color:var(--brand-primary)] px-4 py-2 text-sm font-semibold text-white hover:bg-[color:var(--brand-primary-hover)]"
                      >
                        Open dashboard
                        <ArrowRight className="h-4 w-4" />
                      </Link>
                    ) : null}
                  </div>
                  <ul className="mt-4 grid gap-2 sm:grid-cols-3">
                    {featureChips.map((chip) => (
                      <li key={chip} className="rounded-xl border border-[color:var(--border)] bg-[color:var(--surface)] px-3 py-2 text-sm text-[color:var(--paragraph)]">
                        {chip}
                      </li>
                    ))}
                  </ul>
                  <div className="mt-4 flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={() => void handleRefresh()}
                      disabled={busy || !refreshToken}
                      className="min-h-10 rounded-full border border-[color:var(--border)] px-4 py-2 text-sm font-medium text-[color:var(--paragraph)] hover:bg-[color:var(--surface)] disabled:opacity-60"
                    >
                      Refresh token
                    </button>
                    <button
                      type="button"
                      onClick={() => void handleLogout()}
                      disabled={busy}
                      className="min-h-10 rounded-full border border-[color:var(--border)] px-4 py-2 text-sm font-medium text-[color:var(--paragraph)] hover:bg-[color:var(--surface)] disabled:opacity-60"
                    >
                      Sign out
                    </button>
                  </div>
                  {canAccessBarberStaffRoutes(me) ? (
                    <p className="mt-3 text-xs text-[color:var(--paragraph)]">
                      Open the{" "}
                      <Link href="/staff/dashboard" className="font-semibold text-[color:var(--brand-primary)] underline">
                        staff portal
                      </Link>{" "}
                      for schedule, earnings, and profile.
                    </p>
                  ) : null}
                  {canAccessCustomerPortal(me) ? (
                    <p className="mt-3 text-xs text-[color:var(--paragraph)]">
                      Open the{" "}
                      <Link href="/customer/dashboard" className="font-semibold text-[color:var(--brand-primary)] underline">
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
                      ? "border-[color:var(--border)] bg-[color:var(--surface-elevated)] text-[color:var(--foreground)]"
                      : "border-red-200 bg-red-50 text-red-900"
                  }`}
                >
                  {notice.text}
                </div>
              ) : null}

              <div className="mb-6 flex items-center gap-0 border-b border-[color:var(--border)] pb-4 sm:mb-8">
                <button
                  type="button"
                  onClick={() => {
                    setMode("login");
                    setLoginView("login");
                    setNotice(null);
                  }}
                  className={`inline-flex min-h-10 items-center justify-center gap-2 border border-[color:var(--border)] px-6 py-2 text-sm font-semibold tracking-[0.2em] transition ${
                    mode === "login"
                      ? "text-[color:var(--brand-primary)]"
                      : "text-[color:var(--caption)] hover:text-[color:var(--foreground)]"
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
                  className={`inline-flex min-h-10 items-center justify-center gap-2 border border-l-0 border-[color:var(--border)] px-6 py-2 text-sm font-semibold tracking-[0.2em] transition ${
                    mode === "register"
                      ? "text-[color:var(--brand-primary)]"
                      : "text-[color:var(--caption)] hover:text-[color:var(--foreground)]"
                  }`}
                >
                  <UserPlus className="h-4 w-4" aria-hidden />
                  REGISTER
                </button>
              </div>

              {mode === "login" && loginView === "login" ? (
                <div>
                  <h2 className="text-3xl font-semibold text-[color:var(--foreground)] sm:text-4xl">Welcome back</h2>
                  <p className="mt-2 text-base text-[color:var(--paragraph)] sm:text-xl">Sign in to manage your appointments</p>
                  <form onSubmit={handleLogin} className="mt-6 space-y-5 sm:mt-7">
                    <label className="text-xs font-medium text-[color:var(--paragraph)]">
                      Mobile
                      <input
                        className="mt-1 w-full rounded-lg border border-[color:var(--border)] bg-[color:var(--surface)] px-3 py-2 text-sm text-[color:var(--foreground)]"
                        value={loginMobile}
                        onChange={(e) => setLoginMobile(e.target.value)}
                        autoComplete="tel"
                        inputMode="tel"
                        placeholder="01711 000000"
                        required
                      />
                    </label>
                    <label className="text-xs font-medium text-[color:var(--paragraph)]">
                      Password
                      <div className="relative mt-1">
                        <input
                          type={showLoginPassword ? "text" : "password"}
                          className="w-full rounded-xl border border-[color:var(--border)] bg-[color:var(--surface)] py-2.5 pl-3 pr-11 text-sm text-[color:var(--foreground)]"
                          value={loginPassword}
                          onChange={(e) => setLoginPassword(e.target.value)}
                          autoComplete="current-password"
                          required
                        />
                        <button
                          type="button"
                          disabled={busy}
                          className="absolute right-2 top-1/2 -translate-y-1/2 rounded-lg p-1.5 text-[color:var(--paragraph)] hover:bg-[color:var(--surface-elevated)]"
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
                      className="mt-2 w-full min-h-12 rounded-xl border border-[color:var(--border)] bg-[color:var(--surface)] px-4 py-3 text-sm font-semibold uppercase tracking-[0.2em] text-[color:var(--brand-primary)] hover:bg-[color:var(--surface-elevated)] disabled:opacity-60"
                    >
                      {busy ? (
                        "Signing in..."
                      ) : (
                        <span className="inline-flex items-center gap-2">
                          <ArrowRight className="h-4 w-4" aria-hidden />
                          SIGN IN
                        </span>
                      )}
                    </button>
                    <div className="pt-1 flex items-center justify-end">
                      <button
                        type="button"
                        className="text-sm text-[color:var(--paragraph)] hover:text-[color:var(--brand-primary)]"
                        disabled={busy}
                        onClick={() => {
                          setLoginView("forgot");
                          setNotice(null);
                        }}
                      >
                        Forgot password?
                      </button>
                    </div>
                    <p className="pt-1 text-center text-sm text-[color:var(--paragraph)]">
                      New here?{" "}
                      <button
                        type="button"
                        className="font-medium text-[color:var(--brand-primary)] underline"
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
                  <h2 className="text-3xl font-semibold text-[color:var(--foreground)] sm:text-4xl">Create account</h2>
                  <p className="mt-2 text-base text-[color:var(--paragraph)] sm:text-xl">Register as customer or shop owner</p>
                  <form onSubmit={registerMode === "shop" ? handleRegisterShop : handleRegisterCustomer} className="mt-6 space-y-5 sm:mt-7">
              <div className="grid gap-3 sm:grid-cols-2">
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => setRegisterMode("customer")}
                        className={`rounded-2xl border px-4 py-4 text-left transition ${
                    registerMode === "customer"
                            ? "border-[color:var(--brand-primary)] bg-[color:var(--surface-elevated)]"
                            : "border-[color:var(--border)] bg-[color:var(--surface)] hover:border-[color:var(--brand-primary)]"
                  }`}
                >
                        <Sparkles className="h-6 w-6 text-[color:var(--brand-primary)]" aria-hidden />
                        <p className="mt-2 font-semibold text-[color:var(--foreground)]">Customer</p>
                        <p className="mt-1 text-xs text-[color:var(--paragraph)]">Book visits and track loyalty.</p>
                </button>
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => setRegisterMode("shop")}
                        className={`rounded-2xl border px-4 py-4 text-left transition ${
                    registerMode === "shop"
                            ? "border-[color:var(--brand-primary)] bg-[color:var(--surface-elevated)]"
                            : "border-[color:var(--border)] bg-[color:var(--surface)] hover:border-[color:var(--brand-primary)]"
                  }`}
                >
                        <Store className="h-6 w-6 text-[color:var(--brand-primary)]" aria-hidden />
                        <p className="mt-2 font-semibold text-[color:var(--foreground)]">Shop owner</p>
                        <p className="mt-1 text-xs text-[color:var(--paragraph)]">Create business and booking link.</p>
                </button>
              </div>

              {registerMode === "shop" ? (
                <div className="grid gap-3 sm:grid-cols-2">
                        <label className="text-xs font-medium text-[color:var(--paragraph)] sm:col-span-2">
                    Business name
                    <input
                            className="mt-1 w-full rounded-lg border border-[color:var(--border)] bg-[color:var(--surface)] px-3 py-2 text-sm text-[color:var(--foreground)]"
                      value={shopName}
                      onChange={(e) => setShopName(e.target.value)}
                      required
                      autoComplete="organization"
                      placeholder="BarbarShop Studio"
                    />
                  </label>
                        <label className="text-xs font-medium text-[color:var(--paragraph)] sm:col-span-2">
                    Public shop slug
                    <input
                            className="mt-1 w-full rounded-lg border border-[color:var(--border)] bg-[color:var(--surface)] px-3 py-2 font-mono text-sm text-[color:var(--foreground)]"
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
                          <p className="mt-1 text-[11px] text-[color:var(--paragraph)]">
                      Booking URL preview: <span className="font-mono">/s/{shopSlug || "your-slug"}/book</span>
                    </p>
                  </label>
                        <label className="text-xs font-medium text-[color:var(--paragraph)] sm:col-span-2">
                    Shop description (optional)
                    <textarea
                      rows={2}
                            className="mt-1 w-full resize-none rounded-lg border border-[color:var(--border)] bg-[color:var(--surface)] px-3 py-2 text-sm text-[color:var(--foreground)]"
                      value={shopDescription}
                      onChange={(e) => setShopDescription(e.target.value)}
                      placeholder="What makes your salon special?"
                    />
                  </label>
                </div>
              ) : null}

              <div className="grid gap-3 sm:grid-cols-2">
                      <label className="text-xs font-medium text-[color:var(--paragraph)]">
                  Your name {registerMode === "customer" ? "(optional)" : ""}
                  <input
                          className="mt-1 w-full rounded-lg border border-[color:var(--border)] bg-[color:var(--surface)] px-3 py-2 text-sm text-[color:var(--foreground)]"
                    value={regName}
                    onChange={(e) => setRegName(e.target.value)}
                    required={registerMode === "shop"}
                    autoComplete="name"
                  />
                </label>
                      <label className="text-xs font-medium text-[color:var(--paragraph)]">
                  Mobile
                  <input
                          className="mt-1 w-full rounded-lg border border-[color:var(--border)] bg-[color:var(--surface)] px-3 py-2 text-sm text-[color:var(--foreground)]"
                    value={regMobile}
                    onChange={(e) => setRegMobile(e.target.value)}
                    required
                    autoComplete="tel"
                    inputMode="tel"
                  />
                </label>
                      <label className="text-xs font-medium text-[color:var(--paragraph)]">
                  Password (min 8 chars)
                  <div className="relative mt-1">
                    <input
                      type={showRegPassword ? "text" : "password"}
                            className="w-full rounded-xl border border-[color:var(--border)] bg-[color:var(--surface)] py-2.5 pl-3 pr-11 text-sm text-[color:var(--foreground)]"
                      value={regPassword}
                      onChange={(e) => setRegPassword(e.target.value)}
                      required
                      minLength={8}
                      autoComplete="new-password"
                    />
                    <button
                      type="button"
                      disabled={busy}
                            className="absolute right-2 top-1/2 -translate-y-1/2 rounded-lg p-1.5 text-[color:var(--paragraph)] hover:bg-[color:var(--surface-elevated)]"
                      onClick={() => setShowRegPassword((v) => !v)}
                      aria-label={showRegPassword ? "Hide password" : "Show password"}
                    >
                      {showRegPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                </label>
                      <label className="text-xs font-medium text-[color:var(--paragraph)]">
                  Confirm password
                  <div className="relative mt-1">
                    <input
                      type={showRegPassword2 ? "text" : "password"}
                            className="w-full rounded-xl border border-[color:var(--border)] bg-[color:var(--surface)] py-2.5 pl-3 pr-11 text-sm text-[color:var(--foreground)]"
                      value={regPassword2}
                      onChange={(e) => setRegPassword2(e.target.value)}
                      required
                      autoComplete="new-password"
                    />
                    <button
                      type="button"
                      disabled={busy}
                            className="absolute right-2 top-1/2 -translate-y-1/2 rounded-lg p-1.5 text-[color:var(--paragraph)] hover:bg-[color:var(--surface-elevated)]"
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
                      className="w-full min-h-12 rounded-xl border border-[color:var(--border)] bg-[color:var(--surface)] px-4 py-3 text-sm font-semibold uppercase tracking-[0.2em] text-[color:var(--brand-primary)] hover:bg-[color:var(--surface-elevated)] disabled:opacity-60"
              >
                {busy ? "Please wait..." : registerMode === "shop" ? "Create shop account" : "Create customer account"}
              </button>
                    <button
                      type="button"
                      className="w-full text-center text-sm text-[color:var(--paragraph)]"
                      onClick={() => {
                        setMode("login");
                        setLoginView("login");
                        setNotice(null);
                      }}
                    >
                      Already have an account? <span className="text-[color:var(--brand-primary)]">Sign in now</span>
                    </button>
                  </form>
                </div>
              ) : null}

              {mode === "login" && loginView === "forgot" ? (
                <SectionCard title="Forgot password" subtitle="Request OTP by SMS for your registered mobile number.">
                  <form onSubmit={handleForgot} className="space-y-4">
                    <label className="block text-xs font-medium text-[color:var(--paragraph)]">
                Mobile
                <input
                  className="mt-1 w-full rounded-lg border border-[color:var(--border)] bg-[color:var(--surface)] px-3 py-2 text-sm text-[color:var(--foreground)]"
                  value={forgotMobile}
                  onChange={(e) => setForgotMobile(e.target.value)}
                  required
                />
              </label>
              <button
                type="submit"
                disabled={busy}
                className="w-full min-h-11 rounded-full border border-[color:var(--border)] px-4 py-2.5 text-sm font-semibold text-[color:var(--foreground)] hover:bg-[color:var(--surface-elevated)] disabled:opacity-60"
              >
                {busy ? "Sending..." : "Send OTP"}
              </button>
              <button
                type="button"
                disabled={busy}
                className="w-full min-h-11 rounded-full border border-[color:var(--border)] px-4 py-2.5 text-sm font-semibold text-[color:var(--foreground)] hover:bg-[color:var(--surface-elevated)]"
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
                    <label className="block text-xs font-medium text-[color:var(--paragraph)]">
                Mobile
                <input
                  className="mt-1 w-full rounded-lg border border-[color:var(--border)] bg-[color:var(--surface)] px-3 py-2 text-sm text-[color:var(--foreground)]"
                  value={resetMobile}
                  onChange={(e) => setResetMobile(e.target.value)}
                  required
                />
              </label>
              <label className="block text-xs font-medium text-[color:var(--paragraph)]">
                OTP
                <input
                  className="mt-1 w-full rounded-lg border border-[color:var(--border)] bg-[color:var(--surface)] px-3 py-2 text-sm tracking-widest text-[color:var(--foreground)]"
                  value={resetOtp}
                  onChange={(e) => setResetOtp(e.target.value.replace(/\D/g, "").slice(0, 6))}
                  required
                  maxLength={6}
                  inputMode="numeric"
                />
              </label>
              <label className="block text-xs font-medium text-[color:var(--paragraph)]">
                New password
                <input
                  type="password"
                  className="mt-1 w-full rounded-lg border border-[color:var(--border)] bg-[color:var(--surface)] px-3 py-2 text-sm text-[color:var(--foreground)]"
                  value={resetPassword}
                  onChange={(e) => setResetPassword(e.target.value)}
                  minLength={8}
                  required
                />
              </label>
              <label className="block text-xs font-medium text-[color:var(--paragraph)]">
                Confirm password
                <input
                  type="password"
                  className="mt-1 w-full rounded-lg border border-[color:var(--border)] bg-[color:var(--surface)] px-3 py-2 text-sm text-[color:var(--foreground)]"
                  value={resetPassword2}
                  onChange={(e) => setResetPassword2(e.target.value)}
                  required
                />
              </label>
              <button
                type="submit"
                disabled={busy}
                className="w-full min-h-11 rounded-full bg-[color:var(--brand-primary)] px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-60"
              >
                {busy ? "Updating..." : "Update password"}
              </button>
              <button
                type="button"
                disabled={busy}
                className="w-full min-h-11 rounded-full border border-[color:var(--border)] px-4 py-2.5 text-sm font-semibold text-[color:var(--foreground)] hover:bg-[color:var(--surface-elevated)]"
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

      <p className="mt-4 text-center text-xs text-[color:var(--paragraph)]">
        <Link href="/" className="font-medium text-[color:var(--brand-primary)] hover:underline">
          Back to marketing site
        </Link>
      </p>
    </div>
  );
}
