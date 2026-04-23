"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { fetchAuthMe, formatApiError, patchAuthMe, type AuthMePayload } from "@/lib/auth-api";
import { useSalonAccessToken } from "@/hooks/use-salon-access-token";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export function CustomerProfileClient() {
  const token = useSalonAccessToken();
  const [me, setMe] = useState<AuthMePayload | null>(null);
  const [busy, setBusy] = useState(true);
  const [saving, setSaving] = useState(false);
  const [name, setName] = useState("");
  const [photoUrl, setPhotoUrl] = useState("");

  const load = useCallback(async () => {
    if (!token) return;
    setBusy(true);
    const res = await fetchAuthMe(token);
    setBusy(false);
    if (!res.ok) {
      toast.error(formatApiError(res.body));
      setMe(null);
      return;
    }
    setMe(res.data);
    setName(res.data.name);
    setPhotoUrl(res.data.photo_url ?? "");
  }, [token]);

  useEffect(() => {
    void load();
  }, [load]);

  function onPickPhoto(file: File | null) {
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      toast.error("Please choose an image file.");
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      const result = typeof reader.result === "string" ? reader.result : "";
      if (result) setPhotoUrl(result);
    };
    reader.readAsDataURL(file);
  }

  async function saveProfile() {
    if (!token) return;
    setSaving(true);
    const res = await patchAuthMe(token, { name: name.trim(), photo_url: photoUrl.trim() || null });
    setSaving(false);
    if (!res.ok) {
      toast.error(formatApiError(res.body));
      return;
    }
    toast.success("Profile updated.");
    void load();
  }

  if (!token) return null;

  if (busy || !me) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-10 w-48" />
        <Skeleton className="h-32 w-full" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-zinc-900 dark:text-white">Profile</h1>
        <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">Account details (read-only here). Use the account portal to change password or switch roles.</p>
      </div>

      <Card className="border-zinc-200/80 dark:border-zinc-800">
        <CardHeader>
          <CardTitle className="text-base">Account</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm">
          {photoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element -- customer-selected avatar URL/data URL
            <img src={photoUrl} alt="Profile" className="h-14 w-14 rounded-full object-cover" />
          ) : null}
          <p>
            <span className="text-zinc-500">Name</span>
            <br />
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="mt-1 w-full rounded-lg border border-zinc-200 px-3 py-2 font-medium text-zinc-900 dark:border-zinc-700 dark:bg-zinc-950 dark:text-white"
            />
          </p>
          <p>
            <span className="text-zinc-500">Mobile</span>
            <br />
            <span className="font-medium text-zinc-900 dark:text-white">{me.mobile}</span>
          </p>
          <p>
            <span className="text-zinc-500">Role</span>
            <br />
            <span className="font-medium capitalize text-zinc-900 dark:text-white">{me.role}</span>
          </p>
          <p>
            <span className="text-zinc-500">Profile photo URL</span>
            <br />
            <input
              value={photoUrl}
              onChange={(e) => setPhotoUrl(e.target.value)}
              placeholder="https://..."
              className="mt-1 w-full rounded-lg border border-zinc-200 px-3 py-2 font-medium text-zinc-900 dark:border-zinc-700 dark:bg-zinc-950 dark:text-white"
            />
          </p>
          <input type="file" accept="image/*" onChange={(e) => onPickPhoto(e.target.files?.[0] ?? null)} />
          <Button type="button" disabled={saving} onClick={() => void saveProfile()} className="min-h-11">
            {saving ? "Saving..." : "Save profile"}
          </Button>
        </CardContent>
      </Card>

      <div className="flex flex-wrap gap-2">
        <Button asChild className="min-h-11">
          <Link href="/app">Open account portal</Link>
        </Button>
        <Button asChild variant="outline" className="min-h-11">
          <Link href="/shops">Browse shops</Link>
        </Button>
      </div>
    </div>
  );
}
