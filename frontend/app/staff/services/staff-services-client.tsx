"use client";

import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { formatApiError } from "@/lib/auth-api";
import { formatMoneyCents } from "@/lib/staff-ui";
import { fetchStaffServices, type StaffServiceRow } from "@/lib/staff-api";
import { useSalonAccessToken } from "@/hooks/use-salon-access-token";
import { Skeleton } from "@/components/ui/skeleton";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export function StaffServicesClient() {
  const token = useSalonAccessToken();
  const [rows, setRows] = useState<StaffServiceRow[] | null>(null);

  const load = useCallback(async () => {
    if (!token) return;
    const res = await fetchStaffServices(token);
    if (!res.ok) {
      toast.error(formatApiError(res.body));
      setRows([]);
      return;
    }
    setRows(res.data);
  }, [token]);

  useEffect(() => {
    void load();
  }, [load]);

  if (!token) return null;

  if (rows === null) {
    return (
      <div className="space-y-3">
        <Skeleton className="h-10 w-48" />
        <Skeleton className="h-32 w-full" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-semibold text-zinc-900 dark:text-white">Services</h1>
        <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
          Services assigned to you — read-only. Staff notes, materials, and internal cost hints are not shown on the public booking site.
        </p>
      </div>
      <ul className="grid gap-3 sm:grid-cols-2">
        {rows.length === 0 ? (
          <li className="col-span-full rounded-2xl border border-dashed border-zinc-200 p-6 text-center text-sm text-zinc-500 dark:border-zinc-700">
            No services linked to your profile.
          </li>
        ) : (
          rows.map((s) => (
            <li key={s.id}>
              <Card className="h-full border-zinc-200/80 dark:border-zinc-800">
                <CardHeader className="pb-2">
                  <CardTitle className="text-base">{s.name}</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3 text-sm text-zinc-600 dark:text-zinc-400">
                  <p>
                    {s.duration_minutes} minutes
                    {(s.buffer_after_minutes ?? 0) > 0 ? ` + ${s.buffer_after_minutes} min buffer` : ""}
                    {s.price_cents != null ? ` · ${formatMoneyCents(s.price_cents)}` : ""}
                  </p>
                  {s.category ? <p className="text-xs uppercase tracking-wide text-zinc-500">{s.category}</p> : null}
                  <div>
                    <p className="text-xs font-semibold text-zinc-500">Client-facing description</p>
                    <p className="mt-1 text-zinc-700 dark:text-zinc-300">{s.description?.trim() ? s.description : "—"}</p>
                  </div>
                  {s.aftercare?.trim() ? (
                    <div>
                      <p className="text-xs font-semibold text-zinc-500">Aftercare</p>
                      <p className="mt-1 text-zinc-700 dark:text-zinc-300">{s.aftercare}</p>
                    </div>
                  ) : null}
                  <div>
                    <p className="text-xs font-semibold text-amber-800 dark:text-amber-200">Staff notes (internal)</p>
                    <p className="mt-1 text-zinc-800 dark:text-zinc-200">{s.staff_notes?.trim() ? s.staff_notes : "—"}</p>
                  </div>
                  {(s.materials_total_cents != null && s.materials_total_cents > 0) || (s.inventory_lines?.length ?? 0) > 0 ? (
                    <div className="rounded-lg border border-zinc-200 bg-zinc-50/90 p-3 text-xs dark:border-zinc-700 dark:bg-zinc-950/60">
                      <p className="font-semibold text-zinc-700 dark:text-zinc-200">Materials &amp; stock (internal)</p>
                      {s.materials_total_cents != null ? (
                        <p className="mt-1 text-zinc-600 dark:text-zinc-400">
                          Estimated materials per appointment:{" "}
                          <span className="font-medium text-zinc-900 dark:text-white">
                            {formatMoneyCents(s.materials_total_cents)}
                          </span>
                        </p>
                      ) : (
                        <p className="mt-1 text-zinc-500">Add unit costs or a fixed material cost per line to see a total.</p>
                      )}
                      {(s.inventory_lines ?? []).length > 0 ? (
                        <ul className="mt-2 space-y-1.5 border-t border-zinc-200 pt-2 dark:border-zinc-700">
                          {(s.inventory_lines ?? []).map((line, i) => (
                            <li key={`${s.id}-${line.inventory_item_id ?? i}`} className="flex flex-wrap gap-x-2 gap-y-0.5 text-zinc-600 dark:text-zinc-400">
                              <span className="font-medium text-zinc-800 dark:text-zinc-200">{line.name}</span>
                              <span>
                                × {line.quantity_per_service} {line.unit}/visit
                              </span>
                              <span className="text-zinc-500">· on hand {line.quantity_on_hand}</span>
                              {line.projected_material_cents != null ? (
                                <span>· ~{formatMoneyCents(line.projected_material_cents)}</span>
                              ) : null}
                              {line.is_low_stock ? (
                                <span className="text-amber-700 dark:text-amber-300">· low stock</span>
                              ) : null}
                              {line.staff_note?.trim() ? (
                                <span className="w-full text-zinc-500">Note: {line.staff_note}</span>
                              ) : null}
                            </li>
                          ))}
                        </ul>
                      ) : (
                        <p className="mt-2 text-zinc-500">No products linked to this service yet.</p>
                      )}
                    </div>
                  ) : null}
                  {(s.smart_hints ?? []).length > 0 ? (
                    <div className="rounded-lg border border-violet-200 bg-violet-50/80 p-3 text-xs text-violet-950 dark:border-violet-900 dark:bg-violet-950/40 dark:text-violet-100">
                      <p className="font-semibold text-violet-900 dark:text-violet-200">Smart hints</p>
                      <ul className="mt-1.5 list-disc space-y-1 pl-4">
                        {(s.smart_hints ?? []).map((h, idx) => (
                          <li key={idx}>{h}</li>
                        ))}
                      </ul>
                    </div>
                  ) : null}
                </CardContent>
              </Card>
            </li>
          ))
        )}
      </ul>
    </div>
  );
}
