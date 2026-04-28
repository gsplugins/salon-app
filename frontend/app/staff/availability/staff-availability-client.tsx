"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useForm, type Resolver } from "react-hook-form";
import { toast } from "sonner";
import { z } from "zod";
import { formatApiError } from "@/lib/auth-api";
import { availabilityStatusLabel, formatStaffDateTime } from "@/lib/staff-ui";
import {
  deleteStaffAvailabilityBlock,
  fetchStaffAvailability,
  fetchStaffAvailabilityBlocks,
  patchStaffAvailabilityStatus,
  postStaffAvailabilityBlock,
} from "@/lib/staff-api";
import { useSalonAccessToken } from "@/hooks/use-salon-access-token";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

const blockSchema = z.object({
  starts_at: z.string().min(1),
  ends_at: z.string().min(1),
  note: z.string().max(500).optional(),
});

type BlockForm = z.infer<typeof blockSchema>;

type AvailabilityBlockRow = {
  id: number;
  starts_at: string;
  ends_at: string;
  kind: string;
  note: string | null;
};

function addDays(d: Date, n: number): Date {
  const x = new Date(d);
  x.setDate(x.getDate() + n);
  return x;
}

function ymd(d: Date): string {
  return d.toISOString().slice(0, 10);
}

export function StaffAvailabilityClient() {
  const token = useSalonAccessToken();
  const [status, setStatus] = useState<string | null>(null);
  const [blocks, setBlocks] = useState<AvailabilityBlockRow[] | null>(null);

  const from = useMemo(() => ymd(new Date()), []);
  const to = useMemo(() => ymd(addDays(new Date(), 14)), []);

  const load = useCallback(async () => {
    if (!token) return;
    const [s, b] = await Promise.all([
      fetchStaffAvailability(token),
      fetchStaffAvailabilityBlocks(token, { from, to }),
    ]);
    if (!s.ok) {
      toast.error(formatApiError(s.body));
      setStatus(null);
    } else setStatus(s.data.availability_status);
    if (!b.ok) {
      toast.error(formatApiError(b.body));
      setBlocks([]);
    } else setBlocks(b.data);
  }, [token, from, to]);

  useEffect(() => {
    void load();
  }, [load]);

  const bf = useForm<BlockForm>({
    resolver: zodResolver(blockSchema) as Resolver<BlockForm>,
    defaultValues: { starts_at: "", ends_at: "", note: "" },
  });

  async function setAvail(next: string) {
    if (!token) return;
    const res = await patchStaffAvailabilityStatus(token, next);
    if (!res.ok) {
      toast.error(formatApiError(res.body));
      return;
    }
    toast.success(`Status: ${availabilityStatusLabel(next)}`);
    void load();
  }

  async function addBlock(values: BlockForm) {
    if (!token) return;
    const res = await postStaffAvailabilityBlock(token, {
      starts_at: new Date(values.starts_at).toISOString(),
      ends_at: new Date(values.ends_at).toISOString(),
      note: values.note || null,
      kind: "custom",
    });
    if (!res.ok) {
      toast.error(formatApiError(res.body));
      return;
    }
    toast.success("Unavailable block added.");
    bf.reset({ starts_at: "", ends_at: "", note: "" });
    void load();
  }

  async function removeBlock(id: number) {
    if (!token) return;
    if (!confirm("Remove this block?")) return;
    const res = await deleteStaffAvailabilityBlock(token, id);
    if (!res.ok) {
      toast.error(formatApiError(res.body));
      return;
    }
    toast.success("Removed.");
    void load();
  }

  const byWeekday = useMemo(() => {
    const m = new Map<number, AvailabilityBlockRow[]>();
    if (!blocks) return m;
    for (const b of blocks) {
      const wd = new Date(b.starts_at).getDay();
      const arr = m.get(wd) ?? [];
      arr.push(b);
      m.set(wd, arr);
    }
    return m;
  }, [blocks]);

  if (!token) return null;

  if (status === null || blocks === null) {
    return (
      <div className="space-y-3">
        <Skeleton className="h-10 w-48" />
        <Skeleton className="h-32 w-full" />
      </div>
    );
  }

  const dayLabels = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-zinc-800 dark:text-white">Availability</h1>
        <p className="mt-1 text-sm text-zinc-800 dark:text-zinc-400">
          Let the floor know if you are free, busy, or away. Custom blocks cover breaks; your manager can override in the shop
          system.
        </p>
      </div>

      <Card className="border-zinc-200/80 dark:border-zinc-800">
        <CardHeader>
          <CardTitle className="text-base">Current status</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-2">
          <p className="w-full text-sm text-zinc-800 dark:text-zinc-400">
            Now: <strong className="text-zinc-800 dark:text-white">{availabilityStatusLabel(status)}</strong>
          </p>
          {(["available", "busy", "on_leave"] as const).map((s) => (
            <Button key={s} type="button" variant={status === s ? "default" : "outline"} className="min-h-11" onClick={() => void setAvail(s)}>
              {availabilityStatusLabel(s)}
            </Button>
          ))}
        </CardContent>
      </Card>

      <Card className="border-zinc-200/80 dark:border-zinc-800">
        <CardHeader>
          <CardTitle className="text-base">This week at a glance</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-7 gap-1 text-center text-[10px] font-semibold uppercase text-zinc-800 sm:text-xs">
            {dayLabels.map((d) => (
              <div key={d}>{d.slice(0, 3)}</div>
            ))}
          </div>
          <div className="mt-2 grid grid-cols-7 gap-1">
            {dayLabels.map((_, wd) => (
              <ul key={wd} className="min-h-[72px] rounded-lg border border-zinc-100 bg-zinc-50/80 p-1 text-[10px] dark:border-zinc-800 dark:bg-zinc-900/40 sm:text-xs">
                {(byWeekday.get(wd) ?? []).map((b) => (
                  <li key={b.id} className="truncate rounded bg-white px-0.5 py-0.5 text-zinc-800 dark:bg-zinc-950 dark:text-zinc-200">
                    {formatStaffDateTime(b.starts_at).split(",")[1]?.trim() ?? "—"}
                  </li>
                ))}
              </ul>
            ))}
          </div>
        </CardContent>
      </Card>

      <form className="space-y-3 rounded-2xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-950/40" onSubmit={bf.handleSubmit(addBlock)}>
        <h2 className="text-sm font-semibold text-zinc-800 dark:text-white">Add unavailable window</h2>
        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <Label htmlFor="b-start">Starts</Label>
            <Input id="b-start" type="datetime-local" className="mt-1 min-h-11" {...bf.register("starts_at")} />
          </div>
          <div>
            <Label htmlFor="b-end">Ends</Label>
            <Input id="b-end" type="datetime-local" className="mt-1 min-h-11" {...bf.register("ends_at")} />
          </div>
        </div>
        <div>
          <Label htmlFor="b-note">Note (optional)</Label>
          <Textarea id="b-note" className="mt-1 min-h-[72px]" {...bf.register("note")} />
        </div>
        <Button type="submit" className="min-h-11" disabled={bf.formState.isSubmitting}>
          Save block
        </Button>
      </form>

      <div>
        <h2 className="text-sm font-semibold text-zinc-800 dark:text-white">Upcoming blocks</h2>
        <ul className="mt-2 space-y-2">
          {blocks.length === 0 ? (
            <li className="text-sm text-zinc-800">No custom blocks in the next two weeks.</li>
          ) : (
            blocks.map((b) => (
              <li
                key={b.id}
                className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-zinc-100 px-3 py-2 text-sm dark:border-zinc-800"
              >
                <div>
                  <p className="font-medium text-zinc-800 dark:text-white">
                    {formatStaffDateTime(b.starts_at)} → {formatStaffDateTime(b.ends_at)}
                  </p>
                  {b.note ? <p className="text-xs text-zinc-800">{b.note}</p> : null}
                </div>
                <Button type="button" variant="outline" className="min-h-10 px-3 py-2 text-xs" onClick={() => void removeBlock(b.id)}>
                  Remove
                </Button>
              </li>
            ))
          )}
        </ul>
      </div>
    </div>
  );
}
