"use client"

import { useMemo, useState } from "react"
import { useCalendarContext } from "@/context/calendar"
import { isoDate, minutesFromTime } from "@/lib/utils-app"
import { appointmentsToCsv, downloadCsv } from "@/lib/export-csv"
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

// Попередній період такої самої довжини, що й поточний (для порівняння ±%).
// Поточний період = [periodStart .. сьогодні]; попередній = такий самий відрізок,
// зсунутий назад так, щоб закінчуватися за день до початку поточного.
// Для "all" порівняння немає (повертаємо null).
function filterByPreviousPeriod(appointments: Appointment[], period: Period): Appointment[] | null {
  const start = periodStart(period)
  if (!start) return null
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  // Довжина поточного відрізка у днях (включно).
  const spanDays = Math.round((today.getTime() - start.getTime()) / 86_400_000) + 1
  const prevEnd = new Date(start)
  prevEnd.setDate(prevEnd.getDate() - 1)
  const prevStart = new Date(prevEnd)
  prevStart.setDate(prevStart.getDate() - (spanDays - 1))
  const prevStartIso = isoDate(prevStart)
  const prevEndIso = isoDate(prevEnd)
  return appointments.filter((a) => a.date >= prevStartIso && a.date <= prevEndIso)
}

// Зміна у відсотках поточного значення відносно попереднього.
// null — якщо порівняти ні з чим (немає попереднього періоду або база = 0).
function pctChange(current: number, previous: number): number | null {
  if (previous === 0) return current === 0 ? 0 : null
  return Math.round(((current - previous) / previous) * 100)
}

// Суфікс гранулярності для заголовка тренду — узгоджений із revenueTrend().
function trendUnitLabel(period: Period): string {
  if (period === "day") return " по годинах"
  if (period === "year" || period === "all") return " по місяцях"
  return " по днях"
}

// Підпис для рядка порівняння під KPI-картками.
function periodComparisonLabel(period: Period): string {
  switch (period) {
    case "day": return "день"
    case "week": return "тиждень"
    case "month": return "місяць"
    case "year": return "рік"
    default: return "період"
  }
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

// Тренд виручки в межах періоду. Гранулярність залежить від періоду:
//   day            → по годинах доби
//   week / month   → по днях (ISO-дата)
//   year / all     → по місяцях (YYYY-MM)
// Повертає впорядкований масив бакетів із короткою міткою для осі.
function revenueTrend(
  appointments: Appointment[],
  period: Period
): { key: string; label: string; revenue: number }[] {
  const granularity: "hour" | "day" | "month" =
    period === "day" ? "hour" : period === "year" || period === "all" ? "month" : "day"

  const buckets = new Map<string, { label: string; revenue: number }>()

  appointments.forEach((a) => {
    const revenue = a.price || 0
    let key: string
    let label: string
    if (granularity === "hour") {
      const h = Math.floor(minutesFromTime(a.start) / 60)
      key = String(h).padStart(2, "0")
      label = `${h}`
    } else if (granularity === "month") {
      key = a.date.slice(0, 7) // YYYY-MM
      label = key.slice(5) // MM
    } else {
      key = a.date // YYYY-MM-DD
      label = a.date.slice(8) // DD
    }
    const prev = buckets.get(key)
    if (prev) prev.revenue += revenue
    else buckets.set(key, { label, revenue })
  })

  return [...buckets.entries()]
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([key, v]) => ({ key, ...v }))
}

// Робоче вікно для розрахунку завантаженості (узгоджено з WeekStrip).
const WORK_START_MIN = 10 * 60 // 10:00
const WORK_END_MIN = 18 * 60 // 18:00
const WORK_DAY_MIN = WORK_END_MIN - WORK_START_MIN // 480 хв

// Зайняті хвилини в робочому вікні для конкретного дня (обрізаємо за межами 10–18).
function bookedMinutesForDay(dayAppts: Appointment[]): number {
  return dayAppts.reduce((sum, a) => {
    const start = Math.max(minutesFromTime(a.start), WORK_START_MIN)
    const end = Math.min(minutesFromTime(a.end), WORK_END_MIN)
    return sum + Math.max(0, end - start)
  }, 0)
}

