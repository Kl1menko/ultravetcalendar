"use client"

import { Appointment } from "@/types"
import { isoDate } from "@/lib/utils-app"
import { WEEKDAY_SHORT } from "@/lib/calendar-view"

// Місяць на мобільному: компактна сітка чисел з крапками-індикаторами.
export function MobileMonthView({
  appointments,
  selectedDate,
  filtered,
  onDayNavigate,
}: {
  appointments: Appointment[]
  selectedDate: Date
  filtered: (a: Appointment) => boolean
  onDayNavigate: (date: Date) => void
}) {
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
