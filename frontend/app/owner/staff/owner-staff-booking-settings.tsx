"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import {
  SHOP_BUSINESS_DAYS,
  type DayHoursState,
  hoursToPayload
} from "@/lib/shop-business-hours";
import {
  createBlockedSlot,
  deleteBlockedSlot,
  fetchBlockedSlots,
  formatApiError,
  updateStaffCatalog,
  type BlockedSlotRow
} from "@/lib/salon-api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

function dayScheduleFromObject(raw: unknown, useDefaultsForMissing: boolean): DayHoursState {
  const out: DayHoursState = {} as DayHoursState;
  const bh = raw && typeof raw === "object" && raw !== null ? (raw as Record<string, unknown>) : null;
  for (const { key } of SHOP_BUSINESS_DAYS) {
    const day = bh && typeof bh[key] === "object" && bh[key] !== null ? (bh[key] as Record<string, unknown>) : null;
    if (day && day.closed) {
      out[key] = { closed: true, open: "09:00", close: "18:00" };
    } else if (day && typeof day.open === "string" && typeof day.close === "string") {
      out[key] = { closed: false, open: day.open.slice(0, 5), close: day.close.slice(0, 5) };
    } else if (useDefaultsForMissing) {
      out[key] = { closed: false, open: "09:00", close: "18:00" };
    } else {
      out[key] = { closed: false, open: "", close: "" };
    }
  }
  return out;
}

