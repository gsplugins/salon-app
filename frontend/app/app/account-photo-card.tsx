"use client";

import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { useSalonAccessToken } from "@/hooks/use-salon-access-token";
import { fetchAuthMe, formatApiError, patchAuthMe, type AuthMePayload, uploadAuthProfilePhoto } from "@/lib/auth-api";

export function AccountPhotoCard() {
  const token = useSalonAccessToken();
  const [me, setMe] = useState<AuthMePayload | null>(null);
  const [busy, setBusy] = useState(false);
  const [uploading, setUploading] = useState(false);
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
    <section className="card-clean mt-6 p-4">
      <h3 className="text-sm font-semibold text-[color:var(--foreground)]">Profile picture</h3>
      <p className="mt-1 text-xs text-[color:var(--paragraph)]">Used in your profile icon across panels.</p>
      <div className="mt-3 flex flex-wrap items-center gap-3">
        {photoUrl ? (
          // eslint-disable-next-line @next/next/no-img-element -- user uploaded URL/data URL
          <img src={photoUrl} alt="Profile" className="h-12 w-12 rounded-full object-cover" />
        ) : (
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-[color:var(--brand-primary)] text-sm font-semibold text-white">
            {me.name.slice(0, 1).toUpperCase()}
          </div>
        )}
        <input
          value={photoUrl ?? ""}
          onChange={(e) => setPhotoUrl(e.target.value)}
          placeholder="https://..."
          className="min-w-[220px] flex-1 rounded-lg border border-[color:var(--border)] bg-[color:var(--surface)] px-3 py-2 text-sm text-[color:var(--foreground)]"
        />
        <input
          type="file"
          accept="image/*"
          disabled={uploading || busy}
          onChange={async (e) => {
            const file = e.target.files?.[0];
            if (!file) return;
            if (!token) return;
            if (!file.type.startsWith("image/")) {
              toast.error("Please choose an image file.");
              return;
            }
            const reader = new FileReader();
            reader.onload = async () => {
              const result = typeof reader.result === "string" ? reader.result : "";
              if (!result) return;
              // Immediate preview; Save can still persist via /auth/me fallback.
              setPhotoUrl(result);
              setUploading(true);
              const up = await uploadAuthProfilePhoto(token, result);
              setUploading(false);
              if (!up.ok) {
                toast("Upload server unavailable. Click Save; we will save this photo anyway.");
                return;
              }
              setPhotoUrl(up.data.url);
              toast.success("Photo uploaded. Click Save to apply.");
            };
            reader.readAsDataURL(file);
          }}
          className="text-sm"
        />
        <button
          type="button"
          disabled={busy || uploading}
          onClick={async () => {
            setBusy(true);
            const safePhotoUrl = (photoUrl ?? "").trim();
            const res = await patchAuthMe(token, { photo_url: safePhotoUrl || null });
            setBusy(false);
            if (!res.ok) {
              toast.error(formatApiError(res.body));
              return;
            }
            toast.success("Profile picture updated.");
            void load();
          }}
          className="rounded-lg bg-blue-500 px-3 py-2 text-sm font-semibold text-white hover:bg-blue-400"
        >
          {uploading ? "Uploading..." : busy ? "Saving..." : "Save"}
        </button>
      </div>
    </section>
  );
}
