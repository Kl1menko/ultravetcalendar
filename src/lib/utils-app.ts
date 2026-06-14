export function isoDate(date: Date): string {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, "0")
  const d = String(date.getDate()).padStart(2, "0")
  return `${y}-${m}-${d}`
}

export function formatTitle(date: Date): string {
  return date.toLocaleDateString("uk-UA", {
    weekday: "long",
    day: "numeric",
    month: "long",
  })
}

export function formatShortDate(date: Date): string {
  return date.toLocaleDateString("uk-UA", { day: "numeric", month: "long" })
}

export function formatMonthYear(date: Date): string {
  return date
    .toLocaleDateString("uk-UA", { month: "long", year: "numeric" })
    .replace(/^./, (c) => c.toUpperCase())
}

export function minutesFromTime(value: string): number {
  const [h, m] = value.split(":").map(Number)
  return (h || 0) * 60 + (m || 0)
}

export function timeFromMinutes(value: number): string {
  const norm = ((value % 1440) + 1440) % 1440
  return `${String(Math.floor(norm / 60)).padStart(2, "0")}:${String(norm % 60).padStart(2, "0")}`
}

export function durationLabel(minutes: number): string {
  if (minutes < 60) return `${minutes} хв`
  const h = Math.floor(minutes / 60)
  const m = minutes % 60
  return m
    ? `${h} год ${m} хв`
    : `${h} ${h === 1 ? "година" : h < 5 ? "години" : "годин"}`
}

