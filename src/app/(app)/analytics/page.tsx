"use client"

import { useCalendarContext } from "../layout"
import { minutesFromTime } from "@/lib/utils-app"
import { Appointment } from "@/types"

// ─── helpers ─────────────────────────────────────────────────────────────────

function peakHours(appointments: Appointment[]) {
  const counts: Record<number, number> = {}
  for (let h = 8; h < 20; h++) counts[h] = 0
  appointments.forEach((a) => {
    const h = Math.floor(minutesFromTime(a.start) / 60)
    if (h >= 8 && h < 20) counts[h] = (counts[h] || 0) + 1
  })
  return Object.entries(counts)
    .map(([h, count]) => ({ hour: Number(h), count }))
    .sort((a, b) => a.hour - b.hour)
}

function peakWeekdays(appointments: Appointment[]) {
  const DAYS = ["Нд", "Пн", "Вт", "Ср", "Чт", "Пт", "Сб"]
  const counts: Record<number, number> = { 0: 0, 1: 0, 2: 0, 3: 0, 4: 0, 5: 0, 6: 0 }
  appointments.forEach((a) => {
    const d = new Date(a.date + "T12:00:00").getDay()
    counts[d] = (counts[d] || 0) + 1
  })
  return DAYS.map((name, i) => ({ name, count: counts[i] }))
    .sort((a, b) => b.count - a.count)
}

function topServices(appointments: Appointment[]) {
  const counts: Record<string, number> = {}
  appointments.forEach((a) => {
    const s = a.service.trim().toLowerCase()
    if (!s) return
    const key = s.split(/\s+/)[0]
    counts[key] = (counts[key] || 0) + 1
  })
  return Object.entries(counts)
    .map(([name, count]) => ({ name: name.charAt(0).toUpperCase() + name.slice(1), count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 10)
}

// Палітра для барів — 8 кольорів що чергуються
const BAR_COLORS = [
  { bg: "#0d7377", text: "#ffffff" },
  { bg: "#2563eb", text: "#ffffff" },
  { bg: "#7c3aed", text: "#ffffff" },
  { bg: "#db2777", text: "#ffffff" },
  { bg: "#d97706", text: "#ffffff" },
  { bg: "#16a34a", text: "#ffffff" },
  { bg: "#0891b2", text: "#ffffff" },
  { bg: "#9333ea", text: "#ffffff" },
]

// ─── sub-components ───────────────────────────────────────────────────────────

function Bar({ value, max, label, sublabel, colorIdx = 0 }: {
  value: number
  max: number
  label: string
  sublabel?: string
  colorIdx?: number
}) {
  const pct = max > 0 ? Math.round((value / max) * 100) : 0
  const color = BAR_COLORS[colorIdx % BAR_COLORS.length]
  return (
    <div className="flex items-center gap-3">
      <span className="w-8 text-right text-[11px] font-bold text-[var(--muted-col)] shrink-0">{label}</span>
      <div className="flex-1 h-7 bg-[var(--paper)] rounded-lg overflow-hidden">
        <div
          className="h-full rounded-lg flex items-center px-2 transition-all duration-500"
          style={{
            width: `${Math.max(pct, value > 0 ? 4 : 0)}%`,
            backgroundColor: color.bg,
          }}
        >
          {value > 0 && (
            <span className="text-[11px] font-bold leading-none" style={{ color: color.text }}>{value}</span>
          )}
        </div>
      </div>
      {sublabel && (
        <span className="w-20 text-[11px] text-[var(--muted-col)] shrink-0 truncate">{sublabel}</span>
      )}
    </div>
  )
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="bg-white rounded-2xl border border-[var(--line)] shadow-sm overflow-hidden">
      <div className="px-4 py-3 border-b border-[var(--line)]">
        <h2 className="text-[13px] font-bold text-[var(--ink)]">{title}</h2>
      </div>
      <div className="px-4 py-3 flex flex-col gap-2">{children}</div>
    </div>
  )
}

// ─── page ─────────────────────────────────────────────────────────────────────

export default function AnalyticsPage() {
  const { appointments } = useCalendarContext()

  const total = appointments.length
  const hours = peakHours(appointments)
  const weekdays = peakWeekdays(appointments)
  const services = topServices(appointments)

  const maxHour = Math.max(...hours.map((h) => h.count), 1)
  const maxDay = Math.max(...weekdays.map((d) => d.count), 1)
  const maxService = services[0]?.count || 1

  const peakHour = hours.reduce((a, b) => (b.count > a.count ? b : a), hours[0])
  const peakDay = [...weekdays].sort((a, b) => b.count - a.count)[0]

  const noData = <p className="text-[13px] text-[var(--muted-col)] py-2">Немає даних</p>

  return (
    <div className="px-3.5 pt-3 pb-6 md:px-0 md:pt-0 flex flex-col gap-4">
      <header className="pb-1 md:pb-4">
        <h1 className="text-[22px] md:text-[28px] font-black tracking-tight text-[var(--ink)]">
          Аналітика
        </h1>
      </header>

      {/* Summary */}
      <div className="grid grid-cols-3 gap-2">
        {[
          { value: String(total), label: "всього записів" },
          { value: peakHour?.count > 0 ? `${peakHour.hour}:00` : "—", label: "пікова година" },
          { value: peakDay?.count > 0 ? peakDay.name : "—", label: "піковий день" },
        ].map((item) => (
          <div key={item.label} className="bg-white rounded-2xl border border-[var(--line)] shadow-sm p-3 flex flex-col gap-1">
            <span className="text-[22px] font-black text-[var(--teal)] leading-none">{item.value}</span>
            <span className="text-[10px] font-semibold text-[var(--muted-col)] leading-tight">{item.label}</span>
          </div>
        ))}
      </div>

      {/* Peak hours */}
      <Section title="Записи по годинах">
        {total === 0 ? noData : hours.map((h, i) => (
          <Bar key={h.hour} label={`${h.hour}`} value={h.count} max={maxHour} colorIdx={i} />
        ))}
      </Section>

      {/* Peak weekdays — sorted by count desc */}
      <Section title="Записи по днях тижня">
        {total === 0 ? noData : weekdays.map((d, i) => (
          <Bar key={d.name} label={d.name} value={d.count} max={maxDay} colorIdx={i} />
        ))}
      </Section>

      {/* Top services — normalized to lowercase then capitalized */}
      <Section title="Популярні послуги">
        {services.length === 0 ? noData : services.map((s, i) => (
          <Bar key={s.name} label={`${s.count}`} value={s.count} max={maxService} sublabel={s.name} colorIdx={i} />
        ))}
      </Section>
    </div>
  )
}
