"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useCallback, useEffect, useState } from "react";
import { useForm, type Resolver } from "react-hook-form";
import { toast } from "sonner";
import { z } from "zod";
import { SalonManagementGate } from "@/components/auth/salon-management-gate";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import {
  hoursFromSettings,
  hoursToPayload,
  SHOP_BUSINESS_DAYS,
  type DayHoursState,
} from "@/lib/shop-business-hours";
import { fetchShopProfile, formatApiError, patchShopProfile, type ShopProfile } from "@/lib/salon-api";

const schema = z.object({
  name: z.string().min(1, "Name is required").max(255),
  description: z.string().max(5000).optional(),
  phone: z.string().max(32).optional(),
  email: z.union([z.literal(""), z.string().email("Invalid email")]).optional(),
  address: z.string().max(500).optional(),
  website: z.string().max(500).optional(),
  logo_url: z.string().max(1024).optional(),
  cover_photo_url: z.string().max(1024).optional(),
  currency: z.string().max(8).optional(),
  min_lead_time_hours: z.coerce.number().int().min(0).max(168),
});

type FormValues = z.infer<typeof schema>;

type HolidayRow = { date: string; note: string };

function FormBody({ accessToken }: { accessToken: string }) {
  const [profile, setProfile] = useState<ShopProfile | null>(null);
  const [hours, setHours] = useState<DayHoursState>(() => hoursFromSettings(undefined));
  const [holidays, setHolidays] = useState<HolidayRow[]>([]);
  const [ready, setReady] = useState(false);

  const form = useForm<FormValues>({
    resolver: zodResolver(schema) as Resolver<FormValues>,
    defaultValues: {
      name: "",
      description: "",
      phone: "",
      email: "",
      address: "",
      website: "",
      logo_url: "",
      cover_photo_url: "",
      currency: "BDT",
      min_lead_time_hours: 0,
    },
  });

  const load = useCallback(async () => {
    setReady(false);
    const res = await fetchShopProfile(accessToken);
    setReady(true);
    if (!res.ok) {
      toast.error(formatApiError(res.body));
      return;
    }
    const p = res.data;
    setProfile(p);
    const st = (p.settings ?? {}) as Record<string, unknown>;
    form.reset({
      name: p.name,
      description: p.description ?? "",
      phone: p.phone ?? "",
      email: p.email ?? "",
      address: p.address ?? "",
      website: typeof st.website === "string" ? st.website : "",
      logo_url: typeof st.logo_url === "string" ? st.logo_url : "",
      cover_photo_url: typeof st.cover_photo_url === "string" ? st.cover_photo_url : "",
      currency: typeof st.currency === "string" && st.currency ? st.currency : "BDT",
      min_lead_time_hours:
        typeof st.min_lead_time_hours === "number"
          ? st.min_lead_time_hours
          : Number.parseInt(String(st.min_lead_time_hours ?? "0"), 10) || 0,
    });
    setHours(hoursFromSettings(st));
    const h = st.holidays;
    if (Array.isArray(h)) {
      setHolidays(
        h
          .map((row) => {
            if (!row || typeof row !== "object") return null;
            const o = row as Record<string, unknown>;
            const date = typeof o.date === "string" ? o.date : "";
            const note = typeof o.note === "string" ? o.note : "";
            if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return null;
            return { date, note };
          })
          .filter(Boolean) as HolidayRow[]
      );
    } else {
      setHolidays([]);
    }
  }, [accessToken, form]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- shop profile hydrate form
    void load();
  }, [load]);

  const perms = profile?.permissions ?? {};
  const canEditBasics = perms.can_edit_shop_basics !== false;
  const canEditHours = perms.can_edit_business_hours === true;
  const canSubmit = canEditBasics || canEditHours;

  async function onSubmit(values: FormValues) {
    if (!canSubmit) return;
    const settings: Record<string, unknown> = {
      business_hours: hoursToPayload(hours),
      min_lead_time_hours: values.min_lead_time_hours,
      website: values.website?.trim() === "" ? null : values.website?.trim(),
      logo_url: values.logo_url?.trim() === "" ? null : values.logo_url?.trim(),
      cover_photo_url: values.cover_photo_url?.trim() === "" ? null : values.cover_photo_url?.trim(),
      holidays: holidays.filter((h) => /^\d{4}-\d{2}-\d{2}$/.test(h.date)),
    };
    if (perms.can_edit_currency === true) {
      settings.currency = (values.currency ?? "BDT").trim() || "BDT";
    }
    const res = await patchShopProfile(accessToken, {
      name: values.name.trim(),
      description: values.description?.trim() === "" ? null : values.description?.trim() ?? null,
      phone: values.phone?.trim() === "" ? null : values.phone?.trim() ?? null,
      email: values.email?.trim() === "" ? null : values.email?.trim() ?? null,
      address: values.address?.trim() === "" ? null : values.address?.trim() ?? null,
      settings,
    });
    if (!res.ok) {
      toast.error(formatApiError(res.body));
      return;
    }
    setProfile(res.data);
    toast.success("Shop profile saved");
  }

  function setDay(key: string, patch: Partial<{ closed: boolean; open: string; close: string }>) {
    setHours((prev) => ({
      ...prev,
      [key]: { ...prev[key], ...patch },
    }));
  }

  if (!ready || !profile) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-40 w-full rounded-2xl" />
        <Skeleton className="h-40 w-full rounded-2xl" />
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {!canSubmit ? (
        <p className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-950 dark:border-amber-900 dark:bg-amber-950/30 dark:text-amber-100">
          You can view this page, but only a manager or owner can save changes.
        </p>
      ) : null}

      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-8">
        <section className="rounded-2xl border border-zinc-200/80 bg-white p-5 shadow-sm dark:border-zinc-800 dark:bg-zinc-900/40">
          <h2 className="text-base font-semibold text-zinc-900 dark:text-white">Branding &amp; contact</h2>
          <p className="mt-1 text-xs text-zinc-500">Logo and cover use image URLs for now (upload pipeline can plug in later).</p>
          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            <div className="sm:col-span-2">
              <Label htmlFor="name">Shop name</Label>
              <Input id="name" className="mt-1" disabled={!canEditBasics} {...form.register("name")} />
              {form.formState.errors.name ? (
                <p className="mt-1 text-xs text-red-600">{form.formState.errors.name.message}</p>
              ) : null}
            </div>
            <div className="sm:col-span-2">
              <Label htmlFor="description">About / description</Label>
              <Textarea id="description" rows={4} className="mt-1" disabled={!canEditBasics} {...form.register("description")} />
            </div>
            <div>
              <Label htmlFor="logo_url">Logo URL</Label>
              <Input id="logo_url" className="mt-1" disabled={!canEditBasics} {...form.register("logo_url")} />
            </div>
            <div>
              <Label htmlFor="cover_photo_url">Cover photo URL</Label>
              <Input id="cover_photo_url" className="mt-1" disabled={!canEditBasics} {...form.register("cover_photo_url")} />
            </div>
            <div>
              <Label htmlFor="phone">Phone</Label>
              <Input id="phone" className="mt-1" disabled={!canEditBasics} {...form.register("phone")} />
            </div>
            <div>
              <Label htmlFor="email">Email</Label>
              <Input id="email" type="email" className="mt-1" disabled={!canEditBasics} {...form.register("email")} />
            </div>
            <div className="sm:col-span-2">
              <Label htmlFor="address">Address</Label>
              <Input id="address" className="mt-1" disabled={!canEditBasics} {...form.register("address")} />
            </div>
            <div className="sm:col-span-2">
              <Label htmlFor="website">Website</Label>
              <Input id="website" placeholder="https://…" className="mt-1" disabled={!canEditBasics} {...form.register("website")} />
            </div>
          </div>
        </section>

        <section className="rounded-2xl border border-zinc-200/80 bg-white p-5 shadow-sm dark:border-zinc-800 dark:bg-zinc-900/40">
          <h2 className="text-base font-semibold text-zinc-900 dark:text-white">Business hours</h2>
          <ul className="mt-4 space-y-3">
            {SHOP_BUSINESS_DAYS.map(({ key, label }) => {
              const d = hours[key];
              if (!d) return null;
              return (
                <li
                  key={key}
                  className="flex flex-wrap items-center gap-3 rounded-lg border border-zinc-200 px-3 py-2 dark:border-zinc-700"
                >
                  <span className="w-28 text-sm font-medium text-zinc-800 dark:text-zinc-100">{label}</span>
                  <label className="flex items-center gap-2 text-xs text-zinc-600 dark:text-zinc-400">
                    <input
                      type="checkbox"
                      checked={d.closed}
                      disabled={!canEditHours}
                      onChange={(e) => setDay(key, { closed: e.target.checked })}
                    />
                    Closed
                  </label>
                  {!d.closed ? (
                    <>
                      <input
                        type="time"
                        disabled={!canEditHours}
                        value={d.open}
                        onChange={(e) => setDay(key, { open: e.target.value })}
                        className="rounded border border-zinc-200 bg-white px-2 py-1 text-sm dark:border-zinc-600 dark:bg-zinc-950"
                      />
                      <span className="text-zinc-400">–</span>
                      <input
                        type="time"
                        disabled={!canEditHours}
                        value={d.close}
                        onChange={(e) => setDay(key, { close: e.target.value })}
                        className="rounded border border-zinc-200 bg-white px-2 py-1 text-sm dark:border-zinc-600 dark:bg-zinc-950"
                      />
                    </>
                  ) : null}
                </li>
              );
            })}
          </ul>
        </section>

        <section className="rounded-2xl border border-zinc-200/80 bg-white p-5 shadow-sm dark:border-zinc-800 dark:bg-zinc-900/40">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <h2 className="text-base font-semibold text-zinc-900 dark:text-white">Holidays &amp; special closings</h2>
              <p className="mt-1 text-xs text-zinc-500">Whole-day closures (YYYY-MM-DD).</p>
            </div>
            <Button
              type="button"
              variant="outline"
              className="text-xs"
              disabled={!canEditHours}
              onClick={() => setHolidays((h) => [...h, { date: "", note: "" }])}
            >
              Add date
            </Button>
          </div>
          <ul className="mt-4 space-y-2">
            {holidays.map((h, i) => (
              <li key={i} className="flex flex-wrap items-center gap-2">
                <Input
                  type="date"
                  className="w-40"
                  disabled={!canEditHours}
                  value={h.date}
                  onChange={(e) => {
                    const v = e.target.value;
                    setHolidays((rows) => rows.map((r, j) => (j === i ? { ...r, date: v } : r)));
                  }}
                />
                <Input
                  placeholder="Note (optional)"
                  className="min-w-[8rem] flex-1"
                  disabled={!canEditHours}
                  value={h.note}
                  onChange={(e) => {
                    const v = e.target.value;
                    setHolidays((rows) => rows.map((r, j) => (j === i ? { ...r, note: v } : r)));
                  }}
                />
                <Button
                  type="button"
                  variant="outline"
                  className="text-xs"
                  disabled={!canEditHours}
                  onClick={() => setHolidays((rows) => rows.filter((_, j) => j !== i))}
                >
                  Remove
                </Button>
              </li>
            ))}
          </ul>
        </section>

        <section className="rounded-2xl border border-zinc-200/80 bg-white p-5 shadow-sm dark:border-zinc-800 dark:bg-zinc-900/40">
          <h2 className="text-base font-semibold text-zinc-900 dark:text-white">Booking defaults</h2>
          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            <div>
              <Label htmlFor="min_lead">Minimum lead time (hours)</Label>
              <Input id="min_lead" type="number" min={0} className="mt-1" disabled={!canEditHours} {...form.register("min_lead_time_hours")} />
            </div>
            <div>
              <Label htmlFor="currency">Currency code</Label>
              <Input id="currency" className="mt-1" disabled={!perms.can_edit_currency} {...form.register("currency")} />
            </div>
          </div>
        </section>

        <div className="flex justify-end">
          <Button type="submit" disabled={!canSubmit || form.formState.isSubmitting}>
            {form.formState.isSubmitting ? "Saving…" : "Save changes"}
          </Button>
        </div>
      </form>
    </div>
  );
}

export function ShopGeneralPageClient() {
  return (
    <SalonManagementGate>
      {(token) => <FormBody accessToken={token} />}
    </SalonManagementGate>
  );
}
