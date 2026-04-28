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
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { fetchShopProfile, formatApiError, patchShopProfile, type ShopProfile } from "@/lib/salon-api";

const schema = z.object({
  online_booking_enabled: z.boolean(),
  booking_window_days: z.coerce.number().int().min(1).max(365),
  min_notice_hours: z.coerce.number().int().min(0).max(168),
  auto_confirm: z.boolean(),
  buffer_between_minutes: z.coerce.number().int().min(0).max(240),
  max_per_slot: z.coerce.number().int().min(1).max(50),
  cancellation_deadline_hours: z.coerce.number().int().min(0).max(720),
  cancellation_penalty_note: z.string().max(2000).optional(),
});

type FormValues = z.infer<typeof schema>;

function defaultsFromProfile(p: ShopProfile): FormValues {
  const br = ((p.settings ?? {}) as Record<string, unknown>).booking_rules as Record<string, unknown> | undefined;
  return {
    online_booking_enabled: br?.online_booking_enabled !== false,
    booking_window_days: typeof br?.booking_window_days === "number" ? br.booking_window_days : 30,
    min_notice_hours: typeof br?.min_notice_hours === "number" ? br.min_notice_hours : 2,
    auto_confirm: br?.auto_confirm === true,
    buffer_between_minutes: typeof br?.buffer_between_minutes === "number" ? br.buffer_between_minutes : 0,
    max_per_slot: typeof br?.max_per_slot === "number" ? br.max_per_slot : 1,
    cancellation_deadline_hours: typeof br?.cancellation_deadline_hours === "number" ? br.cancellation_deadline_hours : 24,
    cancellation_penalty_note: typeof br?.cancellation_penalty_note === "string" ? br.cancellation_penalty_note : "",
  };
}

