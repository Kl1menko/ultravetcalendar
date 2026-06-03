"use client"

import { useMemo, useState } from "react"
import { useCalendarContext } from "@/context/calendar"
import { isoDate, minutesFromTime } from "@/lib/utils-app"
import { Appointment } from "@/types"

// ─── періоди ───────────────────────────────────────────────────────────────────

type Period = "day" | "week" | "month" | "year" | "all"

const PERIODS: { value: Period; label: string }[] = [
  { value: "day", label: "День" },
  { value: "week", label: "Тиждень" },
  { value: "month", label: "Місяць" },
  { value: "year", label: "Рік" },
  { value: "all", label: "Весь час" },
]

// Початок діапазону (включно) для заданого періоду відносно сьогодні.
function periodStart(period: Period): Date | null {
  if (period === "all") return null
  const d = new Date()
  d.setHours(0, 0, 0, 0)
  if (period === "day") return d
  if (period === "week") {
    // Понеділок поточного тижня
    const day = (d.getDay() + 6) % 7
    d.setDate(d.getDate() - day)
    return d
  }
  if (period === "month") {
    d.setDate(1)
    return d
  }
  // year
  d.setMonth(0, 1)
  return d
}

function filterByPeriod(appointments: Appointment[], period: Period): Appointment[] {
  const start = periodStart(period)
  if (!start) return appointments
  const startIso = isoDate(start)
  const todayIso = isoDate(new Date())
  return appointments.filter((a) => a.date >= startIso && a.date <= todayIso)
}

// ─── агрегації ───────────────────────────────────────────────────────────────

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
}

function byService(appointments: Appointment[]) {
  const counts: Record<string, { count: number; revenue: number }> = {}
  appointments.forEach((a) => {
    const s = a.service.trim()
    if (!s) return
    if (!counts[s]) counts[s] = { count: 0, revenue: 0 }
    counts[s].count += 1
    counts[s].revenue += a.price || 0
  })
  return Object.entries(counts)
    .map(([name, v]) => ({ name, ...v }))
    .sort((a, b) => b.count - a.count)
}

function byDoctor(appointments: Appointment[]) {
  const counts: Record<string, { count: number; revenue: number }> = {}
  appointments.forEach((a) => {
    const d = a.doctor.trim() || "—"
    if (!counts[d]) counts[d] = { count: 0, revenue: 0 }
    counts[d].count += 1
    counts[d].revenue += a.price || 0
  })
  return Object.entries(counts)
    .map(([name, v]) => ({ name, ...v }))
    .sort((a, b) => b.count - a.count)
}

function shortDoctor(name: string) {
  return name.split(/[\s(]+/)[0] || name
}

function formatMoney(value: number) {
  return `${Math.round(value).toLocaleString("uk-UA")} ₴`
}

// Палітра для барів
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

function Bar({ value, max, label, sublabel, valueText, colorIdx = 0 }: {
  value: number
  max: number
  label: string
  sublabel?: string
  /** Текст усередині бару (напр. "1 200 ₴"); за замовч. — саме value. */
  valueText?: string
  colorIdx?: number
}) {
  const pct = max > 0 ? Math.round((value / max) * 100) : 0
  const color = BAR_COLORS[colorIdx % BAR_COLORS.length]
  const text = String(valueText ?? value)
  // Якщо бар надто вузький, щоб текст гарантовано вмістився — показуємо число
  // поза баром (праворуч), інакше воно обріжеться на overflow-hidden.
  const labelFitsInside = pct >= 22 && text.length <= 12
  return (
    <div className="flex items-center gap-3">
      {label !== "" && (
        <span className="w-8 text-right text-[11px] font-bold text-[var(--muted-col)] shrink-0">{label}</span>
      )}
      <div className="flex min-w-0 flex-1 items-center gap-2">
        <div className="h-7 flex-1 overflow-hidden rounded-lg bg-[var(--paper)]">
          <div
            className="flex h-full items-center rounded-lg px-2 transition-all duration-500"
            style={{
              width: `${Math.max(pct, value > 0 ? 4 : 0)}%`,
              backgroundColor: color.bg,
            }}
          >
            {value > 0 && labelFitsInside && (
              <span className="text-[11px] font-bold leading-none whitespace-nowrap" style={{ color: color.text }}>
                {text}
              </span>
            )}
          </div>
        </div>
        {value > 0 && !labelFitsInside && (
          <span className="shrink-0 whitespace-nowrap text-[11px] font-bold leading-none text-[var(--ink)]">
            {text}
          </span>
        )}
      </div>
      {sublabel && (
        <span className="w-28 text-[11px] text-[var(--muted-col)] shrink-0 truncate">{sublabel}</span>
      )}
    </div>
  )
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="desktop-card-hover overflow-hidden rounded-2xl border border-[var(--line)] bg-white shadow-sm">
      <div className="px-4 py-3 border-b border-[var(--line)]">
        <h2 className="text-[13px] font-bold text-[var(--ink)]">{title}</h2>
      </div>
      <div className="px-4 py-3 flex flex-col gap-2">{children}</div>
    </div>
  )
}

