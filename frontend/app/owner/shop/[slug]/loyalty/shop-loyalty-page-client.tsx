"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useParams } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { useForm, type Resolver } from "react-hook-form";
import { toast } from "sonner";
import { z } from "zod";
import { SalonManagementGate } from "@/components/auth/salon-management-gate";
import { ShopPlanUpgradePrompt } from "@/components/shop-dashboard/shop-plan-upgrade-prompt";
import { useShopDashboardProfileState } from "@/components/platform/shop-dashboard-profile-context";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import { fetchShopProfile, formatApiError, patchShopProfile, type ShopProfile } from "@/lib/salon-api";
import { shopPlanHasLoyalty } from "@/lib/shop-plan-features";

const schema = z.object({
  is_active: z.boolean(),
  points_per_spend_cents: z.coerce.number().int().min(1).max(100000000),
  points_redeem_ratio: z.coerce.number().min(0).max(1000),
});

type FormValues = z.infer<typeof schema>;

function Body({ accessToken }: { accessToken: string }) {
  const params = useParams<{ slug: string }>();
  const shopSlug = typeof params?.slug === "string" ? params.slug : "";
  const { profile: ctxProfile, profileLoading } = useShopDashboardProfileState();
  const [profile, setProfile] = useState<ShopProfile | null>(null);
  const [ready, setReady] = useState(false);
  const form = useForm<FormValues>({
    resolver: zodResolver(schema) as Resolver<FormValues>,
    defaultValues: { is_active: false, points_per_spend_cents: 10000, points_redeem_ratio: 0.5 },
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
    const ly = (st.loyalty as Record<string, unknown> | undefined) ?? {};
    form.reset({
      is_active: ly.is_active === true,
      points_per_spend_cents: typeof ly.points_per_spend_cents === "number" ? ly.points_per_spend_cents : 10000,
      points_redeem_ratio: typeof ly.points_redeem_ratio === "number" ? ly.points_redeem_ratio : 0.5,
    });
  }, [accessToken, form]);

  useEffect(() => {
    void load();
  }, [load]);

  const planProfile = ctxProfile ?? profile;
  const enabled = !profileLoading && planProfile !== null && shopPlanHasLoyalty(planProfile);
  const canEdit = profile?.permissions?.can_edit_booking_rules === true;

  async function onSubmit(values: FormValues) {
    if (!canEdit) return;
    const res = await patchShopProfile(accessToken, {
      settings: {
        loyalty: {
          is_active: values.is_active,
          points_per_spend_cents: values.points_per_spend_cents,
          points_redeem_ratio: values.points_redeem_ratio,
        },
      },
    });
    if (!res.ok) {
      toast.error(formatApiError(res.body));
      return;
    }
    setProfile(res.data);
    toast.success("Loyalty settings saved");
  }

  if (profileLoading || !ready) {
    return <Skeleton className="h-48 w-full rounded-2xl" />;
  }

  if (!enabled) {
    return (
      <ShopPlanUpgradePrompt
        shopSlug={shopSlug}
        title="Loyalty is not on your current plan"
        description="Upgrade to Pro or Enterprise to configure points earning and redemption for this salon."
      />
    );
  }

  if (!profile) {
    return <Skeleton className="h-48 w-full rounded-2xl" />;
  }

  return (
    <form onSubmit={form.handleSubmit(onSubmit)} className="mx-auto max-w-lg space-y-6">
      <section className="rounded-2xl border border-zinc-200/80 bg-white p-5 shadow-sm dark:border-zinc-800 dark:bg-zinc-900/40">
        <div className="flex items-center justify-between gap-4">
          <div>
            <h2 className="text-base font-semibold text-zinc-800 dark:text-white">Loyalty program</h2>
            <p className="mt-1 text-xs text-zinc-800">Stored in shop settings until dedicated loyalty tables ship.</p>
          </div>
          <Switch checked={form.watch("is_active")} onCheckedChange={(v) => form.setValue("is_active", v)} disabled={!canEdit} />
        </div>
        <div className="mt-6 space-y-4">
          <div>
            <Label htmlFor="ppc">Spend per point (minor units, e.g. paisa / cents)</Label>
            <Input id="ppc" type="number" className="mt-1" disabled={!canEdit} {...form.register("points_per_spend_cents")} />
            <p className="mt-1 text-[11px] text-zinc-800">Example: 10000 = 1 point per 100.00 BDT if currency uses minor units.</p>
          </div>
          <div>
            <Label htmlFor="prr">Redemption value (currency per point)</Label>
            <Input id="prr" type="number" step="0.01" className="mt-1" disabled={!canEdit} {...form.register("points_redeem_ratio")} />
          </div>
        </div>
      </section>
      <div className="flex justify-end">
        <Button type="submit" disabled={!canEdit || form.formState.isSubmitting}>
          Save loyalty rules
        </Button>
      </div>
    </form>
  );
}

export function ShopLoyaltyPageClient() {
  return (
    <SalonManagementGate>
      {(token) => <Body accessToken={token} />}
    </SalonManagementGate>
  );
}
