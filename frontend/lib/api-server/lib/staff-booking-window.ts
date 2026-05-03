function parseHmMinutes(hm: string): number | null {
  const m = /^(\d{1,2}):(\d{2})$/.exec(hm.trim());
  if (!m) return null;
  const hh = Number(m[1]);
  const mm = Number(m[2]);
  if (!Number.isFinite(hh) || !Number.isFinite(mm) || hh < 0 || hh > 23 || mm < 0 || mm > 59) return null;
  return hh * 60 + mm;
}

function combineDateAndMinutesUtc(dateYmd: string, mins: number): Date {
  const hh = Math.floor(mins / 60);
  const mm = mins % 60;
  return new Date(`${dateYmd}T${String(hh).padStart(2, "0")}:${String(mm).padStart(2, "0")}:00.000Z`);
}

/** One day from `salon_staff.weekly_schedule` (same shape as shop business_hours). */
export function staffDayConfigForKey(
  weeklySchedule: unknown,
  dayKey: string
): { mode: "shop_default" } | { mode: "closed" } | { mode: "window"; openMins: number; closeMins: number } {
  const bh = weeklySchedule && typeof weeklySchedule === "object" && weeklySchedule !== null ? (weeklySchedule as Record<string, unknown>) : null;
  const day = bh && typeof bh[dayKey] === "object" && bh[dayKey] !== null ? (bh[dayKey] as Record<string, unknown>) : null;
  if (day && day.closed === true) return { mode: "closed" };
  if (day && typeof day.open === "string" && typeof day.close === "string") {
    const openMins = parseHmMinutes(day.open.slice(0, 5));
    const closeMins = parseHmMinutes(day.close.slice(0, 5));
    if (openMins != null && closeMins != null && closeMins > openMins) {
      return { mode: "window", openMins, closeMins };
    }
  }
  return { mode: "shop_default" };
}

/**
 * Intersects shop opening window with this staff member's weekly template for `dateYmd`.
 * Returns null when the staff day is closed or the intersection is empty.
 */
export function intersectShopAndStaffWorkingUtc(
  dateYmd: string,
  dayKey: string,
  shopDayStart: Date,
  shopDayEnd: Date,
  weeklySchedule: unknown
): { start: Date; end: Date } | null {
  const cfg = staffDayConfigForKey(weeklySchedule, dayKey);
  if (cfg.mode === "closed") return null;
  let workStart = shopDayStart;
  let workEnd = shopDayEnd;
  if (cfg.mode === "window") {
    workStart = combineDateAndMinutesUtc(dateYmd, cfg.openMins);
    workEnd = combineDateAndMinutesUtc(dateYmd, cfg.closeMins);
  }
  const start = workStart.getTime() > shopDayStart.getTime() ? workStart : shopDayStart;
  const end = workEnd.getTime() < shopDayEnd.getTime() ? workEnd : shopDayEnd;
  if (!(start.getTime() < end.getTime())) return null;
  return { start, end };
}

export function staffOnlineSlotStepMinutes(portalSettings: unknown): number {
  const ps = portalSettings && typeof portalSettings === "object" && portalSettings !== null ? (portalSettings as Record<string, unknown>) : null;
  const ob = ps?.online_booking && typeof ps.online_booking === "object" ? (ps.online_booking as Record<string, unknown>) : null;
  const raw = ob?.slot_interval_minutes;
  const n = typeof raw === "number" ? raw : Number(raw);
  if (!Number.isFinite(n)) return 15;
  return Math.min(60, Math.max(5, Math.round(n)));
}
