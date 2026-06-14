"use client"

import { useMemo, useState } from "react"
import { useCalendarContext } from "@/context/calendar"
import { isoDate, minutesFromTime } from "@/lib/utils-app"
import { appointmentsToCsv, downloadCsv } from "@/lib/export-csv"
import { buildAppointmentsBackup, downloadJson } from "@/lib/backup"
import { HOUR_START, HOUR_END } from "@/lib/constants"
import { parseServices } from "@/lib/services"
import { Appointment } from "@/types"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import {
  Table,
  TableBody,
  TableCell,
  TableFooter,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"

// ─── періоди ───────────────────────────────────────────────────────────────────

type Period = "day" | "week" | "month" | "year" | "all"

const PERIODS: { value: Period; label: string }[] = [
  { value: "day", label: "День" },
  { value: "week", label: "Тиждень" },
  { value: "month", label: "Місяць" },
  { value: "year", label: "Рік" },
  { value: "all", label: "Весь час" },
]

// Повний календарний діапазон [start..end] (включно) для періоду відносно
// сьогодні. Включає майбутні записи в межах періоду (це планувальник).
// "all" → null (без обмежень).
function periodRange(period: Period): { start: Date; end: Date } | null {
  if (period === "all") return null
  const start = new Date()
  start.setHours(0, 0, 0, 0)
  const end = new Date(start)

  if (period === "day") {
    return { start, end }
  }
  if (period === "week") {
    const day = (start.getDay() + 6) % 7 // 0 = понеділок
    start.setDate(start.getDate() - day)
    end.setTime(start.getTime())
    end.setDate(start.getDate() + 6)
    return { start, end }
  }
  if (period === "month") {
    start.setDate(1)
    end.setMonth(start.getMonth() + 1, 0) // останній день місяця
    return { start, end }
  }
  // year
  start.setMonth(0, 1)
  end.setMonth(11, 31)
  end.setFullYear(start.getFullYear())
  return { start, end }
}

function filterByPeriod(appointments: Appointment[], period: Period): Appointment[] {
  const range = periodRange(period)
  if (!range) return appointments
  const startIso = isoDate(range.start)
  const endIso = isoDate(range.end)
  return appointments.filter((a) => a.date >= startIso && a.date <= endIso)
}

// Попередній період такої самої довжини, що й поточний (для порівняння ±%).
// Зсунутий назад так, щоб закінчуватися за день до початку поточного.
// Для "all" порівняння немає (повертаємо null).
function filterByPreviousPeriod(appointments: Appointment[], period: Period): Appointment[] | null {
  const range = periodRange(period)
  if (!range) return null
  // Довжина поточного діапазону у днях (включно).
  const spanDays = Math.round((range.end.getTime() - range.start.getTime()) / 86_400_000) + 1
  const prevEnd = new Date(range.start)
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

// Скорочені назви днів тижня, індекс = Date.getDay() (0 = Нд).
const WEEKDAY_SHORT = ["Нд", "Пн", "Вт", "Ср", "Чт", "Пт", "Сб"]

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
  const counts: Record<number, number> = { 0: 0, 1: 0, 2: 0, 3: 0, 4: 0, 5: 0, 6: 0 }
  appointments.forEach((a) => {
    const d = new Date(a.date + "T12:00:00").getDay()
    counts[d] = (counts[d] || 0) + 1
  })
  return WEEKDAY_SHORT.map((name, i) => ({ name, count: counts[i] }))
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
      // Скорочений день тижня + число, напр. "Пн 02" — щоб було видно який це день.
      const wd = WEEKDAY_SHORT[new Date(a.date + "T12:00:00").getDay()]
      label = `${wd} ${a.date.slice(8)}`
    }
    const prev = buckets.get(key)
    if (prev) prev.revenue += revenue
    else buckets.set(key, { label, revenue })
  })

  return [...buckets.entries()]
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([key, v]) => ({ key, ...v }))
}

// Робоче вікно для розрахунку завантаженості — ті самі години, що й сітка
// календаря та WeekStrip (HOUR_START–HOUR_END), щоб % був консистентним усюди.
const WORK_START_MIN = HOUR_START * 60
const WORK_END_MIN = HOUR_END * 60
const WORK_DAY_MIN = WORK_END_MIN - WORK_START_MIN

