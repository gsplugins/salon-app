"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useCallback, useEffect, useState } from "react";
import { useForm, type Resolver } from "react-hook-form";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { z } from "zod";
import { SalonManagementGate } from "@/components/auth/salon-management-gate";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import {
  hoursFromSettings,
  hoursToPayload,
  SHOP_BUSINESS_DAYS,
  type DayHoursState,
} from "@/lib/shop-business-hours";
import { fetchShopProfile, formatApiError, patchShopProfile, type ShopProfile } from "@/lib/salon-api";

const schema = z.object({
  name: z.string().max(255).optional(),
  description: z.string().max(5000).optional(),
  category: z.string().max(120).optional(),
  phone: z.string().max(32).optional(),
  whatsapp_phone: z.string().max(32).optional(),
  email: z.union([z.literal(""), z.string().email("Invalid email")]).optional(),
  google_maps_url: z.string().max(1024).optional(),
  area: z.string().max(120).optional(),
  address: z.string().max(500).optional(),
  website: z.string().max(500).optional(),
  facebook_url: z.string().max(1024).optional(),
  instagram_url: z.string().max(1024).optional(),
  logo_url: z.string().max(1500000).optional(),
  cover_photo_url: z.string().max(1024).optional(),
  photo_gallery_urls: z.string().max(20000).optional(),
  division: z.string().max(120).optional(),
  district: z.string().max(120).optional(),
  city: z.string().max(120).optional(),
  established_year: z.union([z.literal(""), z.coerce.number().int().min(1900).max(2100)]).optional(),
  weekly_holidays: z.string().max(500).optional(),
  payment_methods: z.string().max(500).optional(),
  delivery_available: z.boolean().optional(),
  currency: z.string().max(8).optional(),
  min_lead_time_hours: z.coerce.number().int().min(0).max(168),
  booking_advance_percent: z.coerce.number().int().min(0).max(100),
});

type FormValues = z.infer<typeof schema>;

type HolidayRow = { date: string; note: string };
type SocialProfileRow = { platform: string; url: string };

async function optimizeImageFileToDataUrl(file: File, opts: { maxWidth: number; maxHeight: number; quality: number }): Promise<string> {
  const rawDataUrl = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const out = typeof reader.result === "string" ? reader.result : "";
      if (!out) reject(new Error("Could not read file."));
      else resolve(out);
    };
    reader.onerror = () => reject(new Error("Could not read file."));
    reader.readAsDataURL(file);
  });

  const img = await new Promise<HTMLImageElement>((resolve, reject) => {
    const el = new Image();
    el.onload = () => resolve(el);
    el.onerror = () => reject(new Error("Could not decode image."));
    el.src = rawDataUrl;
  });

  const scale = Math.min(1, opts.maxWidth / img.width, opts.maxHeight / img.height);
  const width = Math.max(1, Math.round(img.width * scale));
  const height = Math.max(1, Math.round(img.height * scale));
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) return rawDataUrl;
  ctx.drawImage(img, 0, 0, width, height);
  return canvas.toDataURL("image/jpeg", opts.quality);
}

