// Чисті helpers для CalendarView — без React, тож тестуються окремо.
import { Appointment } from "@/types"
import { timeFromMinutes } from "./utils-app"
import { doctorColor } from "./doctors"

// Час події FullCalendar → "HH:MM" (локальний, без UTC-зсуву).
export function fcTime(d: Date): string {
  return timeFromMinutes(d.getHours() * 60 + d.getMinutes())
}

export const WEEKDAY_SHORT = ["НД", "ПН", "ВТ", "СР", "ЧТ", "ПТ", "СБ"]

// 7 днів тижня, що містить date (тиждень з неділі — як WeekStrip/FullCalendar uk).
export function weekDays(date: Date): Date[] {
  const base = new Date(date)
  base.setHours(0, 0, 0, 0)
  const start = new Date(base)
  start.setDate(base.getDate() - base.getDay()) // неділя
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(start)
    d.setDate(start.getDate() + i)
    return d
  })
}

export type FCEvent = {
  id: string
  title: string
  start: string
  end: string
  backgroundColor: string
  borderColor: string
  textColor: string
  extendedProps: { appointment: Appointment }
}

export function appointmentsToEvents(
  appointments: Appointment[],
  doctorFilter: string
): FCEvent[] {
  return appointments
    .filter((a) => doctorFilter === "Всі лікарі" || a.doctor === doctorFilter)
    .map((a) => {
      // Колір лікаря → кольорова смужка ліворуч (через borderColor, який CSS
      // підхоплює як current accent). Решта картки лишається нейтрально-білою.
      const accent = doctorColor(a.doctor).border
      return {
        id: a.id,
        title: a.client,
        start: `${a.date}T${a.start}`,
        end: `${a.date}T${a.end}`,
        backgroundColor: "rgba(255, 255, 255, 0.72)",
        borderColor: accent,
        textColor: "#171717",
        extendedProps: { appointment: a },
      }
    })
}
