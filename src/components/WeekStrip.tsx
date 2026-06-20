"use client"

import { useEffect, useRef } from "react"
import { isoDate, formatTitle } from "@/lib/utils-app"

type Props = {
  selectedDate: Date
  onSelectDate: (date: Date) => void
}

const DAY_NAMES = ["НД", "ПН", "ВТ", "СР", "ЧТ", "ПТ", "СБ"]

export default function WeekStrip({ selectedDate, onSelectDate }: Props) {
  const stripRef = useRef<HTMLDivElement>(null)

  const today = new Date()
  today.setHours(0, 0, 0, 0)

  // Build 14 days: 3 before selected + selected + 10 after
  const base = new Date(selectedDate)
  const start = new Date(base)
  start.setDate(base.getDate() - 3)

  const days = Array.from({ length: 14 }, (_, i) => {
    const d = new Date(start)
    d.setDate(start.getDate() + i)
    return d
  })

  // Scroll selected card into view (лише на мобільному — на десктопі смужка
  // не скролиться, картки розтягнуті на всю ширину, тож центрувати нічого).
  useEffect(() => {
    if (window.matchMedia("(min-width: 768px)").matches) return
    const el = stripRef.current?.querySelector<HTMLButtonElement>("[data-selected=true]")
    if (el) {
      el.scrollIntoView({ inline: "center", behavior: "smooth", block: "nearest" })
    }
  }, [selectedDate])

  return (
    <div className="shrink-0 px-4 pb-2 overflow-x-auto scrollbar-hide md:overflow-x-visible md:px-0">
      <div ref={stripRef} className="flex gap-1.5 min-w-max md:min-w-0 md:gap-2">
        {days.map((d) => {
          const iso = isoDate(d)
          const isSelected = iso === isoDate(selectedDate)
          const isTodayDay = iso === isoDate(today)

          return (
            <button
              key={iso}
              type="button"
              data-selected={isSelected}
              aria-label={formatTitle(d)}
              onClick={() => {
                const nd = new Date(d)
                nd.setHours(0, 0, 0, 0)
                onSelectDate(nd)
              }}
              className={[
                "flex flex-col items-center gap-[2px] min-w-[52px] py-2 px-2 rounded-2xl border cursor-pointer transition-all duration-150 active:scale-95 select-none md:min-w-0 md:flex-1 md:py-2.5",
                isSelected
                  ? "bg-[var(--teal)] border-[var(--teal)] shadow-sm"
                  : isTodayDay
                  ? "glass-chip !border-[var(--teal)]"
                  : "glass-chip",
              ].join(" ")}
            >
              <span
                className={[
                  "text-[9px] font-bold uppercase tracking-[0.4px] leading-none",
                  isSelected
                    ? "text-[var(--on-teal)]/70"
                    : isTodayDay
                    ? "text-[var(--teal)]"
                    : "text-[var(--muted-col)]",
                ].join(" ")}
              >
                {DAY_NAMES[d.getDay()]}
              </span>
              <span
                className={[
                  "text-[18px] font-bold leading-none",
                  isSelected
                    ? "text-[var(--on-teal)]"
                    : isTodayDay
                    ? "text-[var(--teal-dark)] font-bold"
                    : "text-[var(--ink)]",
                ].join(" ")}
              >
                {d.getDate()}
              </span>
            </button>
          )
        })}
      </div>
    </div>
  )
}