function FormBody({ accessToken }: { accessToken: string }) {
  const [profile, setProfile] = useState<ShopProfile | null>(null);
  const [hours, setHours] = useState<DayHoursState>(() => hoursFromSettings(undefined));
  const [holidays, setHolidays] = useState<HolidayRow[]>([]);
  const [categories, setCategories] = useState<string[]>([]);
  const [paymentMethods, setPaymentMethods] = useState<string[]>([]);
  const [socialProfiles, setSocialProfiles] = useState<SocialProfileRow[]>([]);
  const [galleryImages, setGalleryImages] = useState<string[]>([]);
  const [ready, setReady] = useState(false);

  const form = useForm<FormValues>({
    resolver: zodResolver(schema) as Resolver<FormValues>,
    defaultValues: {
      name: "",
      description: "",
      category: "",
      phone: "",
      whatsapp_phone: "",
      email: "",
      google_maps_url: "",
      area: "",
      address: "",
      website: "",
      facebook_url: "",
      instagram_url: "",
      logo_url: "",
      cover_photo_url: "",
      photo_gallery_urls: "",
      division: "",
      district: "",
      city: "",
      established_year: "",
      weekly_holidays: "",
      payment_methods: "",
      delivery_available: false,
      currency: "BDT",
      min_lead_time_hours: 0,
      booking_advance_percent: 0,
    },
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
    const loadedCategories = Array.isArray(st.categories)
      ? (st.categories as unknown[]).map((v) => String(v).trim()).filter(Boolean)
      : typeof st.category === "string" && st.category.trim()
        ? [st.category.trim()]
        : [];
    const loadedPaymentMethods = Array.isArray(st.payment_methods)
      ? (st.payment_methods as unknown[]).map((v) => String(v).trim()).filter(Boolean)
      : typeof st.payment_methods === "string" && st.payment_methods.trim()
        ? [st.payment_methods.trim()]
        : [];
    const loadedSocialProfiles = Array.isArray(st.social_profiles)
      ? (st.social_profiles as unknown[])
          .map((row) => {
            if (!row || typeof row !== "object") return null;
            const r = row as Record<string, unknown>;
            const platform = typeof r.platform === "string" ? r.platform.trim() : "";
            const url = typeof r.url === "string" ? r.url.trim() : "";
            if (!platform || !/^https?:\/\//i.test(url)) return null;
            return { platform, url };
          })
          .filter(Boolean) as SocialProfileRow[]
      : [];
    if (!loadedSocialProfiles.length) {
      const fallback: SocialProfileRow[] = [];
      if (typeof st.facebook_url === "string" && /^https?:\/\//i.test(st.facebook_url)) {
        fallback.push({ platform: "Facebook", url: st.facebook_url });
      }
      if (typeof st.instagram_url === "string" && /^https?:\/\//i.test(st.instagram_url)) {
        fallback.push({ platform: "Instagram", url: st.instagram_url });
      }
      setSocialProfiles(fallback);
    } else {
      setSocialProfiles(loadedSocialProfiles);
    }
    const loadedGallery = Array.isArray(st.photo_gallery_urls)
      ? (st.photo_gallery_urls as unknown[]).map((v) => String(v).trim()).filter((v) => /^https?:\/\//i.test(v) || v.startsWith("data:image/"))
      : [];
    setGalleryImages(loadedGallery.slice(0, 24));
    setCategories(loadedCategories);
    setPaymentMethods(loadedPaymentMethods);
    form.reset({
      name: p.name,
      description: p.description ?? "",
      category: "",
      phone: p.phone ?? "",
      whatsapp_phone: typeof st.whatsapp_phone === "string" ? st.whatsapp_phone : "",
      email: p.email ?? "",
      google_maps_url: typeof st.google_maps_url === "string" ? st.google_maps_url : "",
      area: typeof st.area === "string" ? st.area : "",
      address: p.address ?? "",
      website: typeof st.website === "string" ? st.website : "",
      facebook_url: "",
      instagram_url: "",
      logo_url: typeof st.logo_url === "string" ? st.logo_url : "",
      cover_photo_url: typeof st.cover_photo_url === "string" ? st.cover_photo_url : "",
      photo_gallery_urls: "",
      division: typeof st.division === "string" ? st.division : "",
      district: typeof st.district === "string" ? st.district : "",
      city: typeof st.city === "string" ? st.city : "",
      established_year:
        typeof st.established_year === "number"
          ? st.established_year
          : Number.parseInt(String(st.established_year ?? ""), 10) || "",
      weekly_holidays: Array.isArray(st.weekly_holidays)
        ? (st.weekly_holidays as unknown[]).map((v) => String(v)).join(", ")
        : typeof st.weekly_holidays === "string"
          ? st.weekly_holidays
          : "",
      payment_methods: "",
      delivery_available: st.delivery_available === true,
      currency: typeof st.currency === "string" && st.currency ? st.currency : "BDT",
      min_lead_time_hours:
        typeof st.min_lead_time_hours === "number"
          ? st.min_lead_time_hours
          : Number.parseInt(String(st.min_lead_time_hours ?? "0"), 10) || 0,
      booking_advance_percent:
        typeof st.booking_advance_percent === "number"
          ? st.booking_advance_percent
          : Number.parseInt(String(st.booking_advance_percent ?? "0"), 10) || 0,
    });
    setHours(hoursFromSettings(st));
    const h = st.holidays;
    if (Array.isArray(h)) {
      setHolidays(
        h
          .map((row) => {
            if (!row || typeof row !== "object") return null;
            const o = row as Record<string, unknown>;
            const date = typeof o.date === "string" ? o.date : "";
            const note = typeof o.note === "string" ? o.note : "";
            if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return null;
            return { date, note };
          })
          .filter(Boolean) as HolidayRow[]
      );
    } else {
      setHolidays([]);
    }
  }, [accessToken, form]);

  useEffect(() => {
     
    void load();
  }, [load]);

  const perms = profile?.permissions ?? {};
  const canEditBasics = perms.can_edit_shop_basics !== false;
  const canEditHours = perms.can_edit_business_hours === true;
  const canSubmit = canEditBasics || canEditHours;

  async function onSubmit(values: FormValues) {
    if (!canSubmit) return;
    const trimmedName = (values.name ?? "").trim();
    if (canEditBasics && trimmedName.length === 0) {
      form.setError("name", { type: "manual", message: "Name is required" });
      toast.error("Shop name is required.");
      return;
    }
    const settings: Record<string, unknown> = {
      business_hours: hoursToPayload(hours),
      min_lead_time_hours: values.min_lead_time_hours,
      booking_advance_percent: values.booking_advance_percent,
      website: values.website?.trim() === "" ? null : values.website?.trim(),
      categories: categories.filter(Boolean),
      category: categories[0] ?? null,
      whatsapp_phone: values.whatsapp_phone?.trim() === "" ? null : values.whatsapp_phone?.trim(),
      google_maps_url: values.google_maps_url?.trim() === "" ? null : values.google_maps_url?.trim(),
      area: values.area?.trim() === "" ? null : values.area?.trim(),
      social_profiles: socialProfiles
        .map((r) => ({ platform: r.platform.trim(), url: r.url.trim() }))
        .filter((r) => r.platform && /^https?:\/\//i.test(r.url)),
      facebook_url:
        socialProfiles.find((r) => r.platform.trim().toLowerCase() === "facebook" && /^https?:\/\//i.test(r.url))?.url ?? null,
      instagram_url:
        socialProfiles.find((r) => r.platform.trim().toLowerCase() === "instagram" && /^https?:\/\//i.test(r.url))?.url ?? null,
      logo_url: values.logo_url?.trim() === "" ? null : values.logo_url?.trim(),
      cover_photo_url: values.cover_photo_url?.trim() === "" ? null : values.cover_photo_url?.trim(),
      photo_gallery_urls: galleryImages.slice(0, 24),
      division: values.division?.trim() === "" ? null : values.division?.trim(),
      district: values.district?.trim() === "" ? null : values.district?.trim(),
      city: values.city?.trim() === "" ? null : values.city?.trim(),
      established_year: values.established_year === "" || values.established_year == null ? null : Number(values.established_year),
      weekly_holidays: (values.weekly_holidays ?? "")
        .split(",")
        .map((v) => v.trim())
        .filter(Boolean),
      payment_methods: paymentMethods.filter(Boolean),
      delivery_available: values.delivery_available === true,
      holidays: holidays.filter((h) => /^\d{4}-\d{2}-\d{2}$/.test(h.date)),
    };
    if (perms.can_edit_currency === true) {
      settings.currency = (values.currency ?? "BDT").trim() || "BDT";
    }
    const payload: {
      name?: string;
      description?: string | null;
      phone?: string | null;
      email?: string | null;
      address?: string | null;
      settings: Record<string, unknown>;
    } = { settings };
    if (canEditBasics) {
      payload.name = trimmedName;
      payload.description = values.description?.trim() === "" ? null : values.description?.trim() ?? null;
      payload.phone = values.phone?.trim() === "" ? null : values.phone?.trim() ?? null;
      payload.email = values.email?.trim() === "" ? null : values.email?.trim() ?? null;
      payload.address = values.address?.trim() === "" ? null : values.address?.trim() ?? null;
    }
    const res = await patchShopProfile(accessToken, payload);
    if (!res.ok) {
      toast.error(formatApiError(res.body));
      return;
    }
    setProfile(res.data);
    toast.success("Shop profile saved");
    void load();
  }

  async function handleLogoUpload(file: File | null) {
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      toast.error("Please choose an image file.");
      return;
    }
    if (file.size > 1024 * 1024) {
      toast.error("Image too large. Keep logo under 1MB.");
      return;
    }
    try {
      const result = await optimizeImageFileToDataUrl(file, { maxWidth: 512, maxHeight: 512, quality: 0.8 });
      form.setValue("logo_url", result, { shouldDirty: true });
      toast.success("Logo uploaded and optimized. Save changes to publish.");
    } catch {
      toast.error("Could not process logo image.");
    }
  }

  async function handleCoverUpload(file: File | null) {
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      toast.error("Please choose an image file.");
      return;
    }
    if (file.size > 2 * 1024 * 1024) {
      toast.error("Cover image too large. Keep it under 2MB.");
      return;
    }
    try {
      const result = await optimizeImageFileToDataUrl(file, { maxWidth: 1400, maxHeight: 900, quality: 0.78 });
      form.setValue("cover_photo_url", result, { shouldDirty: true });
      toast.success("Cover uploaded and optimized. Save changes to publish.");
    } catch {
      toast.error("Could not process cover image.");
    }
  }

  function handleGalleryUpload(files: FileList | null) {
    if (!files || files.length === 0) return;
    const picked = Array.from(files).filter((f) => f.type.startsWith("image/")).slice(0, Math.max(0, 24 - galleryImages.length));
    if (!picked.length) {
      toast.error("Please choose image files.");
      return;
    }
    Promise.all(
      picked.map((f) => optimizeImageFileToDataUrl(f, { maxWidth: 1200, maxHeight: 1200, quality: 0.75 }))
    )
      .then((urls) => {
        setGalleryImages((prev) => [...prev, ...urls].slice(0, 24));
        toast.success("Gallery images added. Save changes to publish.");
      })
      .catch(() => toast.error("Could not read one or more images."));
  }

  function setDay(key: string, patch: Partial<{ closed: boolean; open: string; close: string }>) {
    setHours((prev) => ({
      ...prev,
      [key]: { ...prev[key], ...patch },
    }));
  }

  if (!ready || !profile) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-40 w-full rounded-2xl" />
        <Skeleton className="h-40 w-full rounded-2xl" />
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {!canSubmit ? (
        <p className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-950 dark:border-amber-900 dark:bg-amber-950/30 dark:text-amber-100">
          You can view this page, but only a manager or owner can save changes.
        </p>
      ) : null}

      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-8">
        <section className="rounded-2xl border border-zinc-200/80 bg-white p-5 shadow-sm dark:border-zinc-800 dark:bg-zinc-900/40">
          <h2 className="text-base font-semibold text-zinc-800 dark:text-white">Branding &amp; contact</h2>
          <p className="mt-1 text-xs text-zinc-800">Upload images directly. No image URL paste required.</p>
          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            <div className="sm:col-span-2">
              <Label htmlFor="name">Shop name</Label>
              <Input id="name" className="mt-1" disabled={!canEditBasics} {...form.register("name")} />
              {form.formState.errors.name ? (
                <p className="mt-1 text-xs text-red-600">{form.formState.errors.name.message}</p>
              ) : null}
            </div>
            <div className="sm:col-span-2">
              <Label htmlFor="description">About / description</Label>
              <Textarea id="description" rows={4} className="mt-1" disabled={!canEditBasics} {...form.register("description")} />
            </div>
            <div>
              <Label htmlFor="logo_upload">Logo</Label>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              {form.watch("logo_url") ? <img src={String(form.watch("logo_url"))} alt="Logo preview" className="mt-2 h-14 w-14 rounded-full border border-zinc-200 object-cover dark:border-zinc-700" /> : null}
              <Input
                id="logo_upload"
                type="file"
                accept="image/*"
                className="mt-2"
                disabled={!canEditBasics}
                onChange={(e) => handleLogoUpload(e.target.files?.[0] ?? null)}
              />
              <p className="mt-1 text-[11px] text-zinc-800">Upload a small image (recommended square).</p>
            </div>
            <div>
              <Label htmlFor="cover_upload">Cover photo</Label>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              {form.watch("cover_photo_url") ? <img src={String(form.watch("cover_photo_url"))} alt="Cover preview" className="mt-2 h-24 w-full rounded-lg border border-zinc-200 object-cover dark:border-zinc-700" /> : null}
              <Input
                id="cover_upload"
                type="file"
                accept="image/*"
                className="mt-2"
                disabled={!canEditBasics}
                onChange={(e) => handleCoverUpload(e.target.files?.[0] ?? null)}
              />
              <p className="mt-1 text-[11px] text-zinc-800">Upload banner/cover image for public profile.</p>
            </div>
            <div className="sm:col-span-2">
              <Label htmlFor="gallery_upload">Gallery images</Label>
              <Input
                id="gallery_upload"
                type="file"
                multiple
                accept="image/*"
                className="mt-1"
                disabled={!canEditBasics}
                onChange={(e) => handleGalleryUpload(e.target.files)}
              />
              <p className="mt-1 text-[11px] text-zinc-800">Upload multiple images. Max 24 images in gallery.</p>
            </div>
            <div>
              <Label>Categories</Label>
              <div className="mt-1 space-y-2">
                {categories.map((v, i) => (
                  <div key={`cat-${i}`} className="flex gap-2">
                    <Input
                      value={v}
                      placeholder="e.g. Barber, Grooming, Beauty"
                      disabled={!canEditBasics}
                      onChange={(e) => setCategories((prev) => prev.map((x, idx) => (idx === i ? e.target.value : x)))}
                    />
                    <Button type="button" variant="outline" disabled={!canEditBasics} onClick={() => setCategories((prev) => prev.filter((_, idx) => idx !== i))}>
                      Remove
                    </Button>
                  </div>
                ))}
                <Button type="button" variant="outline" disabled={!canEditBasics} onClick={() => setCategories((prev) => [...prev, ""])}>
                  Add category
                </Button>
              </div>
            </div>
            <div>
              <Label htmlFor="phone">Phone</Label>
              <Input id="phone" className="mt-1" disabled={!canEditBasics} {...form.register("phone")} />
            </div>
            <div>
              <Label htmlFor="whatsapp_phone">WhatsApp number</Label>
              <Input id="whatsapp_phone" className="mt-1" disabled={!canEditBasics} {...form.register("whatsapp_phone")} />
            </div>
            <div>
              <Label htmlFor="email">Email</Label>
              <Input id="email" type="email" className="mt-1" disabled={!canEditBasics} {...form.register("email")} />
            </div>
            <div className="sm:col-span-2">
              <Label htmlFor="google_maps_url">Google Maps URL</Label>
              <Input id="google_maps_url" className="mt-1" disabled={!canEditBasics} {...form.register("google_maps_url")} />
            </div>
            <div className="sm:col-span-2">
              <Label htmlFor="address">Address</Label>
              <Input id="address" className="mt-1" disabled={!canEditBasics} {...form.register("address")} />
            </div>
            <div>
              <Label htmlFor="area">Area / neighborhood</Label>
              <Input id="area" className="mt-1" disabled={!canEditBasics} {...form.register("area")} />
            </div>
            <div className="sm:col-span-2">
              <Label htmlFor="website">Website</Label>
              <Input id="website" placeholder="https://…" className="mt-1" disabled={!canEditBasics} {...form.register("website")} />
            </div>
            <div className="sm:col-span-2">
              <Label>Social profiles</Label>
              <div className="mt-1 space-y-2">
                {socialProfiles.map((row, i) => (
                  <div key={`social-${i}`} className="grid gap-2 sm:grid-cols-[1fr_2fr_auto]">
                    <Input
                      value={row.platform}
                      placeholder="Platform (Facebook, Instagram, TikTok...)"
                      disabled={!canEditBasics}
                      onChange={(e) =>
                        setSocialProfiles((prev) => prev.map((r, idx) => (idx === i ? { ...r, platform: e.target.value } : r)))
                      }
                    />
                    <Input
                      value={row.url}
                      placeholder="https://..."
                      disabled={!canEditBasics}
                      onChange={(e) =>
                        setSocialProfiles((prev) => prev.map((r, idx) => (idx === i ? { ...r, url: e.target.value } : r)))
                      }
                    />
                    <Button type="button" variant="outline" disabled={!canEditBasics} onClick={() => setSocialProfiles((prev) => prev.filter((_, idx) => idx !== i))}>
                      Remove
                    </Button>
                  </div>
                ))}
                <Button type="button" variant="outline" disabled={!canEditBasics} onClick={() => setSocialProfiles((prev) => [...prev, { platform: "", url: "" }])}>
                  Add social profile
                </Button>
              </div>
            </div>
            <div>
              <Label htmlFor="division">Division</Label>
              <Input id="division" className="mt-1" disabled={!canEditBasics} {...form.register("division")} />
            </div>
            <div>
              <Label htmlFor="district">District</Label>
              <Input id="district" className="mt-1" disabled={!canEditBasics} {...form.register("district")} />
            </div>
            <div>
              <Label htmlFor="city">City</Label>
              <Input id="city" className="mt-1" disabled={!canEditBasics} {...form.register("city")} />
            </div>
            <div>
              <Label htmlFor="established_year">Established year</Label>
              <Input id="established_year" type="number" min={1900} max={2100} className="mt-1" disabled={!canEditBasics} {...form.register("established_year")} />
            </div>
            <div>
              <Label htmlFor="weekly_holidays">Weekly holidays</Label>
              <Input id="weekly_holidays" placeholder="Friday, Sunday" className="mt-1" disabled={!canEditBasics} {...form.register("weekly_holidays")} />
            </div>
            <div>
              <Label>Payment methods</Label>
              <div className="mt-1 space-y-2">
                {paymentMethods.map((v, i) => (
                  <div key={`pm-${i}`} className="flex gap-2">
                    <Input
                      value={v}
                      placeholder="e.g. Cash, bKash, Nagad, Card"
                      disabled={!canEditBasics}
                      onChange={(e) => setPaymentMethods((prev) => prev.map((x, idx) => (idx === i ? e.target.value : x)))}
                    />
                    <Button type="button" variant="outline" disabled={!canEditBasics} onClick={() => setPaymentMethods((prev) => prev.filter((_, idx) => idx !== i))}>
                      Remove
                    </Button>
                  </div>
                ))}
                <Button type="button" variant="outline" disabled={!canEditBasics} onClick={() => setPaymentMethods((prev) => [...prev, ""])}>
                  Add payment method
                </Button>
              </div>
            </div>
            <div className="flex items-end">
              <label className="inline-flex items-center gap-2 text-sm text-zinc-700 dark:text-zinc-300">
                <input type="checkbox" disabled={!canEditBasics} {...form.register("delivery_available")} />
                Delivery available
              </label>
            </div>
            {(() => {
              if (!galleryImages.length) return null;
              return (
                <div className="sm:col-span-2">
                  <p className="mb-2 text-xs text-zinc-800">Gallery preview</p>
                  <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4">
                    {galleryImages.slice(0, 24).map((u, i) => (
                      <div key={`${u}-${i}`} className="relative">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={u} alt="Gallery preview" className="h-24 w-full rounded-lg border border-zinc-200 object-cover dark:border-zinc-700" />
                        <button
                          type="button"
                          className="absolute right-1 top-1 rounded bg-black/60 px-1.5 py-0.5 text-[10px] text-white"
                          disabled={!canEditBasics}
                          onClick={() => setGalleryImages((prev) => prev.filter((_, idx) => idx !== i))}
                        >
                          X
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })()}
          </div>
        </section>

        <section className="rounded-2xl border border-zinc-200/80 bg-white p-5 shadow-sm dark:border-zinc-800 dark:bg-zinc-900/40">
          <h2 className="text-base font-semibold text-zinc-800 dark:text-white">Business hours</h2>
          <ul className="mt-4 space-y-3">
            {SHOP_BUSINESS_DAYS.map(({ key, label }) => {
              const d = hours[key];
              if (!d) return null;
              return (
                <li
                  key={key}
                  className="flex flex-wrap items-center gap-3 rounded-lg border border-zinc-200 px-3 py-2 dark:border-zinc-700"
                >
                  <span className="w-28 text-sm font-medium text-zinc-800 dark:text-zinc-100">{label}</span>
                  <label className="flex items-center gap-2 text-xs text-zinc-800 dark:text-zinc-400">
                    <input
                      type="checkbox"
                      checked={d.closed}
                      disabled={!canEditHours}
                      onChange={(e) => setDay(key, { closed: e.target.checked })}
                    />
                    Closed
                  </label>
                  {!d.closed ? (
                    <>
                      <input
                        type="time"
                        disabled={!canEditHours}
                        value={d.open}
                        onChange={(e) => setDay(key, { open: e.target.value })}
                        className="rounded border border-zinc-200 bg-white px-2 py-1 text-sm dark:border-zinc-600 dark:bg-zinc-950"
                      />
                      <span className="text-zinc-400">–</span>
                      <input
                        type="time"
                        disabled={!canEditHours}
                        value={d.close}
                        onChange={(e) => setDay(key, { close: e.target.value })}
                        className="rounded border border-zinc-200 bg-white px-2 py-1 text-sm dark:border-zinc-600 dark:bg-zinc-950"
                      />
                    </>
                  ) : null}
                </li>
              );
            })}
          </ul>
        </section>

        <section className="rounded-2xl border border-zinc-200/80 bg-white p-5 shadow-sm dark:border-zinc-800 dark:bg-zinc-900/40">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <h2 className="text-base font-semibold text-zinc-800 dark:text-white">Holidays &amp; special closings</h2>
              <p className="mt-1 text-xs text-zinc-800">Whole-day closures (YYYY-MM-DD).</p>
            </div>
            <Button
              type="button"
              variant="outline"
              className="text-xs"
              disabled={!canEditHours}
              onClick={() => setHolidays((h) => [...h, { date: "", note: "" }])}
            >
              Add date
            </Button>
          </div>
          <ul className="mt-4 space-y-2">
            {holidays.map((h, i) => (
              <li key={i} className="flex flex-wrap items-center gap-2">
                <Input
                  type="date"
                  className="w-40"
                  disabled={!canEditHours}
                  value={h.date}
                  onChange={(e) => {
                    const v = e.target.value;
                    setHolidays((rows) => rows.map((r, j) => (j === i ? { ...r, date: v } : r)));
                  }}
                />
                <Input
                  placeholder="Note (optional)"
                  className="min-w-[8rem] flex-1"
                  disabled={!canEditHours}
                  value={h.note}
                  onChange={(e) => {
                    const v = e.target.value;
                    setHolidays((rows) => rows.map((r, j) => (j === i ? { ...r, note: v } : r)));
                  }}
                />
                <Button
                  type="button"
                  variant="outline"
                  className="text-xs"
                  disabled={!canEditHours}
                  onClick={() => setHolidays((rows) => rows.filter((_, j) => j !== i))}
                >
                  Remove
                </Button>
              </li>
            ))}
          </ul>
        </section>

        <section className="rounded-2xl border border-zinc-200/80 bg-white p-5 shadow-sm dark:border-zinc-800 dark:bg-zinc-900/40">
          <h2 className="text-base font-semibold text-zinc-800 dark:text-white">Booking defaults</h2>
          <p className="mt-1 text-xs text-zinc-800">
            Advance % applies to the sum of priced services on the public booking page (customer must confirm before
            submitting).
          </p>
          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            <div>
              <Label htmlFor="min_lead">Minimum lead time (hours)</Label>
              <Input id="min_lead" type="number" min={0} className="mt-1" disabled={!canEditHours} {...form.register("min_lead_time_hours")} />
            </div>
            <div>
              <Label htmlFor="booking_advance_percent">Advance payment (% of total)</Label>
              <Input
                id="booking_advance_percent"
                type="number"
                min={0}
                max={100}
                className="mt-1"
                disabled={!canEditHours}
                {...form.register("booking_advance_percent")}
              />
              {form.formState.errors.booking_advance_percent ? (
                <p className="mt-1 text-xs text-red-600">{form.formState.errors.booking_advance_percent.message}</p>
              ) : null}
            </div>
            <div>
              <Label htmlFor="currency">Currency code</Label>
              <Input id="currency" className="mt-1" disabled={!perms.can_edit_currency} {...form.register("currency")} />
            </div>
          </div>
        </section>

        <div className="flex justify-end">
          <Button type="submit" className="min-w-[148px] active:scale-100" disabled={!canSubmit || form.formState.isSubmitting}>
            {form.formState.isSubmitting ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Saving...
              </>
            ) : (
              "Save changes"
            )}
          </Button>
        </div>
      </form>
    </div>
  );
}

export function ShopGeneralPageClient() {
  return (
    <SalonManagementGate>
      {(token) => <FormBody accessToken={token} />}
    </SalonManagementGate>
  );
}
