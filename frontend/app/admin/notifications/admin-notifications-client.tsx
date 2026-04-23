"use client";

import { useCallback, useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { SuperAdminGate } from "@/components/auth/super-admin-gate";
import { AdminWorkspaceFrame } from "@/components/platform/admin-workspace-frame";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import { Table, TBody, TD, TH, THead, TR } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import {
  fetchAdminGeneral,
  fetchNotificationTemplates,
  formatApiError,
  patchAdminSms,
  patchAdminSmtp,
  patchNotificationTemplate,
  patchNotificationToggles,
  type NotificationTemplateRow,
} from "@/lib/admin-api";

function Body({ token }: { token: string }) {
  const [rows, setRows] = useState<NotificationTemplateRow[] | null>(null);
  const [emailOn, setEmailOn] = useState(true);
  const [smsOn, setSmsOn] = useState(true);
  const [edit, setEdit] = useState<NotificationTemplateRow | null>(null);
  const smtp = useForm({
    defaultValues: { host: "", port: 587, user: "", password: "", from: "", encryption: "tls" },
  });
  const sms = useForm({
    defaultValues: { provider: "twilio", twilio_sid: "", twilio_token: "", twilio_from: "" },
  });

  const load = useCallback(async () => {
    const [t, g] = await Promise.all([fetchNotificationTemplates(token), fetchAdminGeneral(token)]);
    if (!t.ok) toast.error(formatApiError(t.body));
    else setRows(t.data);
    if (g.ok) {
      setEmailOn(g.data.email_notifications_enabled);
      setSmsOn(g.data.sms_notifications_enabled);
      const integ = (g.data.integrations ?? {}) as Record<string, Record<string, unknown>>;
      smtp.reset({
        host: String(integ.smtp?.host ?? ""),
        port: Number(integ.smtp?.port ?? 587),
        user: String(integ.smtp?.user ?? ""),
        password: String(integ.smtp?.password ?? ""),
        from: String(integ.smtp?.from ?? ""),
        encryption: String(integ.smtp?.encryption ?? "tls"),
      });
      sms.reset({
        provider: String(integ.sms?.provider ?? "twilio"),
        twilio_sid: String(integ.sms?.twilio_sid ?? ""),
        twilio_token: String(integ.sms?.twilio_token ?? ""),
        twilio_from: String(integ.sms?.twilio_from ?? ""),
      });
    }
  }, [token, smtp, sms]);

  useEffect(() => {
     
    void load();
  }, [load]);

  async function saveTemplate() {
    if (!edit) return;
    const res = await patchNotificationTemplate(token, edit.id, {
      subject: edit.subject,
      body: edit.body,
      is_active: edit.is_active,
    });
    if (!res.ok) {
      toast.error(formatApiError(res.body));
      return;
    }
    toast.success("Template saved.");
    setEdit(null);
    void load();
  }

  if (!rows) {
    return (
      <AdminWorkspaceFrame title="Notifications" subtitle="Templates and delivery.">
        <Skeleton className="h-48 w-full rounded-2xl" />
      </AdminWorkspaceFrame>
    );
  }

  return (
    <AdminWorkspaceFrame
      title="Notifications"
      subtitle="Edit templates, toggle channels globally, and configure SMTP / SMS providers (stored in platform integrations JSON)."
    >
      <div className="mb-6 flex flex-wrap items-center gap-6 rounded-2xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900/50">
        <div className="flex items-center gap-2">
          <Switch
            checked={emailOn}
            onCheckedChange={async (v) => {
              setEmailOn(v);
              const res = await patchNotificationToggles(token, { email_notifications_enabled: v });
              if (!res.ok) toast.error(formatApiError(res.body));
              else toast.success("Updated.");
            }}
          />
          <span className="text-sm font-medium">Email notifications</span>
        </div>
        <div className="flex items-center gap-2">
          <Switch
            checked={smsOn}
            onCheckedChange={async (v) => {
              setSmsOn(v);
              const res = await patchNotificationToggles(token, { sms_notifications_enabled: v });
              if (!res.ok) toast.error(formatApiError(res.body));
              else toast.success("Updated.");
            }}
          />
          <span className="text-sm font-medium">SMS notifications</span>
        </div>
      </div>

      <Tabs defaultValue="templates">
        <TabsList>
          <TabsTrigger value="templates">Templates</TabsTrigger>
          <TabsTrigger value="smtp">SMTP</TabsTrigger>
          <TabsTrigger value="sms">SMS</TabsTrigger>
        </TabsList>
        <TabsContent value="templates">
          <Table>
            <THead>
              <TR>
                <TH>Key</TH>
                <TH>Channel</TH>
                <TH>Active</TH>
                <TH className="text-right">Edit</TH>
              </TR>
            </THead>
            <TBody>
              {rows.map((r) => (
                <TR key={r.id}>
                  <TD className="font-mono text-xs">{r.template_key}</TD>
                  <TD>{r.channel}</TD>
                  <TD>{r.is_active ? "yes" : "no"}</TD>
                  <TD className="text-right">
                    <Button type="button" variant="outline" className="h-8 px-2 text-xs" onClick={() => setEdit({ ...r })}>
                      Edit
                    </Button>
                  </TD>
                </TR>
              ))}
            </TBody>
          </Table>
        </TabsContent>
        <TabsContent value="smtp">
          <form
            className="mx-auto max-w-lg space-y-3"
            onSubmit={smtp.handleSubmit(async (v) => {
              const res = await patchAdminSmtp(token, v);
              if (!res.ok) toast.error(formatApiError(res.body));
              else toast.success("SMTP saved.");
            })}
          >
            <div className="grid gap-2 sm:grid-cols-2">
              <div className="grid gap-1">
                <Label>Host</Label>
                <Input {...smtp.register("host")} />
              </div>
              <div className="grid gap-1">
                <Label>Port</Label>
                <Input type="number" {...smtp.register("port", { valueAsNumber: true })} />
              </div>
            </div>
            <div className="grid gap-2">
              <Label>User</Label>
              <Input {...smtp.register("user")} />
            </div>
            <div className="grid gap-2">
              <Label>Password</Label>
              <Input type="password" {...smtp.register("password")} autoComplete="new-password" />
            </div>
            <div className="grid gap-2 sm:grid-cols-2">
              <div className="grid gap-1">
                <Label>From</Label>
                <Input {...smtp.register("from")} />
              </div>
              <div className="grid gap-1">
                <Label>Encryption</Label>
                <Input {...smtp.register("encryption")} />
              </div>
            </div>
            <Button type="submit">Save SMTP</Button>
          </form>
        </TabsContent>
        <TabsContent value="sms">
          <form
            className="mx-auto max-w-lg space-y-3"
            onSubmit={sms.handleSubmit(async (v) => {
              const res = await patchAdminSms(token, v);
              if (!res.ok) toast.error(formatApiError(res.body));
              else toast.success("SMS provider saved.");
            })}
          >
            <div className="grid gap-2">
              <Label>Provider</Label>
              <Input {...sms.register("provider")} />
            </div>
            <div className="grid gap-2">
              <Label>Twilio SID</Label>
              <Input {...sms.register("twilio_sid")} />
            </div>
            <div className="grid gap-2">
              <Label>Twilio token</Label>
              <Input type="password" {...sms.register("twilio_token")} />
            </div>
            <div className="grid gap-2">
              <Label>Twilio from</Label>
              <Input {...sms.register("twilio_from")} />
            </div>
            <Button type="submit">Save SMS</Button>
          </form>
        </TabsContent>
      </Tabs>

      <Dialog open={edit !== null} onOpenChange={(o) => !o && setEdit(null)}>
        <DialogContent className="max-h-[90dvh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Edit template</DialogTitle>
          </DialogHeader>
          {edit ? (
            <div className="grid gap-3">
              <div className="grid gap-1">
                <Label>Subject (email)</Label>
                <Input value={edit.subject ?? ""} onChange={(e) => setEdit({ ...edit, subject: e.target.value })} />
              </div>
              <div className="grid gap-1">
                <Label>Body</Label>
                <Textarea value={edit.body} onChange={(e) => setEdit({ ...edit, body: e.target.value })} />
              </div>
              <div className="flex items-center gap-2">
                <Switch checked={edit.is_active} onCheckedChange={(v) => setEdit({ ...edit, is_active: v })} />
                <span className="text-sm">Active</span>
              </div>
            </div>
          ) : null}
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setEdit(null)}>
              Cancel
            </Button>
            <Button type="button" onClick={() => void saveTemplate()}>
              Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AdminWorkspaceFrame>
  );
}

export function AdminNotificationsClient() {
  return <SuperAdminGate>{(token) => <Body token={token} />}</SuperAdminGate>;
}
