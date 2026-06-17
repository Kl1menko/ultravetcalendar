"use client"

import { useEffect, useLayoutEffect, useRef, useState } from "react"
import FullCalendar from "@fullcalendar/react"
import timeGridPlugin from "@fullcalendar/timegrid"
import dayGridPlugin from "@fullcalendar/daygrid"
import interactionPlugin from "@fullcalendar/interaction"
import type { EventContentArg, EventDropArg } from "@fullcalendar/core"
import type { DateClickArg, EventResizeDoneArg } from "@fullcalendar/interaction"
import { motion } from "motion/react"
import { Appointment } from "@/types"
import { doctorColor } from "@/lib/doctors"
import { statusStyle } from "@/lib/status"
import { staggerContainer, staggerItem } from "@/lib/motion"
import { useCalendarContext } from "@/context/calendar"
import { updateAppointment } from "@/lib/appointments"
import { HOUR_START, HOUR_END } from "@/lib/constants"
import { isoDate, minutesFromTime, timeFromMinutes } from "@/lib/utils-app"

// Час події FullCalendar → "HH:MM" (локальний, без UTC-зсуву).
function fcTime(d: Date): string {
  return timeFromMinutes(d.getHours() * 60 + d.getMinutes())
}

// ≥md — десктоп: там показуємо повну сітку FullCalendar. На мобільному
// тиждень/місяць рендеримо власними компактними виглядами (mobile-first).
function useIsDesktop(): boolean {
  const [isDesktop, setIsDesktop] = useState(false)
  useEffect(() => {
    const mq = window.matchMedia("(min-width: 768px)")
    const update = () => setIsDesktop(mq.matches)
    update()
    mq.addEventListener("change", update)
    return () => mq.removeEventListener("change", update)
  }, [])
  return isDesktop
}

const WEEKDAY_SHORT = ["НД", "ПН", "ВТ", "СР", "ЧТ", "ПТ", "СБ"]

// 7 днів тижня, що містить date (тиждень з неділі — як WeekStrip/FullCalendar uk).
function weekDays(date: Date): Date[] {
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

export type CalendarViewMode = "day" | "week" | "month" | "list"

// Картка запису для списку та мобільного тижня — єдиний вигляд.
function ApptCard({
  appt,
  showPrice,
  onClick,
}: {
  appt: Appointment
  showPrice: boolean
  onClick: () => void
}) {
  const color = doctorColor(appt.doctor)
  const st = statusStyle(appt.status)
  const price = showPrice && appt.price ? Number(appt.price) : 0
  return (
    <motion.button
      variants={staggerItem}
      type="button"
      onClick={onClick}
      className="flex w-full items-stretch gap-3 rounded-2xl border border-[var(--line)] bg-white p-3 text-left transition active:scale-[0.99] hover:border-[var(--teal-mid)]"
    >
      <span className="w-1 shrink-0 rounded-full" style={{ background: color.border }} />
      <span className="flex min-w-0 flex-1 flex-col gap-0.5">
        <span className="flex items-center gap-2">
          <span className="text-[13px] font-black text-[var(--ink)]">
            {appt.start}–{appt.end}
          </span>
          <span
            className="rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-[0.3px]"
            style={{ background: st.bg, color: st.text }}
          >
            {appt.status}
          </span>
        </span>
        <span className="truncate text-[14px] font-bold text-[var(--ink)]">
          {appt.pet}{appt.service ? ` · ${appt.service}` : ""}
        </span>
        <span className="truncate text-[12px] text-[var(--muted-col)]">
          {appt.client}
        </span>
      </span>
      {price > 0 && (
        <span className="ml-auto self-center text-[13px] font-black" style={{ color: color.border }}>
          {price.toLocaleString("uk-UA")} ₴
        </span>
      )}
    </motion.button>
  )
}

function DayEmpty({ text = "Записів немає" }: { text?: string }) {
  return (
    <div className="flex h-full flex-col items-center justify-center gap-2 py-10 text-center text-[var(--muted-col)]">
      <svg viewBox="0 0 24 24" className="h-10 w-10 opacity-40" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round">
        <rect x="3" y="4" width="18" height="18" rx="2" /><path d="M16 2v4M8 2v4M3 10h18" />
      </svg>
      <span className="text-[14px] font-semibold">{text}</span>
      <span className="text-[12px]">Тапніть «+», щоб додати запис</span>
    </div>
  )
}

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
  view: CalendarViewMode
  onDateChange: (date: Date) => void
  onMonthChange: (monthLabel: string) => void
  onEventClick: (appt: Appointment) => void
  onDateClick: (time: string, date: Date) => void
  /** Клік по дню в місячному виді → перейти на цей день у денному виді. */
  onDayNavigate: (date: Date) => void
  calendarRef: React.RefObject<FullCalendar | null>
}

