"use client";

import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { SuperAdminGate } from "@/components/auth/super-admin-gate";
import { AdminWorkspaceFrame } from "@/components/platform/admin-workspace-frame";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { fetchAdminIntegrations, formatApiError, patchAdminStripe } from "@/lib/admin-api";
import { authJson } from "@/lib/auth-api";

function Body({ token }: { token: string }) {
  const stripe = useForm({ defaultValues: { publishable_key: "", secret_key: "", webhook_secret: "" } });
  const google = useForm({ defaultValues: { enabled: false, client_id: "", client_secret: "" } });
  const wa = useForm({ defaultValues: { enabled: false } });

  useEffect(() => {
    void (async () => {
      const res = await fetchAdminIntegrations(token);
      if (!res.ok) {
        toast.error(formatApiError(res.body));
        return;
      }
      const st = (res.data.stripe ?? {}) as Record<string, string>;
      stripe.reset({
        publishable_key: st.publishable_key ?? "",
        secret_key: st.secret_key ?? "",
        webhook_secret: st.webhook_secret ?? "",
      });
      const g = (res.data.google_calendar ?? {}) as Record<string, unknown>;
      google.reset({
        enabled: Boolean(g.enabled),
        client_id: String(g.client_id ?? ""),
        client_secret: String(g.client_secret ?? ""),
      });
      const w = (res.data.whatsapp ?? {}) as Record<string, unknown>;
      wa.reset({ enabled: Boolean(w.enabled) });
    })();
  }, [token, stripe, google, wa]);

  return (
    <AdminWorkspaceFrame
      title="Integrations"
      subtitle="Stripe, Google Calendar OAuth, and WhatsApp flags share the encrypted JSON integrations blob on the server."
    >
      <Tabs defaultValue="stripe">
        <TabsList>
          <TabsTrigger value="stripe">Stripe</TabsTrigger>
          <TabsTrigger value="google">Google Calendar</TabsTrigger>
          <TabsTrigger value="wa">WhatsApp</TabsTrigger>
        </TabsList>
        <TabsContent value="stripe">
          <form
            className="mx-auto max-w-lg space-y-3 pt-4"
            onSubmit={stripe.handleSubmit(async (v) => {
              const res = await patchAdminStripe(token, v);
              if (!res.ok) toast.error(formatApiError(res.body));
              else toast.success("Stripe keys saved.");
            })}
          >
            <div className="grid gap-2">
              <Label>Publishable key</Label>
              <Input {...stripe.register("publishable_key")} />
            </div>
            <div className="grid gap-2">
              <Label>Secret key</Label>
              <Input type="password" {...stripe.register("secret_key")} autoComplete="new-password" />
            </div>
            <div className="grid gap-2">
              <Label>Webhook secret</Label>
              <Input type="password" {...stripe.register("webhook_secret")} />
            </div>
            <Button type="submit">Save Stripe</Button>
          </form>
        </TabsContent>
        <TabsContent value="google">
          <form
            className="mx-auto max-w-lg space-y-3 pt-4"
            onSubmit={google.handleSubmit(async (v) => {
              const res = await authJson("/admin/integrations/google-calendar", {
                method: "PATCH",
                accessToken: token,
                body: JSON.stringify(v),
              });
              if (!res.ok) toast.error(formatApiError(res.body as never));
              else toast.success("Google settings saved.");
            })}
          >
            <div className="flex items-center gap-2">
              <Switch checked={google.watch("enabled")} onCheckedChange={(x) => google.setValue("enabled", x)} />
              <span className="text-sm">Enable sync</span>
            </div>
            <div className="grid gap-2">
              <Label>Client ID</Label>
              <Input {...google.register("client_id")} />
            </div>
            <div className="grid gap-2">
              <Label>Client secret</Label>
              <Input type="password" {...google.register("client_secret")} />
            </div>
            <Button type="submit">Save</Button>
          </form>
        </TabsContent>
        <TabsContent value="wa">
          <form
            className="mx-auto max-w-lg space-y-3 pt-4"
            onSubmit={wa.handleSubmit(async (v) => {
              const res = await authJson("/admin/integrations/whatsapp", {
                method: "PATCH",
                accessToken: token,
                body: JSON.stringify(v),
              });
              if (!res.ok) toast.error(formatApiError(res.body as never));
              else toast.success("WhatsApp flag saved.");
            })}
          >
            <div className="flex items-center gap-2">
              <Switch checked={wa.watch("enabled")} onCheckedChange={(x) => wa.setValue("enabled", x)} />
              <span className="text-sm">WhatsApp channel enabled</span>
            </div>
            <Button type="submit">Save</Button>
          </form>
        </TabsContent>
      </Tabs>
    </AdminWorkspaceFrame>
  );
}

export function AdminIntegrationsClient() {
  return <SuperAdminGate>{(token) => <Body token={token} />}</SuperAdminGate>;
}