function toLocalDatetimeValue(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function fromLocalDatetimeValue(local: string): string {
  const d = new Date(local);
  return d.toISOString();
}

const BLOCK_KINDS = [
  { value: "lunch", label: "Lunch" },
  { value: "break", label: "Break" },
  { value: "other", label: "Other / blocked" }
] as const;

type Props = {
  accessToken: string;
  staffId: number;
  staffName: string;
  weeklySchedule: unknown;
  onlineSlotIntervalMinutes: number;
  onBookingSettingsSaved: () => void;
};

export function OwnerStaffBookingSettings(props: Props) {
  const { accessToken, staffId, staffName, weeklySchedule, onlineSlotIntervalMinutes, onBookingSettingsSaved } = props;
  const [hours, setHours] = useState<DayHoursState>(() => dayScheduleFromObject(weeklySchedule, true));
  const [slotInterval, setSlotInterval] = useState(String(onlineSlotIntervalMinutes ?? 15));
  const [savingHours, setSavingHours] = useState(false);
  const [blocks, setBlocks] = useState<BlockedSlotRow[]>([]);
  const [blocksLoading, setBlocksLoading] = useState(true);
  const [newKind, setNewKind] = useState<string>("lunch");
  const [newStart, setNewStart] = useState("");
  const [newEnd, setNewEnd] = useState("");
  const [newReason, setNewReason] = useState("");
  const [addingBlock, setAddingBlock] = useState(false);

  const { fromIso, toIso } = useMemo(() => {
    const from = new Date();
    from.setHours(0, 0, 0, 0);
    const to = new Date(from);
    to.setDate(to.getDate() + 14);
    to.setHours(23, 59, 59, 999);
    return { fromIso: from.toISOString(), toIso: to.toISOString() };
  }, []);

  const loadBlocks = useCallback(async () => {
    setBlocksLoading(true);
    const res = await fetchBlockedSlots(fromIso, toIso, accessToken, staffId);
    setBlocksLoading(false);
    if (!res.ok) {
      toast.error(formatApiError(res.body));
      setBlocks([]);
      return;
    }
    setBlocks(res.data);
  }, [accessToken, fromIso, toIso, staffId]);

  useEffect(() => {
    setHours(dayScheduleFromObject(weeklySchedule, true));
    setSlotInterval(String(onlineSlotIntervalMinutes ?? 15));
  }, [weeklySchedule, onlineSlotIntervalMinutes]);

  useEffect(() => {
    void loadBlocks();
  }, [loadBlocks]);

  function setDay(key: string, patch: Partial<{ closed: boolean; open: string; close: string }>) {
    setHours((prev) => ({ ...prev, [key]: { ...prev[key], ...patch } }));
  }

  async function saveHoursAndSpacing() {
    const n = Number.parseInt(slotInterval, 10);
    if (!Number.isFinite(n) || n < 5 || n > 60) {
      toast.error("Slot spacing must be between 5 and 60 minutes.");
      return;
    }
    setSavingHours(true);
    const res = await updateStaffCatalog(accessToken, staffId, {
      weekly_schedule: hoursToPayload(hours),
      online_slot_interval_minutes: n
    });
    setSavingHours(false);
    if (!res.ok) {
      toast.error(formatApiError(res.body));
      return;
    }
    toast.success("Booking week & slot spacing saved.");
    onBookingSettingsSaved();
  }

  async function addBlock() {
    if (!newStart || !newEnd) {
      toast.error("Choose start and end for the block.");
      return;
    }
    const startsAt = fromLocalDatetimeValue(newStart);
    const endsAt = fromLocalDatetimeValue(newEnd);
    if (new Date(endsAt).getTime() <= new Date(startsAt).getTime()) {
      toast.error("End must be after start.");
      return;
    }
    setAddingBlock(true);
    const res = await createBlockedSlot(accessToken, {
      salon_staff_id: staffId,
      starts_at: startsAt,
      ends_at: endsAt,
      kind: newKind,
      reason: newReason.trim() === "" ? null : newReason.trim()
    });
    setAddingBlock(false);
    if (!res.ok) {
      toast.error(formatApiError(res.body));
      return;
    }
    toast.success("Block added.");
    setNewStart("");
    setNewEnd("");
    setNewReason("");
    void loadBlocks();
  }

  async function removeBlock(id: number) {
    if (!confirm("Remove this block?")) return;
    const res = await deleteBlockedSlot(accessToken, id);
    if (!res.ok) {
      toast.error(formatApiError(res.body));
      return;
    }
    toast.success("Removed.");
    void loadBlocks();
  }

  return (
    <div className="mt-4 space-y-6 rounded-xl border border-violet-200/80 bg-violet-50/40 p-4 dark:border-violet-900/40 dark:bg-violet-950/20">
      <div>
        <h3 className="text-sm font-semibold text-zinc-900 dark:text-white">Online booking — {staffName}</h3>
        <p className="mt-1 text-xs text-zinc-700 dark:text-zinc-400">
          Weekly hours and slot spacing apply when customers pick this person. Lunch and breaks block online booking for
          the times you add (next 14 days shown).
        </p>
      </div>

      <div className="space-y-3">
        <p className="text-xs font-medium uppercase tracking-wide text-zinc-800 dark:text-zinc-300">Weekly template</p>
        <div className="overflow-x-auto rounded-lg border border-zinc-200 bg-white dark:border-zinc-700 dark:bg-zinc-950">
          <table className="w-full min-w-[300px] text-left text-xs">
            <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
              {SHOP_BUSINESS_DAYS.map(({ key, label }) => (
                <tr key={key}>
                  <th className="w-[26%] py-2 pl-2 pr-1 font-medium text-zinc-800 dark:text-zinc-200">{label}</th>
                  <td className="py-2 pr-1">
                    <label className="flex items-center gap-1.5 text-zinc-800 dark:text-zinc-200">
                      <input
                        type="checkbox"
                        checked={hours[key].closed}
                        onChange={() => setDay(key, { closed: !hours[key].closed })}
                      />
                      Closed
                    </label>
                  </td>
                  <td className="py-2 pr-2">
                    <div className="flex flex-wrap items-center gap-1">
                      <Input
                        className="h-8 w-[5.25rem] px-1.5 text-xs"
                        disabled={hours[key].closed}
                        value={hours[key].open}
                        onChange={(e) => setDay(key, { open: e.target.value.slice(0, 5) })}
                        placeholder="09:00"
                      />
                      <span className="text-zinc-500">–</span>
                      <Input
                        className="h-8 w-[5.25rem] px-1.5 text-xs"
                        disabled={hours[key].closed}
                        value={hours[key].close}
                        onChange={(e) => setDay(key, { close: e.target.value.slice(0, 5) })}
                        placeholder="18:00"
                      />
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="flex flex-wrap items-end gap-3">
          <div className="space-y-1">
            <Label className="text-xs">Slot spacing (min)</Label>
            <Input
              type="number"
              min={5}
              max={60}
              className="h-9 w-24 text-xs"
              value={slotInterval}
              onChange={(e) => setSlotInterval(e.target.value)}
            />
          </div>
          <Button type="button" className="min-h-9 text-xs" disabled={savingHours} onClick={() => void saveHoursAndSpacing()}>
            {savingHours ? "Saving…" : "Save week & spacing"}
          </Button>
        </div>
      </div>

      <div className="space-y-3 border-t border-violet-200/60 pt-4 dark:border-violet-900/40">
        <p className="text-xs font-medium uppercase tracking-wide text-zinc-800 dark:text-zinc-300">
          Lunch, breaks & custom blocks
        </p>
        {blocksLoading ? (
          <p className="text-xs text-zinc-800">Loading blocks…</p>
        ) : blocks.length === 0 ? (
          <p className="text-xs text-zinc-800 dark:text-zinc-400">No staff blocks in the next 14 days.</p>
        ) : (
          <ul className="max-h-40 space-y-1.5 overflow-y-auto text-xs">
            {blocks.map((b) => (
              <li
                key={b.id}
                className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-zinc-200 bg-white px-2 py-1.5 dark:border-zinc-700 dark:bg-zinc-900"
              >
                <span className="text-zinc-800 dark:text-zinc-100">
                  <span className="font-medium capitalize">{b.kind}</span>
                  {" · "}
                  {toLocalDatetimeValue(b.starts_at)} → {toLocalDatetimeValue(b.ends_at)}
                  {b.reason ? <span className="text-zinc-600"> · {b.reason}</span> : null}
                </span>
                <Button type="button" variant="outline" className="h-7 px-2 text-xs" onClick={() => void removeBlock(b.id)}>
                  Remove
                </Button>
              </li>
            ))}
          </ul>
        )}

        <div className="grid gap-2 rounded-lg border border-zinc-200 bg-white p-3 dark:border-zinc-700 dark:bg-zinc-950 sm:grid-cols-2">
          <div className="space-y-1 sm:col-span-2">
            <Label className="text-xs">Type</Label>
            <select
              className="h-9 w-full max-w-xs rounded-md border border-zinc-200 bg-white px-2 text-xs dark:border-zinc-700 dark:bg-zinc-950"
              value={newKind}
              onChange={(e) => setNewKind(e.target.value)}
            >
              {BLOCK_KINDS.map((k) => (
                <option key={k.value} value={k.value}>
                  {k.label}
                </option>
              ))}
            </select>
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Start</Label>
            <Input type="datetime-local" className="h-9 text-xs" value={newStart} onChange={(e) => setNewStart(e.target.value)} />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">End</Label>
            <Input type="datetime-local" className="h-9 text-xs" value={newEnd} onChange={(e) => setNewEnd(e.target.value)} />
          </div>
          <div className="space-y-1 sm:col-span-2">
            <Label className="text-xs">Note (optional)</Label>
            <Input className="h-9 text-xs" value={newReason} onChange={(e) => setNewReason(e.target.value)} placeholder="e.g. Team lunch" />
          </div>
          <Button type="button" className="sm:col-span-2 min-h-9 text-xs" disabled={addingBlock} onClick={() => void addBlock()}>
            {addingBlock ? "Adding…" : "Add block for this staff member"}
          </Button>
        </div>
      </div>
    </div>
  );
}