export default function CalendarView({
  appointments,
  doctorFilter,
  selectedDate,
  view,
  onDateChange,
  onMonthChange,
  onEventClick,
  onDateClick,
  onDayNavigate,
  calendarRef,
}: Props) {
  const { canSeeAppointmentPrices, reload } = useCalendarContext()
  const isDesktop = useIsDesktop()
  const filtered = (a: Appointment) =>
    doctorFilter === "Всі лікарі" || a.doctor === doctorFilter

  // Переміщення/ресайз події → перерахунок часу і збереження в БД.
  // На помилці відкочуємо подію (info.revert). Дата теж оновлюється — на
  // тижневому виді подію можна перетягнути в інший день.
  const persistEventTimes = async (
    info: EventDropArg | EventResizeDoneArg
  ) => {
    const { event } = info
    if (!event.start || !event.end) return
    const id = (event.extendedProps.appointment as Appointment).id
    const { error } = await updateAppointment(id, {
      date: isoDate(event.start),
      start_time: fcTime(event.start),
      end_time: fcTime(event.end),
    })
    if (error) {
      info.revert()
      return
    }
    reload()
  }

  // Перемикання виду FullCalendar (day/week) через imperative API — без
  // ремоунту календаря, тож стан зуму/позиції зберігається.
  useEffect(() => {
    if (view === "list" || !calendarRef.current) return
    const api = calendarRef.current.getApi()
    const target =
      view === "week" ? "timeGridWeek" : view === "month" ? "dayGridMonth" : "timeGridDay"
    if (api.view.type !== target) api.changeView(target)
  }, [view, calendarRef])

  // Висота 15-хвилинного слота в px. Масштабується pinch-жестом (як у Google
  // Calendar) і застосовується через CSS-змінну --fc-slot-height.
  const SLOT_MIN = 24
  const SLOT_MAX = 96
  const SLOT_DEFAULT = 40
  // Робочий діапазон, який має поміститись у видиму область за замовчуванням
  // (клієнт: «щоб було видно з 10 до 18»). У 15-хв слотах: (18−10)·4 = 32 слоти.
  const FIT_START_HOUR = 10
  const FIT_END_HOUR = 18
  const FIT_SLOTS = (FIT_END_HOUR - FIT_START_HOUR) * 4
  const containerRef = useRef<HTMLDivElement>(null)
  const [slotHeight, setSlotHeight] = useState(SLOT_DEFAULT)
  // Чи зумив користувач вручну (pinch). Якщо так — авто-фіт більше не чіпає
  // висоту, щоб не перебивати ручний масштаб.
  const userZoomedRef = useRef(false)

  // Стан активного pinch-жесту: початкова відстань між пальцями і висота на старті.
  const pinchRef = useRef<{ startDist: number; startHeight: number } | null>(null)

  // Sync FullCalendar when selectedDate changes externally
  useEffect(() => {
    if (!calendarRef.current) return
    const api = calendarRef.current.getApi()
    const calDate = api.getDate()
    if (isoDate(calDate) !== isoDate(selectedDate)) {
      api.gotoDate(selectedDate)
    }
  }, [selectedDate, calendarRef])

  // Pinch-to-zoom: на двопальцевий жест змінюємо висоту слотів.
  useEffect(() => {
    const el = containerRef.current
    if (!el) return

    const dist = (t: TouchList) =>
      Math.hypot(t[0].clientX - t[1].clientX, t[0].clientY - t[1].clientY)

    const onTouchStart = (e: TouchEvent) => {
      if (e.touches.length !== 2) return
      pinchRef.current = { startDist: dist(e.touches), startHeight: slotHeight }
    }

    const onTouchMove = (e: TouchEvent) => {
      const pinch = pinchRef.current
      if (!pinch || e.touches.length !== 2) return
      e.preventDefault() // не скролимо сторінку під час масштабу
      userZoomedRef.current = true // далі авто-фіт не перебиває ручний зум
      const scale = dist(e.touches) / pinch.startDist
      const next = Math.round(pinch.startHeight * scale)
      setSlotHeight(Math.min(SLOT_MAX, Math.max(SLOT_MIN, next)))
    }

    const onTouchEnd = (e: TouchEvent) => {
      if (e.touches.length < 2) pinchRef.current = null
    }

    // passive:false — щоб preventDefault працював і блокував скрол при pinch.
    el.addEventListener("touchstart", onTouchStart, { passive: false })
    el.addEventListener("touchmove", onTouchMove, { passive: false })
    el.addEventListener("touchend", onTouchEnd)
    el.addEventListener("touchcancel", onTouchEnd)
    return () => {
      el.removeEventListener("touchstart", onTouchStart)
      el.removeEventListener("touchmove", onTouchMove)
      el.removeEventListener("touchend", onTouchEnd)
      el.removeEventListener("touchcancel", onTouchEnd)
    }
  }, [slotHeight])

  // Авто-масштаб: підбираємо висоту слота так, щоб робочий діапазон 10:00–18:00
  // помістився у видиму область без прокрутки (клієнт: «щоб усе влазило в екран»),
  // і скролимо сітку на 10:00. Лише для часових видів (week/day) і доки користувач
  // не масштабував вручну pinch-жестом. Реагує на зміну виду й ресайз вікна.
  useLayoutEffect(() => {
    if (view === "list" || view === "month") return
    const el = containerRef.current
    if (!el) return

    const fit = () => {
      if (userZoomedRef.current) return
      // Запас на рядок із датами тижня та паддинги сітки.
      const headerAllowance = view === "week" ? 52 : 24
      const usable = el.clientHeight - headerAllowance
      if (usable <= 0) return
      const next = Math.round(usable / FIT_SLOTS)
      setSlotHeight(Math.min(SLOT_MAX, Math.max(SLOT_MIN, next)))
      // Після перерахунку висоти прокручуємо до початку робочого дня.
      const api = calendarRef.current?.getApi()
      api?.scrollToTime(`${String(FIT_START_HOUR).padStart(2, "0")}:00:00`)
    }

    // Чекаємо, поки FullCalendar відрендерить сітку, тоді міряємо контейнер.
    const raf = requestAnimationFrame(fit)
    const ro = new ResizeObserver(fit)
    ro.observe(el)
    return () => {
      cancelAnimationFrame(raf)
      ro.disconnect()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [view])

  // ─── Список: легка вертикальна стрічка записів обраного дня ───────────────
  if (view === "list") {
    const dayAppts = appointments
      .filter((a) => a.date === isoDate(selectedDate) && filtered(a))
      .sort((a, b) => minutesFromTime(a.start) - minutesFromTime(b.start))

    if (dayAppts.length === 0) return <DayEmpty />

    return (
      <motion.div
        variants={staggerContainer}
        initial="hidden"
        animate="visible"
        className="flex h-full flex-col gap-2 overflow-y-auto px-1 py-2 md:px-2"
      >
        {dayAppts.map((appt) => (
          <ApptCard key={appt.id} appt={appt} showPrice={canSeeAppointmentPrices} onClick={() => onEventClick(appt)} />
        ))}
      </motion.div>
    )
  }

  // ─── Тиждень на мобільному: записи згруповані по 7 днях (mobile-first) ─────
  if (view === "week" && !isDesktop) {
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
                    <ApptCard key={appt.id} appt={appt} showPrice={canSeeAppointmentPrices} onClick={() => onEventClick(appt)} />
                  ))}
                </div>
              )}
            </motion.section>
          )
        })}
      </motion.div>
    )
  }

  // ─── Місяць на мобільному: компактна сітка чисел з крапками-індикаторами ───
  if (view === "month" && !isDesktop) {
    const first = new Date(selectedDate.getFullYear(), selectedDate.getMonth(), 1)
    const gridStart = new Date(first)
    gridStart.setDate(1 - first.getDay()) // вирівнюємо на неділю
    const cells = Array.from({ length: 42 }, (_, i) => {
      const d = new Date(gridStart)
      d.setDate(gridStart.getDate() + i)
      return d
    })
    const todayIso = isoDate(new Date())
    const selIso = isoDate(selectedDate)
    const countFor = (iso: string) =>
      appointments.filter((a) => a.date === iso && filtered(a)).length

    return (
      <div className="flex h-full flex-col px-1 py-2">
        <div className="mb-1 grid grid-cols-7">
          {WEEKDAY_SHORT.map((w) => (
            <span key={w} className="py-1 text-center text-[10px] font-bold uppercase tracking-[0.3px] text-[var(--muted-col)]">
              {w}
            </span>
          ))}
        </div>
        <div className="grid flex-1 grid-cols-7 gap-1">
          {cells.map((d) => {
            const iso = isoDate(d)
            const inMonth = d.getMonth() === selectedDate.getMonth()
            const isToday = iso === todayIso
            const isSel = iso === selIso
            const count = countFor(iso)
            return (
              <button
                key={iso}
                type="button"
                onClick={() => onDayNavigate(d)}
                className={[
                  "flex flex-col items-center gap-1 rounded-xl py-1.5 transition active:scale-95",
                  isSel ? "bg-[var(--teal)] text-white" : isToday ? "bg-[var(--teal-light)]" : "",
                ].join(" ")}
              >
                <span
                  className={[
                    "text-[13px] font-bold",
                    isSel ? "text-white" : inMonth ? "text-[var(--ink)]" : "text-[var(--uv-gray-300)]",
                  ].join(" ")}
                >
                  {d.getDate()}
                </span>
                <span className="flex h-1.5 items-center gap-0.5">
                  {count > 0 &&
                    Array.from({ length: Math.min(count, 3) }).map((_, i) => (
                      <span
                        key={i}
                        className="h-1.5 w-1.5 rounded-full"
                        style={{ background: isSel ? "#fff" : "var(--teal)" }}
                      />
                    ))}
                </span>
              </button>
            )
          })}
        </div>
      </div>
    )
  }

  return (
    <div
      ref={containerRef}
      className="h-full"
      style={{ "--fc-slot-height": `${slotHeight}px` } as React.CSSProperties}
    >
    <FullCalendar
      ref={calendarRef}
      plugins={[timeGridPlugin, dayGridPlugin, interactionPlugin]}
      initialView={
        view === "week" ? "timeGridWeek" : view === "month" ? "dayGridMonth" : "timeGridDay"
      }
      initialDate={selectedDate}
      headerToolbar={false}
      allDaySlot={false}
      slotMinTime={`${String(HOUR_START).padStart(2, "0")}:00:00`}
      slotMaxTime={`${String(HOUR_END).padStart(2, "0")}:00:00`}
      slotDuration="00:15:00"
      locale="uk"
      height="100%"
      nowIndicator
      editable
      eventStartEditable
      eventDurationEditable
      eventLongPressDelay={350}
      events={appointmentsToEvents(appointments, doctorFilter)}
      eventDrop={persistEventTimes}
      eventResize={persistEventTimes}
      eventClick={({ event }) => {
        const appt = event.extendedProps.appointment as Appointment
        onEventClick(appt)
      }}
      dateClick={(arg: DateClickArg) => {
        const { date } = arg
        const clickedDate = new Date(date)
        clickedDate.setHours(0, 0, 0, 0)
        // У місячному виді клік по дню — це навігація на день, а не нова подія
        // (у month-комірці немає часу — створювати запис на 00:00 безглуздо).
        if (view === "month") {
          onDayNavigate(clickedDate)
          return
        }
        const mins = date.getHours() * 60 + date.getMinutes()
        const rounded = Math.round(mins / 15) * 15
        const time = timeFromMinutes(rounded)
        onDateClick(time, clickedDate)
      }}
      datesSet={({ view: fcView }) => {
        const d = fcView.currentStart
        // Лейбл місяця — за серединою діапазону (для тижня currentStart може бути
        // в попередньому місяці), щоб заголовок відповідав видимому тижню.
        const mid = new Date((fcView.currentStart.getTime() + fcView.currentEnd.getTime()) / 2)
        onMonthChange(
          mid.toLocaleDateString("uk-UA", { month: "long", year: "numeric" })
            .replace(/^./, (c) => c.toUpperCase())
        )
        // selectedDate синхронізуємо лише в денному виді: там currentStart і є
        // показаним днем. У тижневому currentStart — понеділок, тож не чіпаємо
        // обрану дату (інакше вибір дня «стрибав» би на початок тижня).
        if (view === "day") {
          const nd = new Date(d)
          nd.setHours(0, 0, 0, 0)
          onDateChange(nd)
        }
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
                {appt.start} {appt.pet}
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
              {appt.pet}
            </span>
            <span className="text-[11px] leading-tight truncate opacity-75 mt-0.5" style={{ color: color.text }}>
              {appt.service}
            </span>
            <span className="text-[11px] leading-tight truncate opacity-75" style={{ color: color.text }}>
              {appt.client}
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
    </div>
  )
}
