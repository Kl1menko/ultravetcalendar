"use client"

import { useEffect, useLayoutEffect, useRef, useState } from "react"
import FullCalendar from "@fullcalendar/react"
import timeGridPlugin from "@fullcalendar/timegrid"
import dayGridPlugin from "@fullcalendar/daygrid"
import interactionPlugin from "@fullcalendar/interaction"
import type { EventContentArg, EventDropArg } from "@fullcalendar/core"
import type { DateClickArg, EventResizeDoneArg } from "@fullcalendar/interaction"
import { Appointment } from "@/types"
import { useCalendarContext } from "@/context/calendar"
import { updateAppointment } from "@/lib/appointments"
import { HOUR_START, HOUR_END } from "@/lib/constants"
import { isoDate, minutesFromTime, timeFromMinutes } from "@/lib/utils-app"
import { fcTime, appointmentsToEvents } from "@/lib/calendar-view"
import { doctorColor } from "@/lib/doctors"
import { useIsDesktop } from "@/hooks/useIsDesktop"
import { ListView } from "@/components/calendar/ListView"
import { MobileWeekView } from "@/components/calendar/MobileWeekView"
import { MobileMonthView } from "@/components/calendar/MobileMonthView"

export type CalendarViewMode = "day" | "week" | "month" | "list"

const runAfterReactCommit = (fn: () => void) => {
  if (typeof queueMicrotask === "function") {
    queueMicrotask(fn)
    return
  }
  window.setTimeout(fn, 0)
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
  const { reload } = useCalendarContext()
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
    let cancelled = false
    const target =
      view === "week" ? "timeGridWeek" : view === "month" ? "dayGridMonth" : "timeGridDay"
    runAfterReactCommit(() => {
      if (cancelled || !calendarRef.current) return
      const api = calendarRef.current.getApi()
      if (api.view.type !== target) api.changeView(target)
    })
    return () => {
      cancelled = true
    }
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
    let cancelled = false
    runAfterReactCommit(() => {
      if (cancelled || !calendarRef.current) return
      const api = calendarRef.current.getApi()
      const calDate = api.getDate()
      if (isoDate(calDate) !== isoDate(selectedDate)) {
        api.gotoDate(selectedDate)
      }
    })
    return () => {
      cancelled = true
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

  // ─── Власні мобільні/списочні вигляди (десктоп → FullCalendar нижче) ───────
  if (view === "list") {
    return (
      <ListView
        appointments={appointments}
        selectedDate={selectedDate}
        filtered={filtered}
        onEventClick={onEventClick}
      />
    )
  }

  if (view === "week" && !isDesktop) {
    return (
      <MobileWeekView
        appointments={appointments}
        selectedDate={selectedDate}
        filtered={filtered}
        onEventClick={onEventClick}
        onDayNavigate={onDayNavigate}
      />
    )
  }

  if (view === "month" && !isDesktop) {
    return (
      <MobileMonthView
        appointments={appointments}
        selectedDate={selectedDate}
        filtered={filtered}
        onDayNavigate={onDayNavigate}
      />
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
      eventLongPressDelay={700}
      events={appointmentsToEvents(appointments, doctorFilter)}
      eventDrop={persistEventTimes}
      eventResize={persistEventTimes}
      eventClick={({ event, el }) => {
        const appt = event.extendedProps.appointment as Appointment
        // На мобільному після тапу :focus/:active може «залипнути» на події,
        // лишаючи її затемненою після відкриття sheet. Знімаємо фокус явно.
        ;(el as HTMLElement)?.blur?.()
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
        const monthLabel = mid
          .toLocaleDateString("uk-UA", { month: "long", year: "numeric" })
          .replace(/^./, (c) => c.toUpperCase())
        // selectedDate синхронізуємо лише в денному виді: там currentStart і є
        // показаним днем. У тижневому currentStart — понеділок, тож не чіпаємо
        // обрану дату (інакше вибір дня «стрибав» би на початок тижня).
        const nextDate = new Date(d)
        nextDate.setHours(0, 0, 0, 0)
        runAfterReactCommit(() => {
          onMonthChange(monthLabel)
          if (view === "day") {
            onDateChange(nextDate)
          }
        })
      }}
      eventClassNames="matte-appt-event !rounded-xl overflow-hidden"
      eventContent={(arg: EventContentArg) => {
        const appt = arg.event.extendedProps.appointment as Appointment
        const price = appt.price ? Number(appt.price) : 0
        const durMins = minutesFromTime(appt.end) - minutesFromTime(appt.start)
        const isShort = durMins < 45
        // Колір лікаря → кольорова смужка-акцент ліворуч (реальний елемент,
        // щоб надійно взяти колір незалежно від внутрішньої розмітки FC).
        const accent = doctorColor(appt.doctor).border
        const stripe = (
          <span
            className="absolute inset-y-[7px] left-0 w-[3px] rounded-full"
            style={{ background: accent }}
          />
        )

        if (isShort) {
          return (
            <div className="relative px-2 py-1 flex items-center gap-1.5 h-full overflow-hidden">
              {stripe}
              <span className="text-[13px] font-extrabold shrink-0 text-[var(--ink)]">
                {appt.start} {appt.pet}
              </span>
              {appt.service && (
                <span className="text-[12px] font-medium truncate text-[var(--ink-2)]">
                  {appt.service}
                </span>
              )}
              {price > 0 && (
                <span className="ml-auto text-[12px] font-extrabold shrink-0 text-[var(--ink)]">
                  {price.toLocaleString("uk-UA")} ₴
                </span>
              )}
            </div>
          )
        }

        return (
          <div className="relative flex flex-col h-full px-2 py-1.5 overflow-hidden">
            {stripe}
            <span className="text-[14px] font-extrabold leading-tight truncate text-[var(--ink)]">
              {appt.pet}
            </span>
            <span className="text-[12px] font-semibold leading-tight truncate text-[var(--ink-2)] mt-0.5">
              {appt.service}
            </span>
            <span className="text-[12px] font-medium leading-tight truncate text-[var(--ink-2)]">
              {appt.client}
            </span>
            {price > 0 && (
              <span className="text-[13px] font-extrabold leading-tight truncate mt-0.5 text-[var(--ink)]">
                {price.toLocaleString("uk-UA")} ₴
              </span>
            )}
            <span className="text-[11px] font-bold mt-auto text-[var(--ink)]">
              {appt.start}–{appt.end}
            </span>
          </div>
        )
      }}
    />
    </div>
  )
}
