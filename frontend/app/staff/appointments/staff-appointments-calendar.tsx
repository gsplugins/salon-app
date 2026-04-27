"use client";

import type { EventInput } from "@fullcalendar/core";
import FullCalendar from "@fullcalendar/react";
import timeGridPlugin from "@fullcalendar/timegrid";
import type { StaffBookingRow } from "@/lib/staff-api";

function eventColorForStatus(status: string): { backgroundColor: string; borderColor: string; textColor: string } {
  if (status === "completed") {
    return { backgroundColor: "#dcfce7", borderColor: "#86efac", textColor: "#14532d" };
  }
  if (status === "cancelled" || status === "no_show") {
    return { backgroundColor: "#fee2e2", borderColor: "#fca5a5", textColor: "#7f1d1d" };
  }
  return { backgroundColor: "#fef3c7", borderColor: "#fcd34d", textColor: "#78350f" };
}

export function StaffAppointmentsCalendar(props: {
  rows: StaffBookingRow[];
  onSelectBooking: (id: number) => void;
}) {
  const events: EventInput[] = props.rows.map((b) => {
    const tone = eventColorForStatus(b.status);
    return {
      id: String(b.id),
      title: `${b.service?.name ?? "Service"} · ${b.customer_name}`,
      start: b.starts_at,
      end: b.ends_at,
      backgroundColor: tone.backgroundColor,
      borderColor: tone.borderColor,
      textColor: tone.textColor,
    };
  });

  return (
    <div className="staff-fc min-h-[480px] overflow-hidden rounded-2xl border border-zinc-200 bg-white p-1 shadow-sm dark:border-zinc-800 dark:bg-zinc-950">
      <FullCalendar
        plugins={[timeGridPlugin]}
        initialView="timeGridWeek"
        headerToolbar={{
          left: "prev,next today",
          center: "title",
          right: "timeGridDay,timeGridWeek",
        }}
        height="auto"
        slotMinTime="06:00:00"
        slotMaxTime="22:00:00"
        allDaySlot={false}
        nowIndicator
        events={events}
        eventClick={(info) => {
          const id = Number(info.event.id);
          if (Number.isFinite(id)) props.onSelectBooking(id);
        }}
      />
    </div>
  );
}
