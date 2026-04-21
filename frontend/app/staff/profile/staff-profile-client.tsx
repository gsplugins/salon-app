"use client";

import Link from "next/link";
import { zodResolver } from "@hookform/resolvers/zod";
import { useCallback, useEffect, useState } from "react";
import { useForm, type Resolver } from "react-hook-form";
import { toast } from "sonner";
import { z } from "zod";
import { formatApiError } from "@/lib/auth-api";
import { fetchStaffProfile, patchStaffProfile, postAuthChangePassword, type StaffProfilePayload } from "@/lib/staff-api";
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
  photo_url: z.string().max(2048).optional(),
  specialtiesText: z.string().optional(),
});

type ProfileForm = z.infer<typeof profileSchema>;

const passwordSchema = z
  .object({
    current_password: z.string().min(1, "Required"),
    password: z.string().min(8, "At least 8 characters"),
    password_confirmation: z.string().min(1, "Confirm password"),
  })
  .refine((d) => d.password === d.password_confirmation, { message: "Passwords must match", path: ["password_confirmation"] });

type PasswordForm = z.infer<typeof passwordSchema>;

export function StaffProfileClient() {
  const token = useSalonAccessToken();
  const [profile, setProfile] = useState<StaffProfilePayload | null>(null);
  const [busy, setBusy] = useState(true);

  const load = useCallback(async () => {
    if (!token) return;
    setBusy(true);
    const res = await fetchStaffProfile(token);
    setBusy(false);
    if (!res.ok) {
      toast.error(formatApiError(res.body));
      setProfile(null);
      return;
    }
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

  const pwf = useForm<PasswordForm>({
    resolver: zodResolver(passwordSchema) as Resolver<PasswordForm>,
    defaultValues: { current_password: "", password: "", password_confirmation: "" },
  });

  async function onProfile(values: ProfileForm) {
    if (!token) return;
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
    toast.success("Profile updated.");
    setProfile(res.data);
  }

  async function onPassword(values: PasswordForm) {
    if (!token) return;
    const res = await postAuthChangePassword(token, {
      current_password: values.current_password,
      password: values.password,
      password_confirmation: values.password_confirmation,
    });
    if (!res.ok) {
      toast.error(formatApiError(res.body));
      return;
    }
    toast.success("Password changed.");
    pwf.reset();
  }

  if (!token) return null;

  if (busy || !profile) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-10 w-48" />
        <Skeleton className="h-40 w-full" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-zinc-900 dark:text-white">Profile</h1>
        <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">Update how clients see you. Role, commission, and shop hours stay with your manager.</p>
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
          <Input id="p-name" className="mt-1 min-h-11" {...pf.register("name")} />
          {pf.formState.errors.name ? <p className="mt-1 text-xs text-red-600">{pf.formState.errors.name.message}</p> : null}
        </div>
        <div>
          <Label htmlFor="p-mobile">Work mobile</Label>
          <Input id="p-mobile" className="mt-1 min-h-11" {...pf.register("work_mobile")} />
        </div>
        <div>
          <Label htmlFor="p-email">Email</Label>
          <Input id="p-email" type="email" className="mt-1 min-h-11" {...pf.register("email")} />
          {pf.formState.errors.email ? <p className="mt-1 text-xs text-red-600">{pf.formState.errors.email.message}</p> : null}
        </div>
        <div>
          <Label htmlFor="p-photo">Photo URL</Label>
          <Input id="p-photo" className="mt-1 min-h-11" placeholder="https://…" {...pf.register("photo_url")} />
          <p className="mt-1 text-xs text-zinc-500">Paste an image URL your manager approved.</p>
        </div>
        <div>
          <Label htmlFor="p-bio">Bio / specialties description</Label>
          <Textarea id="p-bio" className="mt-1 min-h-[100px]" {...pf.register("bio")} />
        </div>
        <div>
          <Label htmlFor="p-spec">Specialties (one per line)</Label>
          <Textarea id="p-spec" className="mt-1 min-h-[88px]" {...pf.register("specialtiesText")} />
        </div>
        <Button type="submit" className="min-h-11" disabled={pf.formState.isSubmitting}>
          Save profile
        </Button>
      </form>

      <form className="space-y-4 rounded-2xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-950/40" onSubmit={pwf.handleSubmit(onPassword)}>
        <h2 className="text-sm font-semibold text-zinc-900 dark:text-white">Change password</h2>
        <div>
          <Label htmlFor="c-pw">Current password</Label>
          <Input id="c-pw" type="password" autoComplete="current-password" className="mt-1 min-h-11" {...pwf.register("current_password")} />
        </div>
        <div>
          <Label htmlFor="n-pw">New password</Label>
          <Input id="n-pw" type="password" autoComplete="new-password" className="mt-1 min-h-11" {...pwf.register("password")} />
        </div>
        <div>
          <Label htmlFor="n-pw2">Confirm new password</Label>
          <Input id="n-pw2" type="password" autoComplete="new-password" className="mt-1 min-h-11" {...pwf.register("password_confirmation")} />
          {pwf.formState.errors.password_confirmation ? (
            <p className="mt-1 text-xs text-red-600">{pwf.formState.errors.password_confirmation.message}</p>
          ) : null}
        </div>
        <Button type="submit" variant="outline" className="min-h-11" disabled={pwf.formState.isSubmitting}>
          Update password
        </Button>
      </form>
    </div>
  );
}
