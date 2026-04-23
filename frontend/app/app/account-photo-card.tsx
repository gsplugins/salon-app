"use client";

import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { useSalonAccessToken } from "@/hooks/use-salon-access-token";
import { fetchAuthMe, formatApiError, patchAuthMe, type AuthMePayload } from "@/lib/auth-api";

export function AccountPhotoCard() {
  const token = useSalonAccessToken();
  const [me, setMe] = useState<AuthMePayload | null>(null);
  const [busy, setBusy] = useState(false);
  const [photoUrl, setPhotoUrl] = useState("");

  const load = useCallback(async () => {
    if (!token) return;
    const res = await fetchAuthMe(token);
    if (!res.ok) return;
    setMe(res.data);
    setPhotoUrl(res.data.photo_url ?? "");
  }, [token]);

  useEffect(() => {
    void load();
  }, [load]);

  if (!token || !me) return null;

  return (
    <section className="mt-6 rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm dark:border-zinc-800 dark:bg-zinc-900/50">
      <h3 className="text-sm font-semibold text-zinc-900 dark:text-white">Profile picture</h3>
      <p className="mt-1 text-xs text-zinc-500">Used in your profile icon across panels.</p>
      <div className="mt-3 flex flex-wrap items-center gap-3">
        {photoUrl ? (
          // eslint-disable-next-line @next/next/no-img-element -- user uploaded URL/data URL
          <img src={photoUrl} alt="Profile" className="h-12 w-12 rounded-full object-cover" />
        ) : (
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-zinc-100 text-sm font-semibold text-zinc-700 dark:bg-zinc-800 dark:text-zinc-100">
            {me.name.slice(0, 1).toUpperCase()}
          </div>
        )}
        <input
          value={photoUrl}
          onChange={(e) => setPhotoUrl(e.target.value)}
          placeholder="https://..."
          className="min-w-[220px] flex-1 rounded-lg border border-zinc-200 px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-950"
        />
        <input
          type="file"
          accept="image/*"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (!file) return;
            const reader = new FileReader();
            reader.onload = () => {
              const result = typeof reader.result === "string" ? reader.result : "";
              if (result) setPhotoUrl(result);
            };
            reader.readAsDataURL(file);
          }}
          className="text-sm"
        />
        <button
          type="button"
          disabled={busy}
          onClick={async () => {
            setBusy(true);
            const res = await patchAuthMe(token, { photo_url: photoUrl.trim() || null });
            setBusy(false);
            if (!res.ok) {
              toast.error(formatApiError(res.body));
              return;
            }
            toast.success("Profile picture updated.");
            void load();
          }}
          className="rounded-lg bg-zinc-900 px-3 py-2 text-sm font-semibold text-white dark:bg-rose-100 dark:text-zinc-900"
        >
          {busy ? "Saving..." : "Save"}
        </button>
      </div>
    </section>
  );
}