// Зайняті хвилини в робочому вікні для конкретного дня (обрізаємо за межами 10–18).
function bookedMinutesForDay(dayAppts: Appointment[]): number {
  return dayAppts.reduce((sum, a) => {
    const start = Math.max(minutesFromTime(a.start), WORK_START_MIN)
    const end = Math.min(minutesFromTime(a.end), WORK_END_MIN)
    return sum + Math.max(0, end - start)
  }, 0)
}

// % зайнятості по кожному дню, де реально були записи (для усереднення).
function dayUtilizationPcts(appointments: Appointment[]): { date: string; pct: number }[] {
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
  return dayPcts
}

// Середня завантаженість по днях, де були записи (0 — якщо записів немає).
function averageUtilization(appointments: Appointment[]): number {
  const dayPcts = dayUtilizationPcts(appointments)
  return dayPcts.length
    ? Math.round(dayPcts.reduce((s, d) => s + d.pct, 0) / dayPcts.length)
    : 0
}

// Завантаженість клініки за період: середній % зайнятості робочих слотів по днях,
// де реально були записи, + середня зайнятість у розрізі днів тижня.
function clinicUtilization(appointments: Appointment[]) {
  const dayPcts = dayUtilizationPcts(appointments)
  const avgPct = dayPcts.length
    ? Math.round(dayPcts.reduce((s, d) => s + d.pct, 0) / dayPcts.length)
    : 0

  // Середня зайнятість по днях тижня (лише дні, де були записи — щоб не «розмивати» нулями).
  const weekdayAgg: Record<number, { sum: number; n: number }> = {}
  dayPcts.forEach(({ date, pct }) => {
    const wd = new Date(date + "T12:00:00").getDay()
    if (!weekdayAgg[wd]) weekdayAgg[wd] = { sum: 0, n: 0 }
    weekdayAgg[wd].sum += pct
    weekdayAgg[wd].n += 1
  })
  const byWeekday = WEEKDAY_SHORT.map((name, i) => ({
    name,
    pct: weekdayAgg[i]?.n ? Math.round(weekdayAgg[i].sum / weekdayAgg[i].n) : 0,
    hasData: Boolean(weekdayAgg[i]?.n),
  }))

  const withData = byWeekday.filter((d) => d.hasData)
  const busiest = withData.length ? [...withData].sort((a, b) => b.pct - a.pct)[0] : null
  const quietest = withData.length ? [...withData].sort((a, b) => a.pct - b.pct)[0] : null

  return { avgPct, byWeekday, busiest, quietest, daysTracked: dayPcts.length }
}

