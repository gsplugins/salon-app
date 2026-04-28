"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useCallback, useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { z } from "zod";
import { SuperAdminGate } from "@/components/auth/super-admin-gate";
import { AdminWorkspaceFrame } from "@/components/platform/admin-workspace-frame";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { fetchAdminGeneral, formatApiError, patchAdminGeneral } from "@/lib/admin-api";

const optionalUrl = z
  .string()
  .max(2048)
  .transform((s) => s.trim())
  .refine((s) => s === "" || /^https?:\/\//i.test(s), "Must be empty or start with http(s)://");

const schema = z.object({
  platform_name: z.string().min(1).max(255),
  logo_url: optionalUrl,
  favicon_url: optionalUrl,
  default_locale: z.string().min(2).max(16),
  default_timezone: z.string().min(1).max(64),
  maintenance_mode: z.boolean(),
  support_email: z
    .string()
    .max(255)
    .transform((s) => s.trim())
    .refine((s) => s === "" || z.string().email().safeParse(s).success, "Invalid email"),
  support_phone: z.string().max(64).optional().or(z.literal("")),
  support_info: z.string().max(10000).optional().or(z.literal("")),
});

type FormValues = z.infer<typeof schema>;

function Body({ token }: { token: string }) {
  const [loaded, setLoaded] = useState(false);
  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      platform_name: "",
      logo_url: "",
      favicon_url: "",
      default_locale: "en",
      default_timezone: "UTC",
      maintenance_mode: false,
      support_email: "",
      support_phone: "",
      support_info: "",
    },
  });

  const load = useCallback(async () => {
    const res = await fetchAdminGeneral(token);
    if (!res.ok) {
      toast.error(formatApiError(res.body));
      setLoaded(true);
      return;
    }
    const d = res.data;
    form.reset({
      platform_name: d.platform_name,
      logo_url: d.logo_url ?? "",
      favicon_url: d.favicon_url ?? "",
      default_locale: d.default_locale,
      default_timezone: d.default_timezone,
      maintenance_mode: d.maintenance_mode,
      support_email: d.support_email ?? "",
      support_phone: d.support_phone ?? "",
      support_info: d.support_info ?? "",
    });
    setLoaded(true);
  }, [token, form]);

  useEffect(() => {
    void load();
  }, [load]);

  async function onSubmit(values: FormValues) {
    const res = await patchAdminGeneral(token, {
      ...values,
      logo_url: values.logo_url || null,
      favicon_url: values.favicon_url || null,
      support_email: values.support_email || null,
      support_phone: values.support_phone || null,
      support_info: values.support_info || null,
    });
    if (!res.ok) {
      toast.error(formatApiError(res.body));
      return;
    }
    toast.success("Platform settings saved.");
    void load();
  }

  if (!loaded) {
    return (
      <AdminWorkspaceFrame title="General" subtitle="Branding, locale, maintenance, and support contacts.">
        <Skeleton className="h-64 w-full rounded-2xl" />
      </AdminWorkspaceFrame>
    );
  }

  return (
    <AdminWorkspaceFrame
      title="General"
      subtitle="Platform name, logo and favicon URLs, default language and timezone, maintenance mode, and public support details."
    >
      <form onSubmit={form.handleSubmit(onSubmit)} className="mx-auto max-w-2xl space-y-6">
        <Card>
          <CardHeader>
            <CardTitle>Branding</CardTitle>
            <CardDescription>Use HTTPS URLs for logo and favicon, or wire uploads later to object storage.</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-4">
            <div className="grid gap-2">
              <Label htmlFor="platform_name">Platform name</Label>
              <Input id="platform_name" {...form.register("platform_name")} />
              {form.formState.errors.platform_name ? (
                <p className="text-xs text-red-600">{form.formState.errors.platform_name.message}</p>
              ) : null}
            </div>
            <div className="grid gap-2">
              <Label htmlFor="logo_url">Logo URL</Label>
              <Input id="logo_url" {...form.register("logo_url")} placeholder="https://…" />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="favicon_url">Favicon URL</Label>
              <Input id="favicon_url" {...form.register("favicon_url")} placeholder="https://…" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Locale & availability</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-4 sm:grid-cols-2">
            <div className="grid gap-2">
              <Label htmlFor="default_locale">Default language</Label>
              <Input id="default_locale" {...form.register("default_locale")} />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="default_timezone">Timezone</Label>
              <Input id="default_timezone" {...form.register("default_timezone")} />
            </div>
            <div className="flex items-center justify-between gap-4 sm:col-span-2">
              <div>
                <p className="text-sm font-medium text-zinc-800 dark:text-white">Maintenance mode</p>
                <p className="text-xs text-zinc-800">When on, block new sessions from non–super-admins (API enforcement next).</p>
              </div>
              <Switch checked={form.watch("maintenance_mode")} onCheckedChange={(v) => form.setValue("maintenance_mode", v, { shouldDirty: true })} />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Support</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-4">
            <div className="grid gap-2 sm:grid-cols-2">
              <div className="grid gap-2">
                <Label htmlFor="support_email">Support email</Label>
                <Input id="support_email" type="email" {...form.register("support_email")} />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="support_phone">Support phone</Label>
                <Input id="support_phone" {...form.register("support_phone")} />
              </div>
            </div>
            <div className="grid gap-2">
              <Label htmlFor="support_info">Extra contact info</Label>
              <Textarea id="support_info" {...form.register("support_info")} />
            </div>
          </CardContent>
        </Card>

        <div className="flex justify-end gap-2">
          <Button type="button" variant="outline" onClick={() => void load()}>
            Reset
          </Button>
          <Button type="submit" disabled={form.formState.isSubmitting}>
            Save changes
          </Button>
        </div>
      </form>
    </AdminWorkspaceFrame>
  );
}

export function AdminGeneralClient() {
  return <SuperAdminGate>{(token) => <Body token={token} />}</SuperAdminGate>;
}
