"use client"

import { useEffect } from "react"
import FullCalendar from "@fullcalendar/react"
import timeGridPlugin from "@fullcalendar/timegrid"
import interactionPlugin from "@fullcalendar/interaction"
import type { EventContentArg } from "@fullcalendar/core"
import type { DateClickArg } from "@fullcalendar/interaction"
import { Appointment } from "@/types"
import { doctorColor } from "@/lib/doctors"
import { useCalendarContext } from "@/context/calendar"
import { HOUR_START, HOUR_END } from "@/lib/constants"
import { isoDate, minutesFromTime, timeFromMinutes } from "@/lib/utils-app"

type FCEvent = {
  id: string
  title: string
  start: string
  end: string
  backgroundColor: string
  borderColor: string
  textColor: string
  extendedProps: { appointment: Appointment }
}

function appointmentsToEvents(appointments: Appointment[], doctorFilter: string): FCEvent[] {
  return appointments
    .filter((a) => doctorFilter === "Всі лікарі" || a.doctor === doctorFilter)
    .map((a) => {
      const color = doctorColor(a.doctor)
      return {
        id: a.id,
        title: a.client,
        start: `${a.date}T${a.start}`,
        end: `${a.date}T${a.end}`,
        backgroundColor: color.bg,
        borderColor: color.border,
        textColor: color.text,
        extendedProps: { appointment: a },
      }
    })
}

type Props = {
  appointments: Appointment[]
  doctorFilter: string
  selectedDate: Date
  onDateChange: (date: Date) => void
  onMonthChange: (monthLabel: string) => void
  onEventClick: (appt: Appointment) => void
  onDateClick: (time: string, date: Date) => void
  calendarRef: React.RefObject<FullCalendar | null>
}

export default function CalendarView({
  appointments,
  doctorFilter,
  selectedDate,
  onDateChange,
  onMonthChange,
  onEventClick,
  onDateClick,
  calendarRef,
}: Props) {
  const { canSeeAppointmentPrices } = useCalendarContext()

  // Sync FullCalendar when selectedDate changes externally
  useEffect(() => {
    if (!calendarRef.current) return
    const api = calendarRef.current.getApi()
    const calDate = api.getDate()
    if (isoDate(calDate) !== isoDate(selectedDate)) {
      api.gotoDate(selectedDate)
    }
  }, [selectedDate, calendarRef])

  return (
    <FullCalendar
      ref={calendarRef}
      plugins={[timeGridPlugin, interactionPlugin]}
      initialView="timeGridDay"
      initialDate={selectedDate}
      headerToolbar={false}
      allDaySlot={false}
      slotMinTime={`${String(HOUR_START).padStart(2, "0")}:00:00`}
      slotMaxTime={`${String(HOUR_END).padStart(2, "0")}:00:00`}
      slotDuration="00:15:00"
      locale="uk"
      height="100%"
      nowIndicator
      events={appointmentsToEvents(appointments, doctorFilter)}
      eventClick={({ event }) => {
        const appt = event.extendedProps.appointment as Appointment
        onEventClick(appt)
      }}
      dateClick={(arg: DateClickArg) => {
        const { date } = arg
        const mins = date.getHours() * 60 + date.getMinutes()
        const rounded = Math.round(mins / 15) * 15
        const time = timeFromMinutes(rounded)
        const clickedDate = new Date(date)
        clickedDate.setHours(0, 0, 0, 0)
        onDateClick(time, clickedDate)
      }}
      datesSet={({ view }) => {
        const d = view.currentStart
        const nd = new Date(d)
        nd.setHours(0, 0, 0, 0)
        onDateChange(nd)
        onMonthChange(
          d.toLocaleDateString("uk-UA", { month: "long", year: "numeric" })
            .replace(/^./, (c) => c.toUpperCase())
        )
      }}
      eventClassNames="!rounded-xl !border-0 overflow-hidden"
      eventContent={(arg: EventContentArg) => {
        const appt = arg.event.extendedProps.appointment as Appointment
        const color = doctorColor(appt.doctor)
        const price = canSeeAppointmentPrices && appt.price ? Number(appt.price) : 0
        const durMins = minutesFromTime(appt.end) - minutesFromTime(appt.start)
        const isShort = durMins < 45

        if (isShort) {
          return (
            <div className="px-2 py-1 flex items-center gap-1.5 h-full overflow-hidden">
              <span className="text-[11px] font-bold shrink-0" style={{ color: color.text }}>
                {appt.start} {appt.client}
              </span>
              {appt.service && (
                <span className="text-[11px] truncate opacity-75" style={{ color: color.text }}>
                  {appt.service}
                </span>
              )}
              {price > 0 && (
                <span className="ml-auto text-[10px] font-bold shrink-0" style={{ color: color.border }}>
                  {price.toLocaleString("uk-UA")} ₴
                </span>
              )}
            </div>
          )
        }

        return (
          <div className="flex flex-col h-full px-2 py-1.5 overflow-hidden">
            <span className="text-[12px] font-bold leading-tight truncate" style={{ color: color.text }}>
              {appt.client}
            </span>
            <span className="text-[11px] leading-tight truncate opacity-75 mt-0.5" style={{ color: color.text }}>
              {appt.service}
            </span>
            {price > 0 && (
              <span className="text-[11px] font-bold leading-tight truncate mt-0.5" style={{ color: color.border }}>
                {price.toLocaleString("uk-UA")} ₴
              </span>
            )}
            <span className="text-[10px] font-semibold mt-auto" style={{ color: color.border }}>
              {appt.start}–{appt.end}
            </span>
          </div>
        )
      }}
    />
  )
}
