"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { fetchAuthMe, type AuthMePayload } from "@/lib/auth-api";
import { canAccessBarberStaffRoutes } from "@/lib/role-access";
import { fetchStaffCatalog, formatApiError, type CatalogStaffRow } from "@/lib/salon-api";
import { getSalonActAsShopSlug, setSalonActAsShopSlug } from "@/lib/salon-act-as-shop";
import { getStaffActAsStaffId, setStaffActAsStaffId } from "@/lib/staff-act-as";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";

export function StaffActAsBar(props: { accessToken: string; onStaffContextChange: () => void }) {
  const { accessToken, onStaffContextChange } = props;
  const [me, setMe] = useState<AuthMePayload | null>(null);
  const [staff, setStaff] = useState<CatalogStaffRow[] | null>(null);

  const load = useCallback(async () => {
    const m = await fetchAuthMe(accessToken);
    if (!m.ok) {
      setMe(null);
      setStaff(null);
      return;
    }
    setMe(m.data);
    if (canAccessBarberStaffRoutes(m.data)) {
      setStaff([]);
      return;
    }
    if (m.data.shop?.slug && !getSalonActAsShopSlug()) {
      setSalonActAsShopSlug(m.data.shop.slug);
    }
    const s = await fetchStaffCatalog(accessToken);
    if (!s.ok) {
      toast.error(formatApiError(s.body));
      setStaff([]);
      return;
    }
    setStaff(s.data);
    const current = getStaffActAsStaffId();
    const hasCurrent = typeof current === "number" && s.data.some((row) => row.id === current);
    if ((!current || !hasCurrent) && s.data.length > 0) {
      // Auto-fix stale manager selection (e.g. switched shops) so staff APIs always resolve a valid profile.
      setStaffActAsStaffId(s.data[0].id);
      onStaffContextChange();
    }
  }, [accessToken, onStaffContextChange]);

  useEffect(() => {
    void load();
  }, [load]);

  if (!me || canAccessBarberStaffRoutes(me)) {
    return null;
  }

  if (staff === null) {
    return <Skeleton className="mb-4 h-24 w-full max-w-2xl rounded-2xl" />;
  }

  if (staff.length === 0) {
    return (
      <div className="mb-4 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-950 dark:border-amber-900 dark:bg-amber-950/30 dark:text-amber-100">
        No staff records found for this shop. Add stylists in the salon dashboard before using the staff portal as a manager.
      </div>
    );
  }

  const value = getStaffActAsStaffId() ?? "";
  const managerShopStaffHref = me.shop?.slug ? `/owner/shop/${encodeURIComponent(me.shop.slug)}/staff` : "/owner/dashboard";

  return (
    <div className="mb-4 rounded-2xl border border-zinc-200 bg-white px-4 py-3 shadow-sm dark:border-zinc-800 dark:bg-zinc-900/50">
      <p className="text-xs font-semibold uppercase tracking-wide text-rose-800 dark:text-rose-200">Manager view</p>
      <p className="mt-1 text-sm text-zinc-800 dark:text-zinc-400">
        Choose which team member you are viewing in the staff portal. You can switch to any staff profile.
      </p>
      <div className="mt-3">
        <Label htmlFor="act-as-staff">Staff member</Label>
        <select
          id="act-as-staff"
          className="mt-1 flex min-h-11 w-full max-w-md rounded-xl border border-zinc-200 bg-white px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-950"
          value={value}
          onChange={(e) => {
            const v = e.target.value;
            if (v === "") {
              setStaffActAsStaffId(null);
              onStaffContextChange();
              return;
            }
            const id = Number.parseInt(v, 10);
            if (Number.isNaN(id)) {
              return;
            }
            setStaffActAsStaffId(id);
            onStaffContextChange();
          }}
        >
          <option value="">Select staff…</option>
          {staff.map((s) => (
            <option key={s.id} value={String(s.id)}>
              {s.name}
            </option>
          ))}
        </select>
        <div className="mt-2 flex flex-wrap items-center gap-3 text-xs">
          <Link href={managerShopStaffHref} className="font-medium text-rose-800 underline dark:text-rose-200">
            Manage staff access and permissions
          </Link>
          <span className="text-zinc-800">Add/remove team members, logins, and active access in manager panel.</span>
        </div>
      </div>
    </div>
  );
}
