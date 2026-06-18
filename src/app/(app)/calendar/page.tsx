"use client"

import { useRef, useCallback, useState } from "react"
import dynamic from "next/dynamic"
import { useCalendarContext } from "@/context/calendar"
import WeekStrip from "@/components/WeekStrip"
import DoctorFilterSheet from "@/components/DoctorFilterSheet"
import { DOCTORS, doctorShortName } from "@/lib/doctors"
import { isoDate, formatMonthYear } from "@/lib/utils-app"
import { Appointment } from "@/types"
import type { CalendarViewMode } from "@/components/CalendarView"
import type FullCalendar from "@fullcalendar/react"

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
  const dateInputRef = useRef<HTMLInputElement>(null)
  const [doctorFilter, setDoctorFilter] = useState("Всі лікарі")
  const [doctorSheetOpen, setDoctorSheetOpen] = useState(false)
  const [view, setView] = useState<CalendarViewMode>("day")
  const [currentMonth, setCurrentMonth] = useState(() => formatMonthYear(new Date()))

  const goToDate = useCallback((date: Date) => {
    const d = new Date(date)
    d.setHours(0, 0, 0, 0)
    setSelectedDate(d)
    if (calendarRef.current) {
      calendarRef.current.getApi().gotoDate(d)
    }
  }, [setSelectedDate])

  const goToToday = useCallback(() => {
    goToDate(new Date())
  }, [goToDate])

  // Клік по обгортці іконки → пробуємо showPicker() (десктоп/сучасні браузери).
  // На iOS це може кинути — ігноруємо: там пікер відкриє сам клікабельний input
  // (прозорий оверлей). Значення парситься як локальна дата (без UTC-зсуву).
  const openDatePicker = useCallback(() => {
    try {
      dateInputRef.current?.showPicker?.()
    } catch {
      // iOS Safari: showPicker недоступний поза певним контекстом — ок, тап по
      // самому input усе одно відкриє нативний пікер.
    }
  }, [])

  const handleDatePicked = useCallback((value: string) => {
    if (!value) return
    const [y, m, d] = value.split("-").map(Number)
    goToDate(new Date(y, m - 1, d))
  }, [goToDate])

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
    <div className="calendar-page flex w-full max-w-full flex-none flex-col overflow-hidden md:rounded-[28px] md:p-5 md:glass">
      {/* ─── CALENDAR HEADER ─── */}
      <header className="sticky top-0 z-10 flex shrink-0 items-center justify-between gap-2 border-b border-white/35 bg-white/45 px-4 pb-3 pt-[calc(var(--app-safe-top)+0.5rem)] shadow-[0_10px_30px_rgba(17,24,39,0.04)] backdrop-blur-2xl backdrop-saturate-150 md:static md:border-b-0 md:bg-transparent md:px-0 md:pb-5 md:pt-0 md:shadow-none md:backdrop-blur-none md:backdrop-saturate-100">
        <h2 className="text-[16px] font-bold tracking-tight text-[var(--ink)] md:text-2xl">
          {currentMonth}
        </h2>
        <div className="flex items-center gap-2">
          {/* Today chip */}
          <button
            onClick={goToToday}
            aria-label="Сьогодні"
            className="grid h-10 place-items-center rounded-2xl border-2 border-[var(--teal)] px-3.5 text-[14px] font-bold text-[var(--teal)] transition-colors hover:bg-[var(--teal-light)] md:px-4"
          >
            Сьогодні
          </button>

          {/* Date picker (native). Сам input лежить прозорим оверлеєм над іконкою
              і є клікабельною ціллю — так нативний пікер відкривається тапом
              навіть на iOS Safari, де showPicker() ненадійний. На десктопі
              клік по іконці додатково викликає showPicker(). */}
          <div
            className="glass glass-hover relative grid h-10 w-10 place-items-center rounded-2xl text-[var(--ink-2)] transition-colors hover:text-[var(--teal)]"
            onClick={openDatePicker}
          >
            <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
              <rect x="3" y="4" width="18" height="18" rx="2" />
              <path d="M16 2v4M8 2v4M3 10h18" />
            </svg>
            <input
              ref={dateInputRef}
              type="date"
              aria-label="Вибрати дату"
              value={isoDate(selectedDate)}
              onChange={(e) => handleDatePicked(e.target.value)}
              className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
            />
          </div>

          {/* Doctor filter (desktop dropdown) */}
          <div className="glass hidden h-10 items-center gap-2 rounded-2xl px-3 md:flex">
            <select
              value={doctorFilter}
              onChange={(e) => setDoctorFilter(e.target.value)}
              className="cursor-pointer bg-transparent text-[13px] font-semibold text-[var(--ink)] outline-none"
            >
              <option>Всі лікарі</option>
              {DOCTORS.map((d) => <option key={d} value={d}>{doctorShortName(d)}</option>)}
            </select>
          </div>

          {/* Doctor filter (mobile) */}
          <button
            onClick={() => setDoctorSheetOpen(true)}
            aria-label="Фільтр лікаря"
            className={`relative grid h-10 w-10 place-items-center rounded-2xl border transition-colors md:hidden ${
              doctorActive
                ? "border-[var(--teal)] bg-[var(--teal)] text-white"
                : "glass text-[var(--ink-2)]"
            }`}
          >
            <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
              <path d="M16 21v-2a4 4 0 0 0-4-4H7a4 4 0 0 0-4 4v2M9.5 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8ZM22 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75"/>
            </svg>
            {doctorActive && (
              <span className="absolute right-1.5 top-1.5 h-2 w-2 rounded-full border border-white bg-[var(--teal)]" />
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

      {/* ─── VIEW TABS: День / Тиждень / Місяць / Список ─── */}
      <div className="glass mx-4 mb-1.5 shrink-0 rounded-2xl px-1 md:mx-0">
        <div className="flex">
          {([
            { key: "day", label: "День" },
            { key: "week", label: "Тиждень" },
            { key: "month", label: "Місяць" },
            { key: "list", label: "Список" },
          ] as const).map((v) => {
            const active = view === v.key
            return (
              <button
                key={v.key}
                onClick={() => setView(v.key)}
                className={[
                  "relative flex-1 py-2.5 text-center text-[14px] font-semibold transition-colors",
                  active
                    ? "text-[var(--ink)]"
                    : "text-[var(--muted-col)] hover:text-[var(--ink-2)]",
                ].join(" ")}
              >
                {v.label}
                {active && (
                  <span className="absolute inset-x-3 bottom-0 h-[2.5px] rounded-full bg-[var(--uv-black)]" />
                )}
              </button>
            )
          })}
        </div>
      </div>

      {/* ─── FULLCALENDAR ─── */}
      <div className="flex min-h-0 flex-1 flex-col overflow-hidden px-3 pb-2 md:px-0 md:pb-0 md:rounded-3xl md:border md:border-[var(--lg-border)] md:bg-white/30">
        <CalendarView
          appointments={appointments}
          doctorFilter={doctorFilter}
          selectedDate={selectedDate}
          view={view}
          onDateChange={handleDateChange}
          onMonthChange={setCurrentMonth}
          onEventClick={handleEventClick}
          onDateClick={handleDateClick}
          onDayNavigate={(date) => { goToDate(date); setView("day") }}
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
