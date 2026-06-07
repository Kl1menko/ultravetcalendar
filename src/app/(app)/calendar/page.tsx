"use client"

import { useRef, useCallback, useState } from "react"
import dynamic from "next/dynamic"
import { useCalendarContext } from "@/context/calendar"
import WeekStrip from "@/components/WeekStrip"
import DoctorFilterSheet from "@/components/DoctorFilterSheet"
import { DOCTORS, doctorShortName } from "@/lib/doctors"
import { isoDate, formatMonthYear } from "@/lib/utils-app"
import { Appointment } from "@/types"
import type FullCalendar from "@fullcalendar/react"

// No SSR for FullCalendar
const CalendarView = dynamic(() => import("@/components/CalendarView"), {
  ssr: false,
  loading: () => (
    <div className="flex items-center justify-center h-64 text-[var(--muted-col)] text-sm">
      Завантаження…
    </div>
  ),
})

export default function CalendarPage() {
  const {
    appointments,
    selectedDate,
    setSelectedDate,
    openDetailsAppt,
    openNewAppointmentAtTime,
  } = useCalendarContext()

  const calendarRef = useRef<FullCalendar | null>(null)
  const [doctorFilter, setDoctorFilter] = useState("Всі лікарі")
  const [doctorSheetOpen, setDoctorSheetOpen] = useState(false)
  const [currentMonth, setCurrentMonth] = useState(() => formatMonthYear(new Date()))

  const goToToday = useCallback(() => {
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    setSelectedDate(today)
    if (calendarRef.current) {
      calendarRef.current.getApi().gotoDate(today)
    }
  }, [setSelectedDate])

  const dayCount = appointments.filter(
    (a) =>
      a.date === isoDate(selectedDate) &&
      (doctorFilter === "Всі лікарі" || a.doctor === doctorFilter)
  ).length

  const doctorActive = doctorFilter !== "Всі лікарі"

  const handleEventClick = (appt: Appointment) => {
    openDetailsAppt(appt)
  }

  const handleDateClick = (time: string, date: Date) => {
    setSelectedDate(date)
    openNewAppointmentAtTime(time)
  }

  const handleDateChange = (date: Date) => {
    const curr = isoDate(date)
    const sel = isoDate(selectedDate)
    if (curr !== sel) {
      setSelectedDate(date)
    }
  }

  return (
    <div className="flex h-[calc(100svh-48px-max(env(safe-area-inset-bottom),8px)-env(safe-area-inset-top))] flex-col md:h-[calc(100dvh-96px)] md:rounded-[28px] md:border md:border-white/80 md:bg-white/88 md:p-5 md:shadow-[var(--desktop-shadow)] md:backdrop-blur-xl">
      {/* ─── CALENDAR HEADER ─── */}
      <header className="flex items-center justify-between gap-2 px-4 pt-2 pb-1.5 md:px-0 md:pb-5">
        <h2 className="text-[19px] font-black tracking-tight text-[var(--ink)] md:text-3xl">
          {currentMonth}
        </h2>
        <div className="flex items-center gap-2">
          {/* Today chip */}
          <button
            onClick={goToToday}
            aria-label="Сьогодні"
            className="grid h-8 place-items-center rounded-xl border-2 border-[var(--teal)] px-3 text-[13px] font-black text-[var(--teal)] transition-colors hover:bg-[var(--teal-light)] md:h-10 md:rounded-2xl md:px-4 md:text-[14px]"
          >
            Сьогодні
          </button>

          {/* Doctor filter (desktop dropdown) */}
          <div className="hidden h-10 items-center gap-2 rounded-2xl border border-[var(--line)] bg-[var(--paper)] px-3 md:flex">
            <select
              value={doctorFilter}
              onChange={(e) => setDoctorFilter(e.target.value)}
              className="text-[13px] font-semibold text-[var(--ink)] outline-none bg-transparent cursor-pointer"
            >
              <option>Всі лікарі</option>
              {DOCTORS.map((d) => <option key={d} value={d}>{doctorShortName(d)}</option>)}
            </select>
          </div>

          {/* Doctor filter (mobile) */}
          <button
            onClick={() => setDoctorSheetOpen(true)}
            aria-label="Фільтр лікаря"
            className={`md:hidden w-8 h-8 rounded-xl border grid place-items-center relative transition-colors ${
              doctorActive
                ? "border-[var(--teal)] bg-[var(--teal-light)] text-[var(--teal-dark)]"
                : "border-[var(--line)] bg-white text-[var(--ink-2)]"
            }`}
          >
            <svg viewBox="0 0 24 24" className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
              <path d="M16 21v-2a4 4 0 0 0-4-4H7a4 4 0 0 0-4 4v2M9.5 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8ZM22 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75"/>
            </svg>
            {doctorActive && (
              <span className="absolute top-1 right-1 w-1.5 h-1.5 rounded-full bg-[var(--teal)] border border-white" />
            )}
          </button>

        </div>
      </header>

      {/* ─── WEEK STRIP ─── */}
      <WeekStrip
        selectedDate={selectedDate}
        appointments={appointments}
        onSelectDate={setSelectedDate}
      />

      {/* ─── DAY SUMMARY ─── */}
      <div className="flex items-center gap-2 px-4 py-1 md:px-0 md:py-2">
        <span className="text-[13px] text-[var(--muted-col)] font-medium">Записів:</span>
        <strong className="text-[13px] font-bold text-[var(--ink)]">{dayCount}</strong>
        {doctorActive && (
          <span className="ml-1 px-2 py-0.5 rounded-full bg-[var(--teal-light)] text-[var(--teal)] text-[11px] font-bold">
            {doctorFilter}
          </span>
        )}
      </div>

      {/* ─── FULLCALENDAR ─── */}
      <div className="min-h-0 flex-1 px-3 pb-2 md:px-0 md:pb-0 md:overflow-hidden md:rounded-3xl md:border md:border-[var(--line)] md:bg-white">
        <CalendarView
          appointments={appointments}
          doctorFilter={doctorFilter}
          selectedDate={selectedDate}
          onDateChange={handleDateChange}
          onMonthChange={setCurrentMonth}
          onEventClick={handleEventClick}
          onDateClick={handleDateClick}
          calendarRef={calendarRef}
        />
      </div>

      {/* Doctor filter sheet (mobile) */}
      <DoctorFilterSheet
        open={doctorSheetOpen}
        onClose={() => setDoctorSheetOpen(false)}
        selected={doctorFilter}
        onSelect={setDoctorFilter}
      />
    </div>
  )
}
