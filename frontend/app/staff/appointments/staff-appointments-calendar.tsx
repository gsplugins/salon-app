"use client";

import type { EventInput } from "@fullcalendar/core";
import FullCalendar from "@fullcalendar/react";
import timeGridPlugin from "@fullcalendar/timegrid";
import type { StaffBookingRow } from "@/lib/staff-api";

export function StaffAppointmentsCalendar(props: {
  rows: StaffBookingRow[];
  onSelectBooking: (id: number) => void;
}) {
  const events: EventInput[] = props.rows.map((b) => ({
    id: String(b.id),
    title: `${b.service?.name ?? "Service"} · ${b.customer_name}`,
    start: b.starts_at,
    end: b.ends_at,
  }));

  return (
    <div className="staff-fc min-h-[480px] overflow-hidden rounded-2xl border border-zinc-200 bg-white p-1 dark:border-zinc-800 dark:bg-zinc-950">
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