function FormBody({ accessToken }: { accessToken: string }) {
  const [profile, setProfile] = useState<ShopProfile | null>(null);
  const [ready, setReady] = useState(false);
  const form = useForm<FormValues>({
    resolver: zodResolver(schema) as Resolver<FormValues>,
    defaultValues: {
      online_booking_enabled: true,
      booking_window_days: 30,
      min_notice_hours: 2,
      auto_confirm: false,
      buffer_between_minutes: 0,
      max_per_slot: 1,
      cancellation_deadline_hours: 24,
      cancellation_penalty_note: "",
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
    setProfile(res.data);
    form.reset(defaultsFromProfile(res.data));
  }, [accessToken, form]);

  useEffect(() => {
    void load();
  }, [load]);

  const canEdit = profile?.permissions?.can_edit_booking_rules === true;

  async function onSubmit(values: FormValues) {
    if (!canEdit) return;
    const res = await patchShopProfile(accessToken, {
      settings: {
        booking_rules: {
          online_booking_enabled: values.online_booking_enabled,
          booking_window_days: values.booking_window_days,
          min_notice_hours: values.min_notice_hours,
          auto_confirm: values.auto_confirm,
          buffer_between_minutes: values.buffer_between_minutes,
          max_per_slot: values.max_per_slot,
          cancellation_deadline_hours: values.cancellation_deadline_hours,
          cancellation_penalty_note: values.cancellation_penalty_note?.trim() || null,
        },
      },
    });
    if (!res.ok) {
      toast.error(formatApiError(res.body));
      return;
    }
    setProfile(res.data);
    toast.success("Booking rules saved");
  }

  if (!ready || !profile) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-8 w-56" />
        <Skeleton className="h-64 w-full rounded-2xl" />
      </div>
    );
  }

  return (
    <form onSubmit={form.handleSubmit(onSubmit)} className="mx-auto max-w-2xl space-y-6">
      {!canEdit ? (
        <p className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-950 dark:border-amber-900 dark:bg-amber-950/30 dark:text-amber-100">
          Only a manager or owner can change booking rules.
        </p>
      ) : null}

      <section className="rounded-2xl border border-zinc-200/80 bg-white p-5 shadow-sm dark:border-zinc-800 dark:bg-zinc-900/40">
        <h2 className="text-base font-semibold text-zinc-800 dark:text-white">Online booking</h2>
        <div className="mt-4 flex items-center justify-between gap-4 rounded-xl border border-zinc-100 px-3 py-3 dark:border-zinc-800">
          <div>
            <p className="text-sm font-medium text-zinc-800 dark:text-white">Enable public booking</p>
            <p className="text-xs text-zinc-800">When off, customers cannot self-serve (walk-ins still allowed).</p>
          </div>
          <Switch
            checked={form.watch("online_booking_enabled")}
            onCheckedChange={(v) => form.setValue("online_booking_enabled", v)}
            disabled={!canEdit}
          />
        </div>
        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <div>
            <Label htmlFor="booking_window_days">Booking window (days ahead)</Label>
            <Input id="booking_window_days" type="number" className="mt-1" disabled={!canEdit} {...form.register("booking_window_days")} />
          </div>
          <div>
            <Label htmlFor="min_notice_hours">Minimum notice (hours)</Label>
            <Input id="min_notice_hours" type="number" className="mt-1" disabled={!canEdit} {...form.register("min_notice_hours")} />
          </div>
          <div className="flex items-center justify-between gap-3 sm:col-span-2 rounded-xl border border-zinc-100 px-3 py-3 dark:border-zinc-800">
            <div>
              <p className="text-sm font-medium text-zinc-800 dark:text-white">Auto-confirm new bookings</p>
              <p className="text-xs text-zinc-800">Otherwise they stay pending until you confirm.</p>
            </div>
            <Switch checked={form.watch("auto_confirm")} onCheckedChange={(v) => form.setValue("auto_confirm", v)} disabled={!canEdit} />
          </div>
          <div>
            <Label htmlFor="buffer">Buffer between appointments (minutes)</Label>
            <Input id="buffer" type="number" className="mt-1" disabled={!canEdit} {...form.register("buffer_between_minutes")} />
          </div>
          <div>
            <Label htmlFor="max_per_slot">Max bookings per slot</Label>
            <Input id="max_per_slot" type="number" className="mt-1" disabled={!canEdit} {...form.register("max_per_slot")} />
          </div>
        </div>
      </section>

      <section className="rounded-2xl border border-zinc-200/80 bg-white p-5 shadow-sm dark:border-zinc-800 dark:bg-zinc-900/40">
        <h2 className="text-base font-semibold text-zinc-800 dark:text-white">Cancellation policy</h2>
        <div className="mt-4 grid gap-4">
          <div>
            <Label htmlFor="cdl">Customer cancellation deadline (hours before)</Label>
            <Input id="cdl" type="number" className="mt-1" disabled={!canEdit} {...form.register("cancellation_deadline_hours")} />
          </div>
          <div>
            <Label htmlFor="pen">Penalty / policy note</Label>
            <Textarea id="pen" rows={3} className="mt-1" disabled={!canEdit} {...form.register("cancellation_penalty_note")} />
          </div>
        </div>
      </section>

      <section className="rounded-2xl border border-zinc-200/80 bg-white p-5 shadow-sm dark:border-zinc-800 dark:bg-zinc-900/40">
        <h2 className="text-base font-semibold text-zinc-800 dark:text-white">Booking form custom fields</h2>
        <p className="mt-1 text-xs text-zinc-800">
          Structured custom fields are stored as <code className="rounded bg-zinc-100 px-1 dark:bg-zinc-800">booking_rules.custom_fields</code>{" "}
          via API. This UI focuses on core rules; extend the payload when you add more inputs.
        </p>
      </section>

      <div className="flex justify-end">
        <Button type="submit" disabled={!canEdit || form.formState.isSubmitting}>
          {form.formState.isSubmitting ? "Saving…" : "Save booking rules"}
        </Button>
      </div>
    </form>
  );
}

export function ShopBookingPageClient() {
  return (
    <SalonManagementGate>
      {(token) => <FormBody accessToken={token} />}
    </SalonManagementGate>
  );
}
