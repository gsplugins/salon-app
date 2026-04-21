export function formatMoneyCents(cents: number): string {
  return new Intl.NumberFormat(undefined, { style: "currency", currency: "USD" }).format(cents / 100);
}

export function formatStaffDateTime(iso: string): string {
  return new Intl.DateTimeFormat(undefined, { dateStyle: "medium", timeStyle: "short" }).format(new Date(iso));
}

export function formatStaffDate(iso: string): string {
  return new Intl.DateTimeFormat(undefined, { dateStyle: "medium" }).format(new Date(iso));
}

export function formatStaffTime(iso: string): string {
  return new Intl.DateTimeFormat(undefined, { timeStyle: "short" }).format(new Date(iso));
}

export function bookingStatusLabel(status: string): string {
  switch (status) {
    case "pending":
      return "Pending";
    case "confirmed":
      return "Upcoming";
    case "completed":
      return "Completed";
    case "cancelled":
      return "Cancelled";
    case "no_show":
      return "No-show";
    default:
      return status;
  }
}

export function availabilityStatusLabel(s: string): string {
  switch (s) {
    case "available":
      return "Available";
    case "busy":
      return "Busy";
    case "on_leave":
      return "On leave";
    default:
      return s;
  }
}

export function isUpcomingBookingStatus(status: string): boolean {
  return status === "pending" || status === "confirmed";
}

export function isAppointmentSoon(iso: string, withinMinutes = 30): boolean {
  const t = new Date(iso).getTime();
  const now = Date.now();
  return t >= now && t <= now + withinMinutes * 60_000;
}
