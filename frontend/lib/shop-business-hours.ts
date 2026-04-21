export const SHOP_BUSINESS_DAYS: { key: string; label: string }[] = [
  { key: "mon", label: "Monday" },
  { key: "tue", label: "Tuesday" },
  { key: "wed", label: "Wednesday" },
  { key: "thu", label: "Thursday" },
  { key: "fri", label: "Friday" },
  { key: "sat", label: "Saturday" },
  { key: "sun", label: "Sunday" },
];

export type DayHoursState = Record<string, { closed: boolean; open: string; close: string }>;

export function hoursFromSettings(settings: Record<string, unknown> | undefined): DayHoursState {
  const bh =
    settings && typeof settings === "object" && "business_hours" in settings
      ? (settings.business_hours as Record<string, unknown> | undefined)
      : undefined;
  const out: DayHoursState = {};
  for (const { key } of SHOP_BUSINESS_DAYS) {
    const day = bh && typeof bh[key] === "object" && bh[key] !== null ? (bh[key] as Record<string, unknown>) : null;
    if (day && day.closed) {
      out[key] = { closed: true, open: "09:00", close: "18:00" };
    } else if (day && typeof day.open === "string" && typeof day.close === "string") {
      out[key] = { closed: false, open: day.open.slice(0, 5), close: day.close.slice(0, 5) };
    } else {
      out[key] = { closed: false, open: "09:00", close: "18:00" };
    }
  }
  return out;
}

export function hoursToPayload(h: DayHoursState): Record<string, { closed?: boolean; open?: string; close?: string }> {
  const payload: Record<string, { closed?: boolean; open?: string; close?: string }> = {};
  for (const { key } of SHOP_BUSINESS_DAYS) {
    const d = h[key];
    if (!d) continue;
    if (d.closed) {
      payload[key] = { closed: true };
    } else {
      // send closed:false so recursive backend merges can clear prior "closed:true"
      payload[key] = { closed: false, open: d.open, close: d.close };
    }
  }
  return payload;
}
