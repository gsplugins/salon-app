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
  reminder_hours_before: z.coerce.number().int().min(0).max(168),
  sms_enabled: z.boolean(),
  email_enabled: z.boolean(),
  whatsapp_enabled: z.boolean(),
  booking_confirmation: z.string().max(5000).optional(),
  cancellation: z.string().max(5000).optional(),
  review_request: z.string().max(5000).optional(),
});

type FormValues = z.infer<typeof schema>;

function Body({ accessToken }: { accessToken: string }) {
  const [profile, setProfile] = useState<ShopProfile | null>(null);
  const [ready, setReady] = useState(false);
  const form = useForm<FormValues>({
    resolver: zodResolver(schema) as Resolver<FormValues>,
    defaultValues: {
      reminder_hours_before: 2,
      sms_enabled: true,
      email_enabled: true,
      whatsapp_enabled: false,
      booking_confirmation: "",
      cancellation: "",
      review_request: "",
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
    const np = (st.notification_preferences as Record<string, unknown> | undefined) ?? {};
    const nt = (st.notification_templates as Record<string, unknown> | undefined) ?? {};
    form.reset({
      reminder_hours_before: typeof np.reminder_hours_before === "number" ? np.reminder_hours_before : 2,
      sms_enabled: np.sms_enabled !== false,
      email_enabled: np.email_enabled !== false,
      whatsapp_enabled: np.whatsapp_enabled === true,
      booking_confirmation: typeof nt.booking_confirmation === "string" ? nt.booking_confirmation : "",
      cancellation: typeof nt.cancellation === "string" ? nt.cancellation : "",
      review_request: typeof nt.review_request === "string" ? nt.review_request : "",
    });
  }, [accessToken, form]);

  useEffect(() => {
    void load();
  }, [load]);

  const canEdit = profile?.permissions?.can_edit_booking_rules === true;

  async function onSubmit(values: FormValues) {
    if (!canEdit) return;
    const res = await patchShopProfile(accessToken, {
      settings: {
        notification_preferences: {
          reminder_hours_before: values.reminder_hours_before,
          sms_enabled: values.sms_enabled,
          email_enabled: values.email_enabled,
          whatsapp_enabled: values.whatsapp_enabled,
        },
        notification_templates: {
          booking_confirmation: values.booking_confirmation?.trim() || null,
          cancellation: values.cancellation?.trim() || null,
          review_request: values.review_request?.trim() || null,
        },
      },
    });
    if (!res.ok) {
      toast.error(formatApiError(res.body));
      return;
    }
    setProfile(res.data);
    toast.success("Notification settings saved");
  }

  if (!ready || !profile) {
    return <Skeleton className="h-64 w-full rounded-2xl" />;
  }

  return (
    <form onSubmit={form.handleSubmit(onSubmit)} className="mx-auto max-w-2xl space-y-6">
      {!canEdit ? (
        <p className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-950 dark:border-amber-900 dark:bg-amber-950/30 dark:text-amber-100">
          Only a manager or owner can edit notification defaults.
        </p>
      ) : null}

      <section className="rounded-2xl border border-zinc-200/80 bg-white p-5 shadow-sm dark:border-zinc-800 dark:bg-zinc-900/40">
        <h2 className="text-base font-semibold text-zinc-900 dark:text-white">Reminder timing</h2>
        <div className="mt-4">
          <Label htmlFor="rh">Hours before appointment</Label>
          <Input id="rh" type="number" className="mt-1 max-w-xs" disabled={!canEdit} {...form.register("reminder_hours_before")} />
        </div>
        <div className="mt-6 space-y-4">
          <div className="flex items-center justify-between gap-4 rounded-xl border border-zinc-100 px-3 py-3 dark:border-zinc-800">
            <p className="text-sm font-medium text-zinc-900 dark:text-white">SMS reminders</p>
            <Switch
              checked={form.watch("sms_enabled")}
              onCheckedChange={(v) => form.setValue("sms_enabled", v)}
              disabled={!canEdit}
            />
          </div>
          <div className="flex items-center justify-between gap-4 rounded-xl border border-zinc-100 px-3 py-3 dark:border-zinc-800">
            <p className="text-sm font-medium text-zinc-900 dark:text-white">Email reminders</p>
            <Switch
              checked={form.watch("email_enabled")}
              onCheckedChange={(v) => form.setValue("email_enabled", v)}
              disabled={!canEdit}
            />
          </div>
          <div className="flex items-center justify-between gap-4 rounded-xl border border-zinc-100 px-3 py-3 dark:border-zinc-800">
            <p className="text-sm font-medium text-zinc-900 dark:text-white">WhatsApp reminders</p>
            <Switch
              checked={form.watch("whatsapp_enabled")}
              onCheckedChange={(v) => form.setValue("whatsapp_enabled", v)}
              disabled={!canEdit}
            />
          </div>
        </div>
      </section>

      <section className="rounded-2xl border border-zinc-200/80 bg-white p-5 shadow-sm dark:border-zinc-800 dark:bg-zinc-900/40">
        <h2 className="text-base font-semibold text-zinc-900 dark:text-white">Message templates</h2>
        <p className="mt-1 text-xs text-zinc-500">Plain text for now; wire to your SMS/email provider in production.</p>
        <div className="mt-4 space-y-4">
          <div>
            <Label>Booking confirmation</Label>
            <Textarea className="mt-1" rows={3} disabled={!canEdit} {...form.register("booking_confirmation")} />
          </div>
          <div>
            <Label>Cancellation</Label>
            <Textarea className="mt-1" rows={3} disabled={!canEdit} {...form.register("cancellation")} />
          </div>
          <div>
            <Label>Review request (after completed)</Label>
            <Textarea className="mt-1" rows={3} disabled={!canEdit} {...form.register("review_request")} />
          </div>
        </div>
      </section>

      <div className="flex justify-end">
        <Button type="submit" disabled={!canEdit || form.formState.isSubmitting}>
          {form.formState.isSubmitting ? "Saving…" : "Save"}
        </Button>
      </div>
    </form>
  );
}

export function ShopNotificationsPageClient() {
  return (
    <SalonManagementGate>
      {(token) => <Body accessToken={token} />}
    </SalonManagementGate>
  );
}
