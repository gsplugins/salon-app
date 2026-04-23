"use client";

import Link from "next/link";
import {
  CalendarDays,
  Contact,
  Copy,
  ExternalLink,
  LayoutDashboard,
  RefreshCw,
  Scissors,
  Store,
  Users,
  type LucideIcon,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import type { AuthMePayload } from "@/lib/auth-api";
import { ownerShopBase } from "@/lib/owner-shop-paths";
import {
  createBlockedSlot,
  createWalkInBooking,
  deleteBlockedSlot,
  fetchAdminBookings,
  fetchBlockedSlots,
  fetchSalonServices,
  fetchSalonStaff,
  fetchShopStats,
  fetchStaffCatalog,
  formatApiError,
  patchBooking,
  type BlockedSlotRow,
  type BookingRow,
  type CatalogStaffRow,
  type SalonServiceRow,
  type SalonStaffOption,
  type ShopStats,
} from "@/lib/salon-api";
import { Skeleton } from "@/components/ui/skeleton";
import {
  ShopClientsPanel,
  ShopOverviewPanel,
  ShopServicesPanel,
  ShopSettingsPanel,
  ShopTeamPanel,
} from "@/app/app/salon-shop-panels";

const STATUS_OPTIONS = [
  { value: "pending", label: "Pending" },
  { value: "confirmed", label: "Confirmed" },
  { value: "completed", label: "Completed" },
  { value: "cancelled", label: "Cancelled" },
  { value: "no_show", label: "No-show" },
] as const;

function formatYmd(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function mondayOfWeek(ref: Date): Date {
  const d = new Date(ref);
  const dow = d.getDay();
  const diff = dow === 0 ? -6 : 1 - dow;
  d.setDate(d.getDate() + diff);
  d.setHours(12, 0, 0, 0);
  return d;
}

function addDays(d: Date, n: number): Date {
  const x = new Date(d);
  x.setDate(x.getDate() + n);
  return x;
}

function addMonths(d: Date, n: number): Date {
  const x = new Date(d);
  x.setMonth(x.getMonth() + n);
  return x;
}

function staffOptionsForService(catalog: CatalogStaffRow[], serviceId: number): CatalogStaffRow[] {
  return catalog.filter((s) => s.is_active && s.services.some((svc) => svc.id === serviceId));
}

/** Pending edits: ensure the currently assigned stylist appears even if the menu was changed. */
function staffRowsForPendingEdit(
  catalog: CatalogStaffRow[],
  serviceId: number,
  current: { id: number; name: string }
): CatalogStaffRow[] {
  const opts = staffOptionsForService(catalog, serviceId);
  if (opts.some((s) => s.id === current.id)) return opts;
  return [
    ...opts,
    {
      id: current.id,
      name: current.name,
      is_active: true,
      sort_order: 0,
      services: [],
    },
  ];
}

function startOfDay(d: Date): Date {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

function formatShort(iso: string): string {
  return new Intl.DateTimeFormat(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(iso));
}

type ViewMode = "calendar" | "list";

type BookingsRangeMode = "week" | "all";

export type SalonAdminSection = "overview" | "bookings" | "services" | "team" | "clients" | "shop";

type AdminSection = SalonAdminSection;

type SectionNavItem = {
  id: AdminSection;
  label: string;
  hint: string;
  icon: LucideIcon;
};

export const SECTION_NAV: SectionNavItem[] = [
  { id: "overview", label: "Overview", hint: "KPIs & links", icon: LayoutDashboard },
  { id: "bookings", label: "Bookings", hint: "Calendar & list", icon: CalendarDays },
  { id: "services", label: "Services", hint: "Menu & pricing", icon: Scissors },
  { id: "team", label: "Team", hint: "Staff & logins", icon: Users },
  { id: "clients", label: "Clients", hint: "Visit history", icon: Contact },
  { id: "shop", label: "Shop settings", hint: "Hours & contact", icon: Store },
];

function allowedSections(me?: AuthMePayload | null): AdminSection[] {
  if (!me) return SECTION_NAV.map((s) => s.id);
  if (me.role === "barber") return ["bookings", "clients"];
  return SECTION_NAV.map((s) => s.id);
}

export function SalonBookingAdmin({
  accessToken,
  shopSlug,
  me,
  embedInSession = false,
  embedSessionHeader,
  controlledSection,
  onControlledSectionChange,
}: {
  accessToken: string;
  shopSlug: string;
  /** When present, shows owner shortcuts and display name in the console header. */
  me?: AuthMePayload | null;
  /** Lighter chrome when nested under Profile | Shop workspace (`/app`). */
  embedInSession?: boolean;
  /** When `embedInSession`, set `false` if the parent renders the top bar (default: show bar). */
  embedSessionHeader?: boolean;
  /** When both are set, section tabs are rendered by the parent (inline sub-tabs). */
  controlledSection?: AdminSection;
  onControlledSectionChange?: (section: AdminSection) => void;
}) {
  const [internalSection, setInternalSection] = useState<AdminSection>("overview");
  const isSectionControlled =
    controlledSection !== undefined && onControlledSectionChange !== undefined;
  const section = isSectionControlled ? controlledSection! : internalSection;
  function setSection(next: AdminSection) {
    if (isSectionControlled) onControlledSectionChange!(next);
    else setInternalSection(next);
  }
  const showEmbedSessionTop = embedInSession && embedSessionHeader !== false;
  const visibleSectionIds = useMemo(() => allowedSections(me), [me]);
  const visibleSections = useMemo(
    () => SECTION_NAV.filter((s) => visibleSectionIds.includes(s.id)),
    [visibleSectionIds]
  );
  const [view, setView] = useState<ViewMode>("calendar");
  const bookingsActive = section === "bookings";
  const [weekAnchor, setWeekAnchor] = useState(() => new Date());
  const [rangeMode, setRangeMode] = useState<BookingsRangeMode>("week");
  const [statusFilter, setStatusFilter] = useState<string>("");
  const [bookings, setBookings] = useState<BookingRow[]>([]);
  const [blocks, setBlocks] = useState<BlockedSlotRow[]>([]);
  const [services, setServices] = useState<SalonServiceRow[]>([]);
  const [staffCatalog, setStaffCatalog] = useState<CatalogStaffRow[]>([]);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<{ type: "ok" | "err"; text: string } | null>(null);
  const [headerStats, setHeaderStats] = useState<ShopStats | null>(null);
  const [headerStatsLoading, setHeaderStatsLoading] = useState(true);
  const bookingPublicUrl = useMemo(() => {
    if (typeof window === "undefined") return "";
    return `${window.location.origin}/s/${encodeURIComponent(shopSlug)}/book`;
  }, [shopSlug]);

  const weekStart = useMemo(() => mondayOfWeek(weekAnchor), [weekAnchor]);
  const weekEnd = useMemo(() => addDays(weekStart, 6), [weekStart]);

  const { fromStr, toStr, bookingQuery } = useMemo(() => {
    if (rangeMode === "week") {
      const from = formatYmd(weekStart);
      const to = formatYmd(weekEnd);
      return {
        fromStr: from,
        toStr: to,
        bookingQuery: { from, to, ...(statusFilter ? { status: statusFilter } : {}) },
      };
    }
    const today = new Date();
    const from = startOfDay(addMonths(today, -18));
    const to = startOfDay(addMonths(today, 18));
    const fromS = formatYmd(from);
    const toS = formatYmd(to);
    return {
      fromStr: fromS,
      toStr: toS,
      bookingQuery: { from: fromS, to: toS, ...(statusFilter ? { status: statusFilter } : {}) },
    };
  }, [rangeMode, weekStart, weekEnd, statusFilter]);

  const loadAll = useCallback(async () => {
    setBusy(true);
    setNotice(null);
    const [b, bl, sv, st] = await Promise.all([
      fetchAdminBookings(accessToken, bookingQuery),
      fetchBlockedSlots(fromStr, toStr, accessToken),
      fetchSalonServices(shopSlug),
      fetchStaffCatalog(accessToken),
    ]);
    setBusy(false);
    if (!b.ok) {
      setNotice({ type: "err", text: formatApiError(b.body) });
      return;
    }
    if (!bl.ok) {
      setNotice({ type: "err", text: formatApiError(bl.body) });
      return;
    }
    if (!sv.ok) {
      setNotice({ type: "err", text: formatApiError(sv.body) });
      return;
    }
    if (!st.ok) {
      setNotice({ type: "err", text: formatApiError(st.body) });
      return;
    }
    setBookings(b.data);
    setBlocks(bl.data);
    setServices(sv.data);
    setStaffCatalog(st.data);
  }, [accessToken, bookingQuery, fromStr, toStr, shopSlug]);

  useEffect(() => {
    if (!bookingsActive) return;
     
    void loadAll();
  }, [loadAll, bookingsActive]);

  useEffect(() => {
    if (rangeMode === "all" && view === "calendar") {
       
      setView("list");
    }
  }, [rangeMode, view]);

  useEffect(() => {
    if (!visibleSectionIds.includes(section)) {
      const next = visibleSectionIds[0] ?? "bookings";
       
      setSection(next);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- setSection is intentionally stable-enough here
  }, [section, visibleSectionIds]);

  const loadHeaderStats = useCallback(async () => {
    setHeaderStatsLoading(true);
    const res = await fetchShopStats(accessToken);
    setHeaderStatsLoading(false);
    if (!res.ok) {
      setHeaderStats(null);
      return;
    }
    setHeaderStats(res.data);
  }, [accessToken]);

  useEffect(() => {
     
    void loadHeaderStats();
  }, [loadHeaderStats]);

  const pendingInList = useMemo(
    () => bookings.filter((b) => b.status === "pending").length,
    [bookings]
  );

  const dayLabels = useMemo(() => {
    const out: { date: Date; key: string; label: string }[] = [];
    for (let i = 0; i < 7; i += 1) {
      const d = addDays(weekStart, i);
      out.push({
        date: d,
        key: formatYmd(d),
        label: new Intl.DateTimeFormat(undefined, { weekday: "short", month: "short", day: "numeric" }).format(d),
      });
    }
    return out;
  }, [weekStart]);

  async function onStatusChange(id: number, status: string) {
    setBusy(true);
    const res = await patchBooking(accessToken, id, { status });
    setBusy(false);
    if (!res.ok) {
      setNotice({ type: "err", text: formatApiError(res.body) });
      return;
    }
    setNotice({ type: "ok", text: "Booking updated." });
    void loadAll();
    void loadHeaderStats();
  }

  async function onStaffChange(id: number, salonStaffId: number) {
    setBusy(true);
    const res = await patchBooking(accessToken, id, { salon_staff_id: salonStaffId });
    setBusy(false);
    if (!res.ok) {
      setNotice({ type: "err", text: formatApiError(res.body) });
      return;
    }
    setNotice({ type: "ok", text: "Staff updated." });
    void loadAll();
    void loadHeaderStats();
  }

  async function onDeleteBlock(id: number) {
    if (!confirm("Remove this blocked time?")) return;
    setBusy(true);
    const res = await deleteBlockedSlot(accessToken, id);
    setBusy(false);
    if (!res.ok) {
      setNotice({ type: "err", text: formatApiError(res.body) });
      return;
    }
    void loadAll();
    void loadHeaderStats();
  }

  async function copyBookingUrl() {
    if (!bookingPublicUrl) {
      toast.error("Link not ready yet — try again.");
      return;
    }
    try {
      await navigator.clipboard.writeText(bookingPublicUrl);
      toast.success("Public booking link copied");
    } catch {
      toast.error("Could not copy automatically.");
    }
  }

  const shopTitle = me?.shop?.name?.trim() || shopSlug;
  const accessLabel =
    me?.shop_access?.role === "owner"
      ? "Owner"
      : me?.shop_access?.role === "manager"
        ? "Manager"
        : me?.shop_access?.role === "barber"
          ? "Stylist"
          : me?.is_shop_owner
            ? "Owner"
            : "Team";

  const headerActions = (
    <>
      <div className="flex flex-wrap gap-2">
        {headerStatsLoading ? (
          <Skeleton className="h-9 w-28 rounded-full" />
        ) : headerStats ? (
          <>
            <span
              className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-sm ${
                embedInSession
                  ? "border border-zinc-200 bg-white text-zinc-800 dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-100"
                  : "bg-white/10 text-white backdrop-blur-sm"
              }`}
              title="From shop analytics"
            >
              <CalendarDays className="h-4 w-4 opacity-80" />
              <span className="font-medium tabular-nums">{headerStats.bookings_today}</span>
              <span className={embedInSession ? "text-zinc-500" : "text-white/70"}>today</span>
            </span>
            <button
              type="button"
              onClick={() => {
                setSection("bookings");
                setStatusFilter("pending");
                setRangeMode("week");
              }}
              className={`inline-flex min-h-9 items-center gap-1.5 rounded-full px-3 py-1.5 text-sm font-medium touch-manipulation active:scale-[0.99] ${
                embedInSession
                  ? "border border-amber-200 bg-amber-50 text-amber-950 hover:bg-amber-100 dark:border-amber-900/50 dark:bg-amber-950/40 dark:text-amber-100"
                  : "border border-amber-300/40 bg-amber-500/20 text-amber-50 hover:bg-amber-500/30"
              }`}
            >
              {bookingsActive ? pendingInList : headerStats.pending_upcoming} pending
            </button>
          </>
        ) : null}
        <button
          type="button"
          onClick={() => void loadHeaderStats()}
          className={`inline-flex min-h-9 items-center gap-1 rounded-full px-3 py-1.5 text-sm touch-manipulation active:scale-[0.99] ${
            embedInSession
              ? "border border-zinc-200 text-zinc-700 hover:bg-zinc-50 dark:border-zinc-600 dark:text-zinc-200 dark:hover:bg-zinc-800"
              : "border border-white/20 text-white/90 hover:bg-white/10"
          }`}
          title="Refresh stats"
        >
          <RefreshCw className="h-4 w-4" />
          Stats
        </button>
      </div>
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => void copyBookingUrl()}
          className={`inline-flex min-h-9 items-center gap-2 rounded-full px-3 py-2 text-sm font-semibold shadow-sm touch-manipulation active:scale-[0.99] ${
            embedInSession
              ? "bg-zinc-900 text-white hover:bg-zinc-800 dark:bg-rose-100 dark:text-zinc-900"
              : "bg-white text-zinc-900 hover:bg-zinc-100"
          }`}
        >
          <Copy className="h-4 w-4" />
          Copy link
        </button>
        <Link
          href={`/s/${encodeURIComponent(shopSlug)}/book`}
          target="_blank"
          rel="noreferrer"
          className={`inline-flex min-h-9 items-center gap-2 rounded-full border px-3 py-2 text-sm font-medium touch-manipulation active:scale-[0.99] ${
            embedInSession
              ? "border-zinc-300 text-zinc-800 hover:bg-zinc-50 dark:border-zinc-600 dark:text-zinc-200 dark:hover:bg-zinc-800"
              : "border-white/25 text-white hover:bg-white/10"
          }`}
        >
          <ExternalLink className="h-4 w-4" />
          Open page
        </Link>
        {me?.is_shop_owner ? (
          <Link
            href={me.shop?.slug ? ownerShopBase(me.shop.slug) : "/owner/dashboard"}
            className={`inline-flex min-h-9 items-center gap-2 rounded-full border px-3 py-2 text-sm font-medium touch-manipulation active:scale-[0.99] ${
              embedInSession
                ? "border-zinc-300 text-zinc-800 hover:bg-zinc-50 dark:border-zinc-600 dark:text-zinc-200 dark:hover:bg-zinc-800"
                : "border-white/25 text-white hover:bg-white/10"
            }`}
          >
            Owner dashboard
          </Link>
        ) : null}
      </div>
    </>
  );

  return (
    <div
      className={
        embedInSession
          ? "flex min-h-[min(72dvh,880px)] flex-col overflow-hidden"
          : "mt-8 overflow-hidden rounded-2xl border border-zinc-200/90 bg-white shadow-sm ring-1 ring-black/5 dark:border-zinc-800 dark:bg-zinc-950/40 dark:ring-white/10"
      }
    >
      {showEmbedSessionTop ? (
        <div className="border-b border-zinc-200 bg-zinc-50/95 px-4 py-3 dark:border-zinc-800 dark:bg-zinc-900/50 sm:px-5">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <div className="min-w-0">
              <p className="text-[11px] font-semibold uppercase tracking-wider text-rose-800 dark:text-rose-200">
                Shop management
              </p>
              <h2 className="truncate text-lg font-semibold text-zinc-900 dark:text-white">{shopTitle}</h2>
              <p className="text-xs text-zinc-500">
                {accessLabel} · <span className="font-mono">/s/{shopSlug}</span>
              </p>
            </div>
            <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center">{headerActions}</div>
          </div>
        </div>
      ) : !embedInSession ? (
        <div className="relative bg-gradient-to-br from-zinc-900 via-zinc-800 to-rose-950 px-5 py-6 text-white sm:px-7">
          <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,_rgba(251,113,133,0.18),_transparent_50%)]" />
          <div className="relative flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
            <div className="min-w-0 space-y-1">
              <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-rose-200/90">Shop console</p>
              <h2 className="truncate text-xl font-semibold tracking-tight sm:text-2xl">{shopTitle}</h2>
              <div className="flex flex-wrap items-center gap-2 text-sm text-zinc-300">
                <span className="rounded-md bg-white/10 px-2 py-0.5 font-mono text-xs text-white/90">
                  /s/{shopSlug}
                </span>
                <span className="rounded-md border border-white/15 bg-white/5 px-2 py-0.5 text-xs">{accessLabel}</span>
              </div>
            </div>
            <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center">{headerActions}</div>
          </div>
        </div>
      ) : null}

      <div className="flex min-h-0 flex-1 flex-col lg:flex-row lg:items-stretch">
        {!isSectionControlled ? (
          <>
            <div className="border-b border-zinc-200 bg-zinc-50/90 dark:border-zinc-800 dark:bg-zinc-900/40 lg:hidden">
              <div className="flex gap-1 overflow-x-auto px-2 py-2 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
                {visibleSections.map((s) => {
                  const Icon = s.icon;
                  const active = section === s.id;
                  return (
                    <button
                      key={s.id}
                      type="button"
                      onClick={() => setSection(s.id)}
                      className={`flex shrink-0 snap-start items-center gap-2 rounded-xl px-3 py-2 text-left text-sm font-medium transition-colors ${
                        active
                          ? "bg-zinc-900 text-white dark:bg-rose-100 dark:text-zinc-900"
                          : "text-zinc-600 hover:bg-zinc-200/80 dark:text-zinc-300 dark:hover:bg-zinc-800"
                      }`}
                    >
                      <Icon className="h-4 w-4 shrink-0 opacity-90" aria-hidden />
                      {s.label}
                    </button>
                  );
                })}
              </div>
            </div>

            <nav
              className="hidden w-56 shrink-0 flex-col gap-0.5 border-b border-zinc-200 bg-zinc-50/50 p-3 dark:border-zinc-800 dark:bg-zinc-900/25 lg:flex lg:border-b-0 lg:border-r"
              aria-label="Shop sections"
            >
              {visibleSections.map((s) => {
                const Icon = s.icon;
                const active = section === s.id;
                return (
                  <button
                    key={s.id}
                    type="button"
                    onClick={() => setSection(s.id)}
                    className={`flex w-full items-start gap-3 rounded-xl px-3 py-2.5 text-left transition-colors ${
                      active
                        ? "bg-zinc-900 text-white shadow-sm dark:bg-rose-100 dark:text-zinc-900"
                        : "text-zinc-600 hover:bg-zinc-200/70 dark:text-zinc-300 dark:hover:bg-zinc-800/80"
                    }`}
                  >
                    <Icon
                      className={`mt-0.5 h-4 w-4 shrink-0 ${active ? "opacity-100" : "opacity-70"}`}
                      aria-hidden
                    />
                    <span className="min-w-0">
                      <span className="block text-sm font-medium">{s.label}</span>
                      <span
                        className={`block text-[11px] leading-tight ${
                          active ? "text-white/75 dark:text-zinc-600" : "text-zinc-500 dark:text-zinc-500"
                        }`}
                      >
                        {s.hint}
                      </span>
                    </span>
                  </button>
                );
              })}
            </nav>
          </>
        ) : null}

        <div className="min-w-0 flex-1 space-y-6 p-4 sm:p-6">
          {section === "overview" && (
            <ShopOverviewPanel accessToken={accessToken} shopSlug={shopSlug} onStatsRefresh={loadHeaderStats} />
          )}

          {section === "services" && <ShopServicesPanel accessToken={accessToken} />}

          {section === "team" && <ShopTeamPanel accessToken={accessToken} />}

          {section === "clients" && <ShopClientsPanel accessToken={accessToken} />}

          {section === "shop" && <ShopSettingsPanel accessToken={accessToken} />}

          {bookingsActive && (
            <div className="relative space-y-5">
              {busy ? (
                <div
                  className="pointer-events-none absolute inset-0 z-10 rounded-xl bg-white/40 backdrop-blur-[1px] dark:bg-zinc-950/30"
                  aria-busy
                />
              ) : null}
              <div>
                <h3 className="text-lg font-semibold text-zinc-900 dark:text-white">Bookings</h3>
                <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
                  Review requests, approve or decline, reassign stylists while pending, and add walk-ins or blocked
                  time.
                </p>
              </div>

              {notice && (
                <div
                  className={`flex items-start justify-between gap-3 rounded-xl border px-3 py-2 text-sm ${
                    notice.type === "ok"
                      ? "border-emerald-200 bg-emerald-50 text-emerald-950 dark:border-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-100"
                      : "border-red-200 bg-red-50 text-red-950 dark:border-red-900 dark:bg-red-950/40 dark:text-red-100"
                  }`}
                >
                  <span className="min-w-0">{notice.text}</span>
                  <button
                    type="button"
                    onClick={() => setNotice(null)}
                    className="shrink-0 rounded-md px-2 py-0.5 text-xs font-semibold opacity-70 hover:opacity-100"
                  >
                    Dismiss
                  </button>
                </div>
              )}

              <div className="rounded-xl border border-zinc-200/90 bg-zinc-50/50 p-3 dark:border-zinc-800 dark:bg-zinc-900/30 sm:p-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="flex flex-wrap items-center gap-2">
                    <div className="inline-flex rounded-full border border-zinc-200 p-1 dark:border-zinc-700">
                      <button
                        type="button"
                        onClick={() => setRangeMode("week")}
                        className={`rounded-full px-3 py-1.5 text-sm font-medium ${
                          rangeMode === "week"
                            ? "bg-zinc-900 text-white dark:bg-rose-100 dark:text-zinc-900"
                            : "text-zinc-600 dark:text-zinc-300"
                        }`}
                      >
                        This week
                      </button>
                      <button
                        type="button"
                        onClick={() => setRangeMode("all")}
                        className={`rounded-full px-3 py-1.5 text-sm font-medium ${
                          rangeMode === "all"
                            ? "bg-zinc-900 text-white dark:bg-rose-100 dark:text-zinc-900"
                            : "text-zinc-600 dark:text-zinc-300"
                        }`}
                      >
                        All bookings
                      </button>
                    </div>
                    <label className="flex items-center gap-2 text-xs text-zinc-600 dark:text-zinc-400">
                      Status
                      <select
                        value={statusFilter}
                        onChange={(e) => setStatusFilter(e.target.value)}
                        className="rounded-lg border border-zinc-200 bg-white px-2 py-1.5 text-sm dark:border-zinc-700 dark:bg-zinc-950"
                      >
                        <option value="">All</option>
                        {STATUS_OPTIONS.map((o) => (
                          <option key={o.value} value={o.value}>
                            {o.label}
                          </option>
                        ))}
                      </select>
                    </label>
                  </div>
                  <div className="inline-flex rounded-full border border-zinc-200 p-1 dark:border-zinc-700">
                    <button
                      type="button"
                      disabled={rangeMode === "all"}
                      title={rangeMode === "all" ? "Switch to “This week” for calendar view" : undefined}
                      onClick={() => setView("calendar")}
                      className={`rounded-full px-4 py-1.5 text-sm font-medium disabled:cursor-not-allowed disabled:opacity-40 ${
                        view === "calendar"
                          ? "bg-zinc-900 text-white dark:bg-rose-100 dark:text-zinc-900"
                          : "text-zinc-600 dark:text-zinc-300"
                      }`}
                    >
                      Calendar
                    </button>
                    <button
                      type="button"
                      onClick={() => setView("list")}
                      className={`rounded-full px-4 py-1.5 text-sm font-medium ${
                        view === "list"
                          ? "bg-zinc-900 text-white dark:bg-rose-100 dark:text-zinc-900"
                          : "text-zinc-600 dark:text-zinc-300"
                      }`}
                    >
                      List
                    </button>
                  </div>
                  {rangeMode === "week" ? (
                    <div className="flex flex-wrap items-center gap-2">
                      <button
                        type="button"
                        disabled={busy}
                        onClick={() => setWeekAnchor(addDays(weekAnchor, -7))}
                        className="rounded-full border border-zinc-300 px-3 py-1.5 text-sm dark:border-zinc-600"
                      >
                        ‹ Week
                      </button>
                      <button
                        type="button"
                        disabled={busy}
                        onClick={() => setWeekAnchor(new Date())}
                        className="rounded-full border border-zinc-300 px-3 py-1.5 text-sm dark:border-zinc-600"
                      >
                        Jump to today
                      </button>
                      <button
                        type="button"
                        disabled={busy}
                        onClick={() => setWeekAnchor(addDays(weekAnchor, 7))}
                        className="rounded-full border border-zinc-300 px-3 py-1.5 text-sm dark:border-zinc-600"
                      >
                        Week ›
                      </button>
                      <button
                        type="button"
                        disabled={busy}
                        onClick={() => void loadAll()}
                        className="inline-flex items-center gap-1.5 rounded-full border border-zinc-300 px-3 py-1.5 text-sm font-medium dark:border-zinc-600"
                      >
                        <RefreshCw className="h-4 w-4" />
                        Refresh
                      </button>
                    </div>
                  ) : (
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="text-xs text-zinc-500">Showing up to ~3 years of bookings (list view).</p>
                      <button
                        type="button"
                        disabled={busy}
                        onClick={() => void loadAll()}
                        className="inline-flex items-center gap-1.5 rounded-full border border-zinc-300 px-3 py-1.5 text-sm font-medium dark:border-zinc-600"
                      >
                        <RefreshCw className="h-4 w-4" />
                        Refresh
                      </button>
                    </div>
                  )}
                </div>
              </div>

              {view === "calendar" && rangeMode === "week" ? (
                <CalendarWeek
                  dayLabels={dayLabels}
                  bookings={bookings}
                  staffCatalog={staffCatalog}
                  onStatusChange={onStatusChange}
                  onStaffChange={onStaffChange}
                  busy={busy}
                />
              ) : (
                <ListView
                  bookings={bookings}
                  staffCatalog={staffCatalog}
                  onStatusChange={onStatusChange}
                  onStaffChange={onStaffChange}
                  busy={busy}
                />
              )}

              <WalkInForm
                accessToken={accessToken}
                shopSlug={shopSlug}
                services={services}
                busy={busy}
                setBusy={setBusy}
                onDone={() => {
                  void loadAll();
                  void loadHeaderStats();
                }}
                onNotice={setNotice}
              />

              <BlockTimeForm
                accessToken={accessToken}
                shopSlug={shopSlug}
                busy={busy}
                setBusy={setBusy}
                onDone={() => {
                  void loadAll();
                  void loadHeaderStats();
                }}
                onNotice={setNotice}
              />

              <BlockedList blocks={blocks} busy={busy} onDelete={onDeleteBlock} />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function CalendarWeek(props: {
  dayLabels: { date: Date; key: string; label: string }[];
  bookings: BookingRow[];
  staffCatalog: CatalogStaffRow[];
  onStatusChange: (id: number, status: string) => void;
  onStaffChange: (id: number, salonStaffId: number) => void;
  busy: boolean;
}) {
  const { dayLabels, bookings, staffCatalog, onStatusChange, onStaffChange, busy } = props;

  return (
    <div className="overflow-x-auto rounded-2xl border border-rose-100/80 bg-white dark:border-zinc-800 dark:bg-zinc-900/40">
      <div className="grid min-w-[720px] grid-cols-7 gap-px bg-zinc-200 dark:bg-zinc-800">
        {dayLabels.map((d) => (
          <div key={d.key} className="bg-zinc-50 px-2 py-2 text-center text-xs font-semibold dark:bg-zinc-950">
            {d.label}
          </div>
        ))}
        {dayLabels.map((d) => {
          const items = bookings.filter(
            (b) => formatYmd(startOfDay(new Date(b.starts_at))) === d.key
          );
          return (
            <div key={`c-${d.key}`} className="min-h-[220px] bg-white p-2 align-top dark:bg-zinc-900/40">
              <ul className="space-y-2">
                {items.map((b) => {
                  const pending = b.status === "pending";
                  const staffOpts = staffRowsForPendingEdit(staffCatalog, b.service.id, b.staff);
                  return (
                    <li
                      key={b.id}
                      className="rounded-lg border border-zinc-200 bg-zinc-50 p-2 text-xs dark:border-zinc-700 dark:bg-zinc-950/60"
                    >
                      <p className="font-medium text-zinc-900 dark:text-white">{b.customer_name}</p>
                      <p className="text-zinc-500">
                        {new Intl.DateTimeFormat(undefined, { hour: "numeric", minute: "2-digit" }).format(
                          new Date(b.starts_at)
                        )}{" "}
                        · {b.service.name}
                        {b.service.category ? (
                          <span className="text-zinc-400"> ({b.service.category})</span>
                        ) : null}
                      </p>
                      {pending ? (
                        <label className="mt-1 block text-[10px] font-medium text-zinc-500">
                          Stylist
                          <select
                            disabled={busy || staffOpts.length === 0}
                            value={b.staff.id}
                            onChange={(e) => onStaffChange(b.id, Number(e.target.value))}
                            className="mt-0.5 w-full rounded-md border border-zinc-200 bg-white px-1 py-1 text-[11px] dark:border-zinc-700 dark:bg-zinc-950"
                          >
                            {staffOpts.map((s) => (
                              <option key={s.id} value={s.id}>
                                {s.name}
                              </option>
                            ))}
                          </select>
                        </label>
                      ) : (
                        <p className="text-zinc-500">{b.staff.name}</p>
                      )}
                      <select
                        disabled={busy}
                        value={b.status}
                        onChange={(e) => onStatusChange(b.id, e.target.value)}
                        className="mt-1 w-full rounded-md border border-zinc-200 bg-white px-1 py-1 text-[11px] dark:border-zinc-700 dark:bg-zinc-950"
                      >
                        {STATUS_OPTIONS.map((o) => (
                          <option key={o.value} value={o.value}>
                            {o.label}
                          </option>
                        ))}
                      </select>
                      {pending ? (
                        <div className="mt-1 flex gap-1">
                          <button
                            type="button"
                            disabled={busy}
                            onClick={() => onStatusChange(b.id, "confirmed")}
                            className="flex-1 rounded bg-emerald-800/90 py-1 text-[10px] font-semibold text-white dark:bg-emerald-700"
                          >
                            Approve
                          </button>
                          <button
                            type="button"
                            disabled={busy}
                            onClick={() => onStatusChange(b.id, "cancelled")}
                            className="flex-1 rounded border border-zinc-300 py-1 text-[10px] font-semibold dark:border-zinc-600"
                          >
                            Decline
                          </button>
                        </div>
                      ) : null}
                    </li>
                  );
                })}
              </ul>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function ListView(props: {
  bookings: BookingRow[];
  staffCatalog: CatalogStaffRow[];
  onStatusChange: (id: number, status: string) => void;
  onStaffChange: (id: number, salonStaffId: number) => void;
  busy: boolean;
}) {
  const sorted = [...props.bookings].sort(
    (a, b) => new Date(a.starts_at).getTime() - new Date(b.starts_at).getTime()
  );
  return (
    <div className="overflow-x-auto rounded-2xl border border-rose-100/80 bg-white dark:border-zinc-800 dark:bg-zinc-900/40">
      <table className="w-full min-w-[720px] text-left text-sm">
        <thead className="border-b border-zinc-200 bg-zinc-50 text-xs uppercase text-zinc-500 dark:border-zinc-800 dark:bg-zinc-950/80">
          <tr>
            <th className="px-3 py-2">When</th>
            <th className="px-3 py-2">Customer</th>
            <th className="px-3 py-2">Service</th>
            <th className="px-3 py-2">Staff</th>
            <th className="px-3 py-2">Source</th>
            <th className="px-3 py-2">Status</th>
            <th className="px-3 py-2">Actions</th>
          </tr>
        </thead>
        <tbody>
          {sorted.map((b) => {
            const pending = b.status === "pending";
            const staffOpts = staffRowsForPendingEdit(props.staffCatalog, b.service.id, b.staff);
            return (
              <tr key={b.id} className="border-b border-zinc-100 dark:border-zinc-800">
                <td className="px-3 py-2 whitespace-nowrap">{formatShort(b.starts_at)}</td>
                <td className="px-3 py-2">
                  <div className="font-medium">{b.customer_name}</div>
                  <div className="font-mono text-xs text-zinc-500">{b.customer_mobile}</div>
                </td>
                <td className="px-3 py-2">
                  <div>{b.service.name}</div>
                  {b.service.category ? (
                    <div className="text-xs text-zinc-500">{b.service.category}</div>
                  ) : null}
                </td>
                <td className="px-3 py-2">
                  {pending ? (
                    <select
                      disabled={props.busy || staffOpts.length === 0}
                      value={b.staff.id}
                      onChange={(e) => props.onStaffChange(b.id, Number(e.target.value))}
                      className="w-full max-w-[160px] rounded-md border border-zinc-200 bg-white px-2 py-1 text-xs dark:border-zinc-700 dark:bg-zinc-950"
                    >
                      {staffOpts.map((s) => (
                        <option key={s.id} value={s.id}>
                          {s.name}
                        </option>
                      ))}
                    </select>
                  ) : (
                    b.staff.name
                  )}
                </td>
                <td className="px-3 py-2 capitalize">{b.source.replace("_", " ")}</td>
                <td className="px-3 py-2">
                  <select
                    disabled={props.busy}
                    value={b.status}
                    onChange={(e) => props.onStatusChange(b.id, e.target.value)}
                    className="w-full max-w-[140px] rounded-md border border-zinc-200 bg-white px-2 py-1 text-xs dark:border-zinc-700 dark:bg-zinc-950"
                  >
                    {STATUS_OPTIONS.map((o) => (
                      <option key={o.value} value={o.value}>
                        {o.label}
                      </option>
                    ))}
                  </select>
                </td>
                <td className="px-3 py-2">
                  {pending ? (
                    <div className="flex flex-col gap-1">
                      <button
                        type="button"
                        disabled={props.busy}
                        onClick={() => props.onStatusChange(b.id, "confirmed")}
                        className="rounded-md bg-emerald-800 px-2 py-1 text-[11px] font-semibold text-white dark:bg-emerald-700"
                      >
                        Approve
                      </button>
                      <button
                        type="button"
                        disabled={props.busy}
                        onClick={() => props.onStatusChange(b.id, "cancelled")}
                        className="rounded-md border border-zinc-300 px-2 py-1 text-[11px] font-semibold dark:border-zinc-600"
                      >
                        Decline
                      </button>
                    </div>
                  ) : (
                    <span className="text-zinc-400">—</span>
                  )}
                </td>
              </tr>
            );
          })}
          {sorted.length === 0 && (
            <tr>
              <td colSpan={7} className="px-3 py-6 text-center text-zinc-500">
                No bookings in this range.
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}

function WalkInForm(props: {
  accessToken: string;
  shopSlug: string;
  services: SalonServiceRow[];
  busy: boolean;
  setBusy: (b: boolean) => void;
  onDone: () => void;
  onNotice: (n: { type: "ok" | "err"; text: string } | null) => void;
}) {
  const [serviceId, setServiceId] = useState<number | "">("");
  const [staffOptions, setStaffOptions] = useState<SalonStaffOption[]>([]);
  const [staffId, setStaffId] = useState<number | null>(null);
  const [startsLocal, setStartsLocal] = useState("");
  const [name, setName] = useState("");
  const [mobile, setMobile] = useState("");
  const [notes, setNotes] = useState("");

  useEffect(() => {
    if (serviceId === "") {
       
      setStaffOptions([]);
      setStaffId(null);
      return;
    }
    void (async () => {
      const res = await fetchSalonStaff(props.shopSlug, [serviceId]);
      if (res.ok) {
        setStaffOptions(res.data);
        setStaffId(null);
      }
    })();
  }, [serviceId, props.shopSlug]);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (serviceId === "" || !startsLocal) return;
    props.setBusy(true);
    props.onNotice(null);
    const starts = new Date(startsLocal);
    const body = {
      customer_name: name.trim(),
      customer_mobile: mobile.trim(),
      salon_service_id: serviceId,
      starts_at: starts.toISOString(),
      notes: notes.trim() === "" ? undefined : notes.trim(),
      ...(staffId !== null ? { salon_staff_id: staffId } : {}),
    };
    const res = await createWalkInBooking(props.accessToken, body);
    props.setBusy(false);
    if (!res.ok) {
      props.onNotice({ type: "err", text: formatApiError(res.body) });
      return;
    }
    props.onNotice({ type: "ok", text: "Walk-in saved." });
    setName("");
    setMobile("");
    setNotes("");
    props.onDone();
  }

  return (
    <div className="rounded-2xl border border-rose-100/80 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-900/40">
      <h3 className="text-base font-semibold text-zinc-900 dark:text-white">Add walk-in</h3>
      <p className="mt-1 text-xs text-zinc-500">Creates a booking with source &quot;walk in&quot; (default status: confirmed).</p>
      <form onSubmit={onSubmit} className="mt-4 grid gap-3 sm:grid-cols-2">
        <label className="text-xs font-medium text-zinc-500 sm:col-span-2">
          Service
          <select
            required
            className="mt-1 w-full rounded-lg border border-zinc-200 px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-950"
            value={serviceId === "" ? "" : String(serviceId)}
            onChange={(e) => setServiceId(e.target.value === "" ? "" : Number(e.target.value))}
          >
            <option value="">Select…</option>
            {props.services.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
        </label>
        <label className="text-xs font-medium text-zinc-500 sm:col-span-2">
          Stylist (optional)
          <select
            className="mt-1 w-full rounded-lg border border-zinc-200 px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-950"
            value={staffId === null ? "" : String(staffId)}
            onChange={(e) => {
              const v = e.target.value;
              setStaffId(v === "" ? null : Number(v));
            }}
          >
            <option value="">Any available</option>
            {staffOptions
              .filter((o) => o.id !== null)
              .map((o) => (
                <option key={o.id} value={o.id ?? ""}>
                  {o.name}
                </option>
              ))}
          </select>
        </label>
        <label className="text-xs font-medium text-zinc-500 sm:col-span-2">
          Start time
          <input
            required
            type="datetime-local"
            className="mt-1 w-full rounded-lg border border-zinc-200 px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-950"
            value={startsLocal}
            onChange={(e) => setStartsLocal(e.target.value)}
          />
        </label>
        <label className="text-xs font-medium text-zinc-500">
          Name
          <input
            required
            className="mt-1 w-full rounded-lg border border-zinc-200 px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-950"
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
        </label>
        <label className="text-xs font-medium text-zinc-500">
          Mobile
          <input
            required
            className="mt-1 w-full rounded-lg border border-zinc-200 px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-950"
            value={mobile}
            onChange={(e) => setMobile(e.target.value)}
          />
        </label>
        <label className="text-xs font-medium text-zinc-500 sm:col-span-2">
          Notes (optional)
          <input
            className="mt-1 w-full rounded-lg border border-zinc-200 px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-950"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
          />
        </label>
        <button
          type="submit"
          disabled={props.busy}
          className="sm:col-span-2 rounded-full bg-zinc-900 py-2.5 text-sm font-semibold text-white disabled:opacity-50 dark:bg-rose-100 dark:text-zinc-900"
        >
          {props.busy ? "…" : "Save walk-in"}
        </button>
      </form>
    </div>
  );
}

function BlockTimeForm(props: {
  accessToken: string;
  shopSlug: string;
  busy: boolean;
  setBusy: (b: boolean) => void;
  onDone: () => void;
  onNotice: (n: { type: "ok" | "err"; text: string } | null) => void;
}) {
  const [staffRows, setStaffRows] = useState<SalonStaffOption[]>([]);
  const [scope, setScope] = useState<"shop" | "staff">("shop");
  const [staffId, setStaffId] = useState<number | null>(null);
  const [startsLocal, setStartsLocal] = useState("");
  const [endsLocal, setEndsLocal] = useState("");
  const [kind, setKind] = useState<"leave" | "holiday">("leave");
  const [reason, setReason] = useState("");

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const res = await fetchSalonServices(props.shopSlug);
      if (!res.ok || res.data.length === 0) return;
      const st = await fetchSalonStaff(props.shopSlug, [res.data[0].id]);
      if (!cancelled && st.ok) {
        setStaffRows(st.data.filter((o) => o.id !== null));
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [props.shopSlug]);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!startsLocal || !endsLocal) return;
    if (scope === "staff" && staffId === null) {
      props.onNotice({ type: "err", text: "Select a stylist for a staff block." });
      return;
    }
    props.setBusy(true);
    props.onNotice(null);
    const body = {
      starts_at: new Date(startsLocal).toISOString(),
      ends_at: new Date(endsLocal).toISOString(),
      kind,
      reason: reason.trim() === "" ? undefined : reason.trim(),
      ...(scope === "shop" ? { salon_staff_id: null } : { salon_staff_id: staffId as number }),
    };
    const res = await createBlockedSlot(props.accessToken, body);
    props.setBusy(false);
    if (!res.ok) {
      props.onNotice({ type: "err", text: formatApiError(res.body) });
      return;
    }
    props.onNotice({ type: "ok", text: "Time blocked." });
    setStartsLocal("");
    setEndsLocal("");
    setReason("");
    props.onDone();
  }

  return (
    <div className="rounded-2xl border border-rose-100/80 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-900/40">
      <h3 className="text-base font-semibold text-zinc-900 dark:text-white">Block time</h3>
      <p className="mt-1 text-xs text-zinc-500">
        Staff leave blocks one stylist. Shop holiday blocks everyone for that window.
      </p>
      <form onSubmit={onSubmit} className="mt-4 grid gap-3 sm:grid-cols-2">
        <label className="text-xs font-medium text-zinc-500 sm:col-span-2">
          Scope
          <select
            className="mt-1 w-full rounded-lg border border-zinc-200 px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-950"
            value={scope === "shop" ? "shop" : String(staffId ?? "")}
            onChange={(e) => {
              const v = e.target.value;
              if (v === "shop") {
                setScope("shop");
                setStaffId(null);
                return;
              }
              setScope("staff");
              setStaffId(Number(v));
            }}
          >
            <option value="shop">Whole shop</option>
            {staffRows.map((o) => (
              <option key={o.id} value={o.id ?? ""}>
                {o.name}
              </option>
            ))}
          </select>
        </label>
        <label className="text-xs font-medium text-zinc-500">
          From
          <input
            required
            type="datetime-local"
            className="mt-1 w-full rounded-lg border border-zinc-200 px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-950"
            value={startsLocal}
            onChange={(e) => setStartsLocal(e.target.value)}
          />
        </label>
        <label className="text-xs font-medium text-zinc-500">
          To
          <input
            required
            type="datetime-local"
            className="mt-1 w-full rounded-lg border border-zinc-200 px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-950"
            value={endsLocal}
            onChange={(e) => setEndsLocal(e.target.value)}
          />
        </label>
        <label className="text-xs font-medium text-zinc-500 sm:col-span-2">
          Kind
          <select
            className="mt-1 w-full rounded-lg border border-zinc-200 px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-950"
            value={kind}
            onChange={(e) => setKind(e.target.value as "leave" | "holiday")}
          >
            <option value="leave">Staff leave</option>
            <option value="holiday">Shop holiday</option>
          </select>
        </label>
        <label className="text-xs font-medium text-zinc-500 sm:col-span-2">
          Reason (optional)
          <input
            className="mt-1 w-full rounded-lg border border-zinc-200 px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-950"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
          />
        </label>
        <button
          type="submit"
          disabled={props.busy}
          className="sm:col-span-2 rounded-full border border-zinc-300 py-2.5 text-sm font-semibold dark:border-zinc-600"
        >
          {props.busy ? "…" : "Add block"}
        </button>
      </form>
    </div>
  );
}

function BlockedList(props: {
  blocks: BlockedSlotRow[];
  busy: boolean;
  onDelete: (id: number) => void;
}) {
  if (props.blocks.length === 0) return null;
  return (
    <div className="rounded-2xl border border-rose-100/80 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-900/40">
      <h3 className="text-base font-semibold text-zinc-900 dark:text-white">Blocked times (selected range)</h3>
      <ul className="mt-3 space-y-2 text-sm">
        {props.blocks.map((b) => (
          <li
            key={b.id}
            className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-zinc-200 px-3 py-2 dark:border-zinc-700"
          >
            <span>
              <span className="font-medium capitalize">{b.scope === "shop" ? "Shop" : b.staff?.name}</span>
              <span className="text-zinc-500">
                {" "}
                · {formatShort(b.starts_at)} – {formatShort(b.ends_at)} · {b.kind}
              </span>
            </span>
            <button
              type="button"
              disabled={props.busy}
              onClick={() => props.onDelete(b.id)}
              className="text-xs font-semibold text-rose-800 hover:underline dark:text-rose-200"
            >
              Remove
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
