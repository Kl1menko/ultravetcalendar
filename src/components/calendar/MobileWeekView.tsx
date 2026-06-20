"use client"

import { motion } from "motion/react"
import { Appointment } from "@/types"
import { staggerContainer, staggerItem } from "@/lib/motion"
import { isoDate, minutesFromTime } from "@/lib/utils-app"
import { WEEKDAY_SHORT, weekDays } from "@/lib/calendar-view"
import { ApptCard } from "./ApptCard"

// Тиждень на мобільному: записи згруповані по 7 днях (mobile-first).
export function MobileWeekView({
  appointments,
  selectedDate,
  filtered,
  onEventClick,
  onDayNavigate,
}: {
  appointments: Appointment[]
  selectedDate: Date
  filtered: (a: Appointment) => boolean
  onEventClick: (appt: Appointment) => void
  onDayNavigate: (date: Date) => void
}) {
  const days = weekDays(selectedDate)
  return (
    <motion.div
      key={isoDate(days[0])}
      variants={staggerContainer}
      initial="hidden"
      animate="visible"
      className="flex h-full flex-col gap-4 overflow-y-auto px-1 py-2"
    >
      {days.map((d) => {
        const iso = isoDate(d)
        const dayAppts = appointments
          .filter((a) => a.date === iso && filtered(a))
          .sort((a, b) => minutesFromTime(a.start) - minutesFromTime(b.start))
        const isToday = iso === isoDate(new Date())
        return (
          <motion.section key={iso} variants={staggerItem}>
            <button
              type="button"
              onClick={() => onDayNavigate(d)}
              className="mb-1.5 flex w-full items-center gap-2 px-1 text-left"
            >
              <span className={`text-[11px] font-bold uppercase tracking-[0.4px] ${isToday ? "text-[var(--teal)]" : "text-[var(--muted-col)]"}`}>
                {WEEKDAY_SHORT[d.getDay()]}
              </span>
              <span className={`text-[15px] font-black ${isToday ? "text-[var(--teal-dark)]" : "text-[var(--ink)]"}`}>
                {d.getDate()}
              </span>
              <span className="ml-auto text-[11px] font-semibold text-[var(--muted-col)]">
                {dayAppts.length ? `${dayAppts.length} зап.` : "—"}
              </span>
            </button>
            {dayAppts.length === 0 ? (
              <div className="rounded-xl border border-dashed border-[var(--line)] py-3 text-center text-[12px] text-[var(--muted-col)]">
                Немає записів
              </div>
            ) : (
              <div className="flex flex-col gap-2">
                {dayAppts.map((appt) => (
                  <ApptCard key={appt.id} appt={appt} onClick={() => onEventClick(appt)} />
                ))}
              </div>
            )}
          </motion.section>
        )
      })}
    </motion.div>
  )
}
