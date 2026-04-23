"use client";

import Link from "next/link";
import { zodResolver } from "@hookform/resolvers/zod";
import { useCallback, useEffect, useRef, useState } from "react";
import { useForm, type Resolver } from "react-hook-form";
import { toast } from "sonner";
import { z } from "zod";
import { fetchAuthMe, formatApiError, patchAuthMe } from "@/lib/auth-api";
import { fetchStaffProfile, patchStaffProfile, type StaffProfilePayload } from "@/lib/staff-api";
import { useSalonAccessToken } from "@/hooks/use-salon-access-token";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

const profileSchema = z.object({
  name: z.string().min(2, "Name is required"),
  work_mobile: z.string().max(32).optional(),
  email: z.union([z.string().email(), z.literal("")]).optional(),
  bio: z.string().max(5000).optional(),
  photo_url: z.string().max(1500000).optional(),
  specialtiesText: z.string().optional(),
});

type ProfileForm = z.infer<typeof profileSchema>;

export function StaffProfileClient() {
  const token = useSalonAccessToken();
  const [profile, setProfile] = useState<StaffProfilePayload | null>(null);
  const [readOnly, setReadOnly] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [busy, setBusy] = useState(true);
  const retriedMissingProfile = useRef(false);

  const load = useCallback(async () => {
    if (!token) return;
    setBusy(true);
    setLoadError(null);
    const [meRes, res] = await Promise.all([fetchAuthMe(token), fetchStaffProfile(token)]);
    setBusy(false);
    if (meRes.ok) {
      setReadOnly(meRes.data.role !== "barber");
    }
    if (!res.ok) {
      const msg = formatApiError(res.body);
      setLoadError(msg);
      setProfile(null);
      if (!retriedMissingProfile.current && msg.includes("No staff profile for this shop")) retriedMissingProfile.current = true;
      return;
    }
    retriedMissingProfile.current = false;
    setProfile(res.data);
  }, [token]);

  useEffect(() => {
    void load();
  }, [load]);

  const pf = useForm<ProfileForm>({
    resolver: zodResolver(profileSchema) as Resolver<ProfileForm>,
    defaultValues: {
      name: "",
      work_mobile: "",
      email: "",
      bio: "",
      photo_url: "",
      specialtiesText: "",
    },
  });

  useEffect(() => {
    if (!profile) return;
    pf.reset({
      name: profile.name,
      work_mobile: profile.work_mobile ?? "",
      email: profile.email ?? "",
      bio: profile.bio ?? "",
      photo_url: profile.photo_url ?? "",
      specialtiesText: (profile.specialties ?? []).join("\n"),
    });
  }, [profile, pf]);

  async function onProfile(values: ProfileForm) {
    if (!token) return;
    if (readOnly) {
      toast.error("Managers can only view staff profile here.");
      return;
    }
    const specialties = (values.specialtiesText ?? "")
      .split("\n")
      .map((s) => s.trim())
      .filter(Boolean);
    const res = await patchStaffProfile(token, {
      name: values.name,
      work_mobile: values.work_mobile || null,
      email: values.email || null,
      bio: values.bio || null,
      photo_url: values.photo_url || null,
      specialties,
    });
    if (!res.ok) {
      toast.error(formatApiError(res.body));
      return;
    }
    const myPhoto = values.photo_url || null;
    const meRes = await patchAuthMe(token, { name: values.name, photo_url: myPhoto });
    if (!meRes.ok) {
      toast.error(formatApiError(meRes.body));
      return;
    }
    toast.success("Profile updated.");
    setProfile(res.data);
  }

  if (!token) return null;

  if (busy) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-10 w-48" />
        <Skeleton className="h-40 w-full" />
      </div>
    );
  }

  if (!profile) {
    return (
      <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-950 dark:border-amber-900 dark:bg-amber-950/30 dark:text-amber-100">
        <p className="font-medium">Could not load staff profile.</p>
        <p className="mt-1">{loadError ?? "Select a staff member from the manager selector and try again."}</p>
        <Button type="button" variant="outline" className="mt-3" onClick={() => void load()}>
          Retry
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-zinc-900 dark:text-white">Profile</h1>
        <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">Update how clients see you. Role, commission, and shop hours stay with your manager.</p>
        {readOnly ? (
          <p className="mt-2 text-xs font-medium text-amber-700 dark:text-amber-300">
            Manager mode: this profile is view-only. Edit from salon staff management.
          </p>
        ) : null}
      </div>

      <Card className="border-zinc-200/80 dark:border-zinc-800">
        <CardHeader>
          <CardTitle className="text-base">More</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-2 text-sm">
          <Button asChild variant="outline" className="min-h-11">
            <Link href="/staff/customers">Customers</Link>
          </Button>
          <Button asChild variant="outline" className="min-h-11">
            <Link href="/staff/services">Services</Link>
          </Button>
          <Button asChild variant="outline" className="min-h-11">
            <Link href="/staff/notifications">Notifications</Link>
          </Button>
          <Button asChild variant="outline" className="min-h-11">
            <Link href="/staff/reviews">Reviews</Link>
          </Button>
          <Button asChild variant="outline" className="min-h-11">
            <Link href="/staff/availability">Availability</Link>
          </Button>
        </CardContent>
      </Card>

      <Card className="border-zinc-200/80 dark:border-zinc-800">
        <CardHeader>
          <CardTitle className="text-base">Manager-controlled</CardTitle>
        </CardHeader>
        <CardContent className="space-y-1 text-sm text-zinc-600 dark:text-zinc-400">
          <p>
            Commission:{" "}
            <strong className="text-zinc-900 dark:text-white">
              {profile.commission_percent != null ? `${profile.commission_percent}%` : "—"}
            </strong>
          </p>
          <p>
            Role / staff record: <strong className="text-zinc-900 dark:text-white">stylist account</strong> (not editable here)
          </p>
        </CardContent>
      </Card>

      <form className="space-y-4 rounded-2xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-950/40" onSubmit={pf.handleSubmit(onProfile)}>
        <h2 className="text-sm font-semibold text-zinc-900 dark:text-white">Public profile</h2>
        <div>
          <Label htmlFor="p-name">Display name</Label>
          <Input id="p-name" className="mt-1 min-h-11" disabled={readOnly} {...pf.register("name")} />
          {pf.formState.errors.name ? <p className="mt-1 text-xs text-red-600">{pf.formState.errors.name.message}</p> : null}
        </div>
        <div>
          <Label htmlFor="p-mobile">Work mobile</Label>
          <Input id="p-mobile" className="mt-1 min-h-11" disabled={readOnly} {...pf.register("work_mobile")} />
        </div>
        <div>
          <Label htmlFor="p-email">Email</Label>
          <Input id="p-email" type="email" className="mt-1 min-h-11" disabled={readOnly} {...pf.register("email")} />
          {pf.formState.errors.email ? <p className="mt-1 text-xs text-red-600">{pf.formState.errors.email.message}</p> : null}
        </div>
        <div>
          <Label htmlFor="p-photo">Photo URL</Label>
          <Input id="p-photo" className="mt-1 min-h-11" placeholder="https://…" disabled={readOnly} {...pf.register("photo_url")} />
          {!readOnly ? (
            <Input
              type="file"
              accept="image/*"
              className="mt-2"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (!file) return;
                const reader = new FileReader();
                reader.onload = () => {
                  const result = typeof reader.result === "string" ? reader.result : "";
                  if (result) pf.setValue("photo_url", result);
                };
                reader.readAsDataURL(file);
              }}
            />
          ) : null}
          <p className="mt-1 text-xs text-zinc-500">Used in your profile icon and barber profile.</p>
        </div>
        <div>
          <Label htmlFor="p-bio">Bio / specialties description</Label>
          <Textarea id="p-bio" className="mt-1 min-h-[100px]" disabled={readOnly} {...pf.register("bio")} />
        </div>
        <div>
          <Label htmlFor="p-spec">Specialties (one per line)</Label>
          <Textarea id="p-spec" className="mt-1 min-h-[88px]" disabled={readOnly} {...pf.register("specialtiesText")} />
        </div>
        <Button type="submit" className="min-h-11" disabled={readOnly || pf.formState.isSubmitting}>
          Save profile
        </Button>
      </form>

      <div className="rounded-2xl border border-zinc-200 bg-white p-4 text-sm text-zinc-600 dark:border-zinc-800 dark:bg-zinc-950/40 dark:text-zinc-300">
        Password changes are managed by your shop admin/manager.
      </div>
    </div>
  );
}