// Завантаженість клініки за період: середній % зайнятості робочих слотів по днях,
// де реально були записи, + середня зайнятість у розрізі днів тижня.
function clinicUtilization(appointments: Appointment[]) {
  // Групуємо за датою.
  const byDate = new Map<string, Appointment[]>()
  appointments.forEach((a) => {
    const arr = byDate.get(a.date)
    if (arr) arr.push(a)
    else byDate.set(a.date, [a])
  })

  const dayPcts: { date: string; pct: number }[] = []
  byDate.forEach((appts, date) => {
    const pct = Math.min(100, Math.round((bookedMinutesForDay(appts) / WORK_DAY_MIN) * 100))
    dayPcts.push({ date, pct })
  })

  const avgPct = dayPcts.length
    ? Math.round(dayPcts.reduce((s, d) => s + d.pct, 0) / dayPcts.length)
    : 0

  // Середня зайнятість по днях тижня (лише дні, де були записи — щоб не «розмивати» нулями).
  const DAYS = ["Нд", "Пн", "Вт", "Ср", "Чт", "Пт", "Сб"]
  const weekdayAgg: Record<number, { sum: number; n: number }> = {}
  dayPcts.forEach(({ date, pct }) => {
    const wd = new Date(date + "T12:00:00").getDay()
    if (!weekdayAgg[wd]) weekdayAgg[wd] = { sum: 0, n: 0 }
    weekdayAgg[wd].sum += pct
    weekdayAgg[wd].n += 1
  })
  const byWeekday = DAYS.map((name, i) => ({
    name,
    pct: weekdayAgg[i]?.n ? Math.round(weekdayAgg[i].sum / weekdayAgg[i].n) : 0,
    hasData: Boolean(weekdayAgg[i]?.n),
  }))

  const withData = byWeekday.filter((d) => d.hasData)
  const busiest = withData.length ? [...withData].sort((a, b) => b.pct - a.pct)[0] : null
  const quietest = withData.length ? [...withData].sort((a, b) => a.pct - b.pct)[0] : null

  return { avgPct, byWeekday, busiest, quietest, daysTracked: dayPcts.length }
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

// Бейдж зміни ±% до попереднього періоду. Ріст — зелений, спад — червоний,
// 0% — нейтральний. null — нічого не рендеримо (немає порівняння).
function Delta({ value }: { value: number | null }) {
  if (value === null) return null
  const isUp = value > 0
  const isFlat = value === 0
  const color = isFlat
    ? "text-[var(--muted-col)] bg-[var(--paper)]"
    : isUp
      ? "text-green-700 bg-green-50"
      : "text-red-600 bg-red-50"
  const arrow = isFlat ? "→" : isUp ? "↑" : "↓"
  return (
    <span className={`inline-flex items-center gap-0.5 rounded-md px-1.5 py-0.5 text-[10px] font-bold leading-none ${color}`}>
      {arrow} {Math.abs(value)}%
    </span>
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
  const prevScoped = useMemo(
    () => filterByPreviousPeriod(appointments, period),
    [appointments, period]
  )

  const total = scoped.length
  const hours = useMemo(() => peakHours(scoped), [scoped])
  const weekdays = useMemo(() => peakWeekdays(scoped), [scoped])
  const services = useMemo(() => byService(scoped), [scoped])
  const doctors = useMemo(() => byDoctor(scoped), [scoped])
  const trend = useMemo(() => revenueTrend(scoped, period), [scoped, period])
  const maxTrend = Math.max(...trend.map((t) => t.revenue), 1)
  const utilization = useMemo(() => clinicUtilization(scoped), [scoped])

  const maxHour = Math.max(...hours.map((h) => h.count), 1)
  const maxDay = Math.max(...weekdays.map((d) => d.count), 1)
  const maxService = services[0]?.count || 1
  const maxDoctor = doctors[0]?.count || 1

  const peakHour = hours.reduce((a, b) => (b.count > a.count ? b : a), hours[0])
  const totalRevenue = scoped.reduce((sum, a) => sum + (a.price || 0), 0)
  // Середній чек рахуємо лише по записах із ненульовою ціною.
  const paidCount = scoped.filter((a) => (a.price || 0) > 0).length
  const avgCheck = paidCount > 0 ? totalRevenue / paidCount : 0
  const maxServiceRevenue = Math.max(...services.map((s) => s.revenue), 1)
  const maxDoctorRevenue = Math.max(...doctors.map((d) => d.revenue), 1)

  // ─── Дельти до попереднього періоду (±%) ──────────────────────────────────
  // prevScoped === null для "Весь час" — порівнювати немає з чим.
  const prevTotal = prevScoped?.length ?? 0
  const prevRevenue = prevScoped?.reduce((sum, a) => sum + (a.price || 0), 0) ?? 0
  const prevPaidCount = prevScoped?.filter((a) => (a.price || 0) > 0).length ?? 0
  const prevAvgCheck = prevPaidCount > 0 ? prevRevenue / prevPaidCount : 0
  const hasComparison = prevScoped !== null
  const deltaTotal = hasComparison ? pctChange(total, prevTotal) : null
  const deltaRevenue = hasComparison ? pctChange(totalRevenue, prevRevenue) : null
  const deltaAvgCheck = hasComparison ? pctChange(avgCheck, prevAvgCheck) : null

  const handleExport = () => {
    const today = isoDate(new Date())
    const periodKey = period === "all" ? "all" : period
    downloadCsv(`appointments_${periodKey}_${today}.csv`, appointmentsToCsv(scoped))
  }

  const noData = <p className="text-[13px] text-[var(--muted-col)] py-2">Немає даних</p>

  // Аналітика — лише для головного лікаря. Захищаємо і прямий перехід за URL,
  // не лише ховання вкладки в навігації. Guard після всіх хуків (правила React).
  if (!canSeePrices) {
    return (
      <div className="px-4 pt-4 md:px-0 md:pt-0">
        <header className="pb-4 md:desktop-page-header md:px-6 md:py-5">
          <h1 className="text-[22px] font-black text-[var(--ink)] md:text-[28px]">Аналітика</h1>
        </header>
        <div className="mx-auto mt-6 max-w-md rounded-2xl border border-dashed border-[var(--line)] bg-white/70 px-5 py-8 text-center">
          <p className="text-[15px] font-bold text-[var(--ink)]">Доступ обмежено</p>
          <p className="mt-1.5 text-[13px] text-[var(--muted-col)]">
            Аналітика доступна лише головному лікарю.
          </p>
        </div>
      </div>
    )
  }

  // Summary-картки головного лікаря. delta — зміна ±% до попереднього періоду
  // такої самої довжини (null = немає з чим порівнювати, напр. "Весь час").
  // higherIsBetter керує кольором стрілки (для всіх цих метрик ріст = добре).
  const summary: { value: string; label: string; delta: number | null }[] = [
    { value: String(total), label: "всього записів", delta: deltaTotal },
    { value: total > 0 ? formatMoney(totalRevenue) : "—", label: "виручка", delta: deltaRevenue },
    { value: avgCheck > 0 ? formatMoney(avgCheck) : "—", label: "середній чек", delta: deltaAvgCheck },
    { value: peakHour?.count > 0 ? `${peakHour.hour}:00` : "—", label: "пікова година", delta: null },
  ]

  return (
    <div className="flex flex-col gap-4 px-3.5 pt-3 pb-6 md:gap-5 md:px-0 md:pt-0">
      <header className="flex items-center justify-between gap-3 pb-1 md:desktop-page-header md:px-6 md:py-5">
        <h1 className="text-[22px] md:text-[28px] font-black tracking-tight text-[var(--ink)]">
          Аналітика
        </h1>
        <button
          type="button"
          onClick={handleExport}
          disabled={total === 0}
          className="flex h-9 shrink-0 items-center gap-1.5 rounded-xl border border-[var(--line)] bg-white px-3 text-[12px] font-semibold text-[var(--ink-2)] shadow-sm transition-colors hover:border-[var(--teal-mid)] hover:text-[var(--ink)] disabled:opacity-50 md:h-10 md:rounded-2xl md:px-4 md:text-[13px]"
        >
          <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M7 10l5 5 5-5M12 15V3" />
          </svg>
          Експорт CSV
        </button>
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
      <div className="grid grid-cols-2 gap-2 md:grid-cols-4 md:gap-4">
        {summary.map((item) => (
          <div key={item.label} className="desktop-card-hover flex flex-col gap-1 rounded-2xl border border-[var(--line)] bg-white p-3 shadow-sm md:p-5">
            <div className="flex items-baseline gap-1.5">
              <span className="text-[18px] md:text-[22px] font-black text-[var(--teal)] leading-none">{item.value}</span>
              <Delta value={item.delta} />
            </div>
            <span className="text-[10px] font-semibold text-[var(--muted-col)] leading-tight">{item.label}</span>
          </div>
        ))}
      </div>
      {hasComparison && (
        <p className="-mt-2 text-[11px] text-[var(--muted-col)]">
          ↑↓ — зміна проти попереднього {periodComparisonLabel(period)} такої ж тривалості
        </p>
      )}

      {/* Тренд виручки — на всю ширину */}
      <Section title={`Тренд виручки${trendUnitLabel(period)}`}>
        {total === 0 || totalRevenue === 0 ? noData : (
          <div className="flex flex-col gap-1.5">
            {trend.map((t) => (
              <Bar
                key={t.key}
                label={t.label}
                value={Math.round(t.revenue)}
                valueText={formatMoney(t.revenue)}
                max={maxTrend}
                colorIdx={0}
              />
            ))}
          </div>
        )}
      </Section>

      <div className="grid gap-4 xl:grid-cols-2">
        {/* Завантаженість клініки */}
        <Section title="Завантаженість клініки">
          {total === 0 ? noData : (
            <>
              <div className="mb-1 flex items-baseline justify-between">
                <span className="text-[28px] font-black leading-none text-[var(--teal)]">{utilization.avgPct}%</span>
                <span className="text-[11px] text-[var(--muted-col)]">
                  середня зайнятість · {utilization.daysTracked} {utilization.daysTracked === 1 ? "день" : "дн."}
                </span>
              </div>
              {utilization.busiest && utilization.quietest && (
                <p className="mb-2 text-[11px] text-[var(--muted-col)]">
                  Найзавантаженіший: <strong className="text-[var(--ink)]">{utilization.busiest.name} ({utilization.busiest.pct}%)</strong>
                  {" · "}найвільніший: <strong className="text-[var(--ink)]">{utilization.quietest.name} ({utilization.quietest.pct}%)</strong>
                </p>
              )}
              {utilization.byWeekday.map((d, i) => (
                <Bar key={d.name} label={d.name} value={d.pct} max={100} valueText={`${d.pct}%`} colorIdx={i} />
              ))}
              <p className="mt-1 text-[10px] text-[var(--muted-col)]">Робоче вікно 10:00–18:00</p>
            </>
          )}
        </Section>

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