// Один запис може містити кілька послуг (поле service через роздільник).
// Рахуємо кожну послугу окремо. Ціна запису — одна на всі послуги, тож
// розподіляємо її порівну між ними, щоб сума по послугах = загальній виручці.
function byService(appointments: Appointment[]) {
  const counts: Record<string, { count: number; revenue: number }> = {}
  appointments.forEach((a) => {
    const services = parseServices(a.service)
    if (services.length === 0) return
    const revenuePerService = (a.price || 0) / services.length
    services.forEach((s) => {
      if (!counts[s]) counts[s] = { count: 0, revenue: 0 }
      counts[s].count += 1
      counts[s].revenue += revenuePerService
    })
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

// Порівняльна статистика по лікарях: записи, виручка, сер. чек, завантаженість.
// Сортуємо за виручкою (спадання) — найрезультативніший зверху.
type DoctorStat = {
  name: string
  count: number
  revenue: number
  avgCheck: number
  utilization: number
}

function buildDoctorStats(appointments: Appointment[]): DoctorStat[] {
  const byDoc = new Map<string, Appointment[]>()
  appointments.forEach((a) => {
    const d = a.doctor.trim() || "—"
    const arr = byDoc.get(d)
    if (arr) arr.push(a)
    else byDoc.set(d, [a])
  })

  const stats: DoctorStat[] = []
  byDoc.forEach((appts, name) => {
    const count = appts.length
    const revenue = appts.reduce((s, a) => s + (a.price || 0), 0)
    const paid = appts.filter((a) => (a.price || 0) > 0).length
    stats.push({
      name,
      count,
      revenue,
      avgCheck: paid > 0 ? revenue / paid : 0,
      utilization: averageUtilization(appts),
    })
  })

  return stats.sort((a, b) => b.revenue - a.revenue || b.count - a.count)
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
    <div className="flex items-center gap-3 md:gap-3.5">
      {label !== "" && (
        <span className="w-8 text-right text-[11px] font-bold text-[var(--muted-col)] shrink-0 md:w-10 md:text-[13px]">{label}</span>
      )}
      <div className="flex min-w-0 flex-1 items-center gap-2">
        <div className="h-7 flex-1 overflow-hidden rounded-lg bg-[var(--paper)] md:h-8">
          <div
            className="flex h-full items-center rounded-lg px-2 transition-all duration-500 md:px-2.5"
            style={{
              width: `${Math.max(pct, value > 0 ? 4 : 0)}%`,
              backgroundColor: color.bg,
            }}
          >
            {value > 0 && labelFitsInside && (
              <span className="text-[11px] font-bold leading-none whitespace-nowrap md:text-[13px]" style={{ color: color.text }}>
                {text}
              </span>
            )}
          </div>
        </div>
        {value > 0 && !labelFitsInside && (
          <span className="shrink-0 whitespace-nowrap text-[11px] font-bold leading-none text-[var(--ink)] md:text-[13px]">
            {text}
          </span>
        )}
      </div>
      {sublabel && (
        <span className="w-28 text-[11px] text-[var(--muted-col)] shrink-0 truncate md:w-40 md:text-[13px]">{sublabel}</span>
      )}
    </div>
  )
}

// Рядок доходу по послузі: назва + сума на одному рядку (сума — акцент справа),
// під ними бар на повну ширину, ще нижче — частка % і середній чек.
// На відміну від Bar, назва не обрізається (вона над баром, не в вузькій колонці).
function RevenueRow({ name, revenue, share, avg, max, colorIdx }: {
  name: string
  revenue: number
  share: number
  avg: number
  max: number
  colorIdx: number
}) {
  const pct = max > 0 ? Math.round((revenue / max) * 100) : 0
  const color = BAR_COLORS[colorIdx % BAR_COLORS.length]
  return (
    <div className="flex flex-col gap-1 md:gap-1.5">
      <div className="flex items-baseline justify-between gap-2">
        <span className="min-w-0 truncate text-[13px] font-semibold text-[var(--ink)] md:text-[14px]">{name}</span>
        <span className="shrink-0 text-[13px] font-black text-[var(--ink)] md:text-[15px]">{formatMoney(revenue)}</span>
      </div>
      <div className="h-2 overflow-hidden rounded-full bg-[var(--paper)] md:h-2.5">
        <div
          className="h-full rounded-full transition-all duration-500"
          style={{ width: `${Math.max(pct, revenue > 0 ? 4 : 0)}%`, backgroundColor: color.bg }}
        />
      </div>
      <span className="text-[11px] text-[var(--muted-col)] md:text-[12px]">
        {share}% доходу · сер. чек {formatMoney(avg)}
      </span>
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
    <Badge className={`gap-0.5 rounded-md px-1.5 text-[10px] font-bold ${color}`}>
      {arrow} {Math.abs(value)}%
    </Badge>
  )
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <Card className="desktop-card-hover gap-0 rounded-2xl border border-[var(--line)] bg-white py-0 shadow-sm ring-0">
      <CardHeader className="border-b border-[var(--line)] px-4 py-3 md:px-5 md:py-4">
        <CardTitle className="text-[13px] font-bold text-[var(--ink)] md:text-[15px]">{title}</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-2 px-4 py-3 md:gap-2.5 md:px-5 md:py-4">{children}</CardContent>
    </Card>
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
  const doctorStats = useMemo(() => buildDoctorStats(scoped), [scoped])
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

  // Повний бекап усіх записів (не лише за період) у JSON — повний зліпок для
  // відновлення. Суми включаємо лише якщо їх видно поточному користувачу.
  const handleBackup = () => {
    const today = isoDate(new Date())
    const backup = buildAppointmentsBackup(appointments, canSeePrices)
    downloadJson(`backup_appointments_${today}.json`, backup)
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
        <div className="flex shrink-0 items-center gap-2">
          <Button
            variant="outline"
            onClick={handleBackup}
            disabled={appointments.length === 0}
            title="Повний бекап усіх записів у JSON"
            className="h-9 shrink-0 gap-1.5 rounded-xl border-[var(--line)] bg-white px-3 text-[12px] font-semibold text-[var(--ink-2)] shadow-sm hover:border-[var(--teal-mid)] hover:bg-white hover:text-[var(--ink)] md:h-10 md:rounded-2xl md:px-4 md:text-[13px]"
          >
            <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
              <ellipse cx="12" cy="5" rx="9" ry="3" />
              <path d="M3 5v14a9 3 0 0 0 18 0V5" />
              <path d="M3 12a9 3 0 0 0 18 0" />
            </svg>
            <span className="hidden sm:inline">Бекап</span>
            <span className="sm:hidden">JSON</span>
          </Button>
          <Button
            variant="outline"
            onClick={handleExport}
            disabled={total === 0}
            className="h-9 shrink-0 gap-1.5 rounded-xl border-[var(--line)] bg-white px-3 text-[12px] font-semibold text-[var(--ink-2)] shadow-sm hover:border-[var(--teal-mid)] hover:bg-white hover:text-[var(--ink)] md:h-10 md:rounded-2xl md:px-4 md:text-[13px]"
          >
            <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M7 10l5 5 5-5M12 15V3" />
            </svg>
            CSV
          </Button>
        </div>
      </header>

      {/* Перемикач періоду */}
      <div className="flex gap-1.5 overflow-x-auto md:gap-2 md:overflow-x-visible">
        {PERIODS.map((p) => (
          <Button
            key={p.value}
            variant="outline"
            onClick={() => setPeriod(p.value)}
            className={[
              "h-9 shrink-0 rounded-xl border-[1.5px] px-3.5 text-[13px] font-semibold md:h-10 md:px-5 md:text-[14px]",
              p.value === period
                ? "border-[var(--teal-mid)] bg-[var(--teal-light)] text-[var(--teal-dark)] hover:bg-[var(--teal-light)] hover:text-[var(--teal-dark)]"
                : "border-[var(--line)] bg-white text-[var(--ink-2)] hover:bg-[var(--paper)]",
            ].join(" ")}
          >
            {p.label}
          </Button>
        ))}
      </div>

      {/* Summary */}
      <div className="grid grid-cols-2 gap-2 md:grid-cols-4 md:gap-4">
        {summary.map((item) => (
          <Card key={item.label} className="desktop-card-hover gap-1 rounded-2xl border border-[var(--line)] bg-white p-3 shadow-sm ring-0 md:gap-1.5 md:p-5">
            <div className="flex items-baseline gap-1.5">
              <span className="text-[18px] md:text-[26px] font-black text-[var(--teal)] leading-none">{item.value}</span>
              <Delta value={item.delta} />
            </div>
            <span className="text-[10px] font-semibold text-[var(--muted-col)] leading-tight md:text-[12px]">{item.label}</span>
          </Card>
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

      {/* Порівняння лікарів — зведена таблиця по всій лікарні (тільки head) */}
      {canSeePrices && (
        <Section title="Лікарі — порівняння">
          {doctorStats.length === 0 ? noData : (
            <Table className="min-w-[460px] text-[13px]">
              <TableHeader>
                <TableRow className="border-b border-[var(--line)] text-[11px] uppercase tracking-[0.4px] text-[var(--muted-col)] hover:bg-transparent">
                  <TableHead className="h-auto px-2 py-2 font-bold text-[var(--muted-col)]">Лікар</TableHead>
                  <TableHead className="h-auto px-2 py-2 text-right font-bold text-[var(--muted-col)]">Записи</TableHead>
                  <TableHead className="h-auto px-2 py-2 text-right font-bold text-[var(--muted-col)]">Виручка</TableHead>
                  <TableHead className="h-auto px-2 py-2 text-right font-bold text-[var(--muted-col)]">Сер. чек</TableHead>
                  <TableHead className="h-auto px-2 py-2 text-right font-bold text-[var(--muted-col)]">Завантаж.</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {doctorStats.map((d) => (
                  <TableRow key={d.name} className="border-b border-[var(--line)] hover:bg-transparent">
                    <TableCell className="px-2 py-2.5 font-semibold text-[var(--ink)]">{shortDoctor(d.name)}</TableCell>
                    <TableCell className="px-2 py-2.5 text-right tabular-nums text-[var(--ink-2)]">{d.count}</TableCell>
                    <TableCell className="px-2 py-2.5 text-right tabular-nums font-bold text-[var(--ink)]">
                      {d.revenue > 0 ? formatMoney(d.revenue) : "—"}
                    </TableCell>
                    <TableCell className="px-2 py-2.5 text-right tabular-nums text-[var(--ink-2)]">
                      {d.avgCheck > 0 ? formatMoney(d.avgCheck) : "—"}
                    </TableCell>
                    <TableCell className="px-2 py-2.5 text-right tabular-nums text-[var(--ink-2)]">{d.utilization}%</TableCell>
                  </TableRow>
                ))}
              </TableBody>
              <TableFooter className="bg-transparent">
                <TableRow className="border-t-2 border-[var(--teal-mid)] text-[var(--teal-dark)] hover:bg-transparent">
                  <TableCell className="px-2 py-2.5 font-black">Разом</TableCell>
                  <TableCell className="px-2 py-2.5 text-right tabular-nums font-black">{total}</TableCell>
                  <TableCell className="px-2 py-2.5 text-right tabular-nums font-black">{formatMoney(totalRevenue)}</TableCell>
                  <TableCell className="px-2 py-2.5 text-right tabular-nums font-black">{avgCheck > 0 ? formatMoney(avgCheck) : "—"}</TableCell>
                  <TableCell className="px-2 py-2.5 text-right tabular-nums font-black">{utilization.avgPct}%</TableCell>
                </TableRow>
              </TableFooter>
            </Table>
          )}
        </Section>
      )}

      <div className="grid gap-4 md:gap-5 lg:grid-cols-2 2xl:grid-cols-3">
        {/* Завантаженість клініки */}
        <Section title="Завантаженість клініки">
          {total === 0 ? noData : (
            <>
              <div className="mb-1 flex items-baseline justify-between">
                <span className="text-[28px] font-black leading-none text-[var(--teal)] md:text-[34px]">{utilization.avgPct}%</span>
                <span className="text-[11px] text-[var(--muted-col)] md:text-[12px]">
                  середня зайнятість · {utilization.daysTracked} {utilization.daysTracked === 1 ? "день" : "дн."}
                </span>
              </div>
              {utilization.busiest && utilization.quietest && (
                <p className="mb-2 text-[11px] text-[var(--muted-col)] md:text-[12px]">
                  Найзавантаженіший: <strong className="text-[var(--ink)]">{utilization.busiest.name} ({utilization.busiest.pct}%)</strong>
                  {" · "}найвільніший: <strong className="text-[var(--ink)]">{utilization.quietest.name} ({utilization.quietest.pct}%)</strong>
                </p>
              )}
              {utilization.byWeekday.map((d, i) => (
                <Bar key={d.name} label={d.name} value={d.pct} max={100} valueText={`${d.pct}%`} colorIdx={i} />
              ))}
              <p className="mt-1 text-[10px] text-[var(--muted-col)]">
                Робоче вікно {String(HOUR_START).padStart(2, "0")}:00–{String(HOUR_END).padStart(2, "0")}:00
              </p>
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
                <div className="flex flex-col gap-3">
                  {[...services]
                    .filter((s) => s.revenue > 0)
                    .sort((a, b) => b.revenue - a.revenue)
                    .map((s, i) => {
                      const avg = s.count > 0 ? s.revenue / s.count : 0
                      const share = totalRevenue > 0 ? Math.round((s.revenue / totalRevenue) * 100) : 0
                      return (
                        <RevenueRow
                          key={s.name}
                          name={s.name}
                          revenue={s.revenue}
                          share={share}
                          avg={avg}
                          max={maxServiceRevenue}
                          colorIdx={i}
                        />
                      )
                    })}
                </div>
                {/* Підсумок — головний акцент блоку */}
                <div className="mt-3 flex items-center justify-between rounded-xl bg-[var(--teal-light)] px-3.5 py-2.5 md:px-4 md:py-3">
                  <span className="text-[12px] font-bold uppercase tracking-[0.4px] text-[var(--teal-dark)] md:text-[13px]">
                    Разом
                  </span>
                  <span className="text-[18px] font-black text-[var(--teal-dark)] md:text-[20px]">
                    {formatMoney(totalRevenue)}
                  </span>
                </div>
              </>
            )}
          </Section>
        )}
      </div>
    </div>
  )
}