// ─── page ─────────────────────────────────────────────────────────────────────

export default function AnalyticsPage() {
  const { appointments, canSeePrices } = useCalendarContext()
  const [period, setPeriod] = useState<Period>("month")

  const scoped = useMemo(() => filterByPeriod(appointments, period), [appointments, period])

  const total = scoped.length
  const hours = useMemo(() => peakHours(scoped), [scoped])
  const weekdays = useMemo(() => peakWeekdays(scoped), [scoped])
  const services = useMemo(() => byService(scoped), [scoped])
  const doctors = useMemo(() => byDoctor(scoped), [scoped])

  const maxHour = Math.max(...hours.map((h) => h.count), 1)
  const maxDay = Math.max(...weekdays.map((d) => d.count), 1)
  const maxService = services[0]?.count || 1
  const maxDoctor = doctors[0]?.count || 1

  const peakHour = hours.reduce((a, b) => (b.count > a.count ? b : a), hours[0])
  const peakDay = [...weekdays].sort((a, b) => b.count - a.count)[0]
  const totalRevenue = scoped.reduce((sum, a) => sum + (a.price || 0), 0)
  // Середній чек рахуємо лише по записах із ненульовою ціною.
  const paidCount = scoped.filter((a) => (a.price || 0) > 0).length
  const avgCheck = paidCount > 0 ? totalRevenue / paidCount : 0
  const maxServiceRevenue = Math.max(...services.map((s) => s.revenue), 1)
  const maxDoctorRevenue = Math.max(...doctors.map((d) => d.revenue), 1)

  const noData = <p className="text-[13px] text-[var(--muted-col)] py-2">Немає даних</p>

  // Summary-картки: головний лікар бачить фінансові метрики, інші — операційні.
  const summary = canSeePrices
    ? [
        { value: String(total), label: "всього записів" },
        { value: total > 0 ? formatMoney(totalRevenue) : "—", label: "виручка" },
        { value: avgCheck > 0 ? formatMoney(avgCheck) : "—", label: "середній чек" },
        { value: peakHour?.count > 0 ? `${peakHour.hour}:00` : "—", label: "пікова година" },
      ]
    : [
        { value: String(total), label: "всього записів" },
        { value: peakHour?.count > 0 ? `${peakHour.hour}:00` : "—", label: "пікова година" },
        { value: peakDay?.count > 0 ? peakDay.name : "—", label: "піковий день" },
      ]

  return (
    <div className="flex flex-col gap-4 px-3.5 pt-3 pb-6 md:gap-5 md:px-0 md:pt-0">
      <header className="pb-1 md:desktop-page-header md:px-6 md:py-5">
        <h1 className="text-[22px] md:text-[28px] font-black tracking-tight text-[var(--ink)]">
          Аналітика
        </h1>
      </header>

      {/* Перемикач періоду */}
      <div className="flex gap-1.5 overflow-x-auto md:gap-2">
        {PERIODS.map((p) => (
          <button
            key={p.value}
            type="button"
            onClick={() => setPeriod(p.value)}
            className={[
              "h-9 shrink-0 rounded-xl border-[1.5px] px-3.5 text-[13px] font-semibold transition-colors",
              p.value === period
                ? "bg-[var(--teal-light)] border-[var(--teal-mid)] text-[var(--teal-dark)]"
                : "bg-white border-[var(--line)] text-[var(--ink-2)] hover:bg-[var(--paper)]",
            ].join(" ")}
          >
            {p.label}
          </button>
        ))}
      </div>

      {/* Summary */}
      <div className={`grid gap-2 md:gap-4 ${canSeePrices ? "grid-cols-2 md:grid-cols-4" : "grid-cols-3"}`}>
        {summary.map((item) => (
          <div key={item.label} className="desktop-card-hover flex flex-col gap-1 rounded-2xl border border-[var(--line)] bg-white p-3 shadow-sm md:p-5">
            <span className="text-[18px] md:text-[22px] font-black text-[var(--teal)] leading-none">{item.value}</span>
            <span className="text-[10px] font-semibold text-[var(--muted-col)] leading-tight">{item.label}</span>
          </div>
        ))}
      </div>

      <div className="grid gap-4 xl:grid-cols-2">
        {/* По лікарях */}
        <Section title="Записи по лікарях">
          {total === 0 ? noData : doctors.map((d, i) => (
            <Bar key={d.name} label={`${d.count}`} value={d.count} max={maxDoctor} sublabel={shortDoctor(d.name)} colorIdx={i} />
          ))}
        </Section>

        {/* Виручка по лікарях — тільки головний лікар */}
        {canSeePrices && (
          <Section title="Виручка по лікарях">
            {total === 0 ? noData : [...doctors].sort((a, b) => b.revenue - a.revenue).map((d, i) => {
              const avg = d.count > 0 ? d.revenue / d.count : 0
              return (
                <Bar
                  key={d.name}
                  label=""
                  value={Math.round(d.revenue)}
                  valueText={formatMoney(d.revenue)}
                  max={maxDoctorRevenue}
                  sublabel={`${shortDoctor(d.name)} · сер. ${formatMoney(avg)}`}
                  colorIdx={i}
                />
              )
            })}
          </Section>
        )}

        {/* Записи по годинах */}
        <Section title="Записи по годинах">
          {total === 0 ? noData : hours.map((h, i) => (
            <Bar key={h.hour} label={`${h.hour}`} value={h.count} max={maxHour} colorIdx={i} />
          ))}
        </Section>

        {/* Записи по днях тижня */}
        <Section title="Записи по днях тижня">
          {total === 0 ? noData : weekdays.map((d, i) => (
            <Bar key={d.name} label={d.name} value={d.count} max={maxDay} colorIdx={i} />
          ))}
        </Section>

        {/* Популярні послуги (за кількістю записів) */}
        <Section title="Популярні послуги">
          {services.length === 0 ? noData : services.map((s, i) => (
            <Bar
              key={s.name}
              label={`${s.count}`}
              value={s.count}
              max={maxService}
              sublabel={s.name}
              colorIdx={i}
            />
          ))}
        </Section>

        {/* Дохід по послугах — тільки головний лікар */}
        {canSeePrices && (
          <Section title="Дохід по послугах">
            {services.length === 0 || maxServiceRevenue <= 1 ? noData : (
              <>
                {[...services]
                  .filter((s) => s.revenue > 0)
                  .sort((a, b) => b.revenue - a.revenue)
                  .map((s, i) => {
                    const avg = s.count > 0 ? s.revenue / s.count : 0
                    const share = totalRevenue > 0 ? Math.round((s.revenue / totalRevenue) * 100) : 0
                    return (
                      <Bar
                        key={s.name}
                        label=""
                        value={Math.round(s.revenue)}
                        valueText={formatMoney(s.revenue)}
                        max={maxServiceRevenue}
                        sublabel={`${s.name} · ${share}% · сер. ${formatMoney(avg)}`}
                        colorIdx={i}
                      />
                    )
                  })}
                <div className="mt-1 flex items-center justify-between border-t border-[var(--line)] pt-2 text-[12px]">
                  <span className="font-semibold text-[var(--muted-col)]">Разом</span>
                  <span className="font-black text-[var(--ink)]">{formatMoney(totalRevenue)}</span>
                </div>
              </>
            )}
          </Section>
        )}
      </div>
    </div>
  )
}
