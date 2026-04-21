"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { fetchAuthMe, formatApiError, type AuthMePayload } from "@/lib/auth-api";
import { useSalonAccessToken } from "@/hooks/use-salon-access-token";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export function CustomerProfileClient() {
  const token = useSalonAccessToken();
  const [me, setMe] = useState<AuthMePayload | null>(null);
  const [busy, setBusy] = useState(true);

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
  }, [token]);

  useEffect(() => {
    void load();
  }, [load]);

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
          <p>
            <span className="text-zinc-500">Name</span>
            <br />
            <span className="font-medium text-zinc-900 dark:text-white">{me.name}</span>
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
