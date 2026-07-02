// Чиста аналітична логіка сторінки «Аналітика» — без React, тож легко тестується.
// Презентація (Bar/Delta/Section та сама сторінка) лишається в analytics/page.tsx.
import { isoDate, minutesFromTime } from "./utils-app"
import { HOUR_START, HOUR_END } from "./constants"
import { parseServices } from "./services"
import { Appointment } from "@/types"

// ─── періоди ───────────────────────────────────────────────────────────────────

export type Period = "day" | "week" | "month" | "year" | "all"

export const PERIODS: { value: Period; label: string }[] = [
  { value: "day", label: "День" },
  { value: "week", label: "Тиждень" },
  { value: "month", label: "Місяць" },
  { value: "year", label: "Рік" },
  { value: "all", label: "Весь час" },
]

// Повний календарний діапазон [start..end] (включно) для періоду відносно
// якірної дати (anchor; за замовчуванням — сьогодні). Anchor дозволяє
// дивитися конкретний місяць/рік у минулому, не лише поточний.
// Включає майбутні записи в межах періоду (це планувальник).
// "all" → null (без обмежень).
export function periodRange(period: Period, anchor: Date = new Date()): { start: Date; end: Date } | null {
  if (period === "all") return null
  const start = new Date(anchor)
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

export function filterByPeriod(
  appointments: Appointment[],
  period: Period,
  anchor: Date = new Date()
): Appointment[] {
  const range = periodRange(period, anchor)
  if (!range) return appointments
  const startIso = isoDate(range.start)
  const endIso = isoDate(range.end)
  return appointments.filter((a) => a.date >= startIso && a.date <= endIso)
}

// Попередній період такої самої довжини, що й поточний (для порівняння ±%).
// Зсунутий назад так, щоб закінчуватися за день до початку поточного.
// Для "all" порівняння немає (повертаємо null).
export function filterByPreviousPeriod(
  appointments: Appointment[],
  period: Period,
  anchor: Date = new Date()
): Appointment[] | null {
  const range = periodRange(period, anchor)
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
export function pctChange(current: number, previous: number): number | null {
  if (previous === 0) return current === 0 ? 0 : null
  return Math.round(((current - previous) / previous) * 100)
}

// Суфікс гранулярності для заголовка тренду — узгоджений із revenueTrend().
export function trendUnitLabel(period: Period): string {
  if (period === "day") return " по годинах"
  if (period === "year" || period === "all") return " по місяцях"
  return " по днях"
}

// ─── навігація по якірній даті (вибір конкретного місяця/року) ───────────────

// Чи підтримує період листання в минуле/майбутнє (день/тиждень — ні, бо їх
// надто багато; вибираємо лише місяць і рік).
export function isNavigablePeriod(period: Period): boolean {
  return period === "month" || period === "year"
}

const MONTHS_UK = [
  "Січень", "Лютий", "Березень", "Квітень", "Травень", "Червень",
  "Липень", "Серпень", "Вересень", "Жовтень", "Листопад", "Грудень",
]

// Зсув якоря на N кроків (місяців для "month", років для "year").
// Для ненавігаційних періодів повертаємо anchor без змін.
export function shiftAnchor(anchor: Date, period: Period, steps: number): Date {
  const next = new Date(anchor)
  next.setHours(0, 0, 0, 0)
  if (period === "month") next.setMonth(next.getMonth() + steps, 1)
  else if (period === "year") next.setFullYear(next.getFullYear() + steps, 0, 1)
  return next
}

// Чи якір вже у поточному (або майбутньому) періоді — щоб блокувати кнопку «далі».
export function isCurrentOrFuturePeriod(anchor: Date, period: Period): boolean {
  const now = new Date()
  if (period === "month") {
    return (
      anchor.getFullYear() > now.getFullYear() ||
      (anchor.getFullYear() === now.getFullYear() && anchor.getMonth() >= now.getMonth())
    )
  }
  if (period === "year") return anchor.getFullYear() >= now.getFullYear()
  return true
}

// Людська мітка обраного якоря: «Травень 2025» / «2024».
export function anchorLabel(anchor: Date, period: Period): string {
  if (period === "month") return `${MONTHS_UK[anchor.getMonth()]} ${anchor.getFullYear()}`
  if (period === "year") return String(anchor.getFullYear())
  return ""
}

// Підпис для рядка порівняння під KPI-картками.
export function periodComparisonLabel(period: Period): string {
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
export const WEEKDAY_SHORT = ["Нд", "Пн", "Вт", "Ср", "Чт", "Пт", "Сб"]

export function peakHours(appointments: Appointment[]) {
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

export function peakWeekdays(appointments: Appointment[]) {
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
export function revenueTrend(
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
export function averageUtilization(appointments: Appointment[]): number {
  const dayPcts = dayUtilizationPcts(appointments)
  return dayPcts.length
    ? Math.round(dayPcts.reduce((s, d) => s + d.pct, 0) / dayPcts.length)
    : 0
}

// Завантаженість клініки за період: середній % зайнятості робочих слотів по днях,
// де реально були записи, + середня зайнятість у розрізі днів тижня.
export function clinicUtilization(appointments: Appointment[]) {
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
export function byService(appointments: Appointment[]) {
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

// Послуги вакцинації від сказу — синхронно з SERVICES у services.ts. «Сказ»
// розділено на котів і собак; старі записи в БД ще містять єдину назву «Сказ»,
// тож рахуємо і її теж. Один запис може містити кілька послуг (поле service
// через роздільник), тож звіряємо через parseServices, а не точним рядком.
export const RABIES_CATS = "Сказ (коти)"
export const RABIES_DOGS = "Сказ (собаки)"
// Старі записи без розділення виду тварини (до розбиття «Сказ» на котів/собак).
export const RABIES_LEGACY = "Сказ"
export const RABIES_SERVICES = [RABIES_CATS, RABIES_DOGS, RABIES_LEGACY] as const

// Розбивка кількості послуг зі сказу за один запис: коти / собаки / без виду
// (старі записи «Сказ»). Один запис може містити кілька з них — рахуємо кожну.
type RabiesBreakdown = { cats: number; dogs: number; other: number; total: number }

// Кількість послуг зі сказу ВСІМА лікарями разом за календарний тиждень (Пн–Нд)
// і за календарний місяць — відносно anchor (за замовчуванням сьогодні). Кожен
// період розбито на котів/собак (+ старі записи без виду). Період рахуємо тим
// самим periodRange, що й сторінка аналітики.
export function rabiesCounts(
  appointments: Appointment[],
  anchor: Date = new Date()
): { week: RabiesBreakdown; month: RabiesBreakdown } {
  const countRabies = (period: Period): RabiesBreakdown => {
    const acc: RabiesBreakdown = { cats: 0, dogs: 0, other: 0, total: 0 }
    filterByPeriod(appointments, period, anchor).forEach((a) => {
      const services = parseServices(a.service)
      if (services.includes(RABIES_CATS)) acc.cats++
      if (services.includes(RABIES_DOGS)) acc.dogs++
      if (services.includes(RABIES_LEGACY)) acc.other++
    })
    acc.total = acc.cats + acc.dogs + acc.other
    return acc
  }
  return { week: countRabies("week"), month: countRabies("month") }
}

export function byDoctor(appointments: Appointment[]) {
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

export function shortDoctor(name: string) {
  return name.split(/[\s(]+/)[0] || name
}

// Порівняльна статистика по лікарях: записи, виручка, сер. чек, завантаженість.
// Сортуємо за виручкою (спадання) — найрезультативніший зверху.
export type DoctorStat = {
  name: string
  count: number
  revenue: number
  avgCheck: number
  utilization: number
}

export function buildDoctorStats(appointments: Appointment[]): DoctorStat[] {
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

export function formatMoney(value: number) {
  return `${Math.round(value).toLocaleString("uk-UA")} ₴`
}
