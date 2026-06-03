// Не кидаємо помилку на етапі імпорту: під час білду/prerender на Vercel
// модуль виконується ще до того, як доступні рантайм-env, і це валило б збірку.
// Замість цього попереджаємо в консолі й повертаємо порожній рядок —
// Supabase-клієнт створиться, а реальні запити дадуть зрозумілу помилку,
// якщо змінні справді не задано в середовищі.
function publicEnv(name: string, value: string | undefined) {
  if (!value) {
    console.warn(`Missing environment variable: ${name}`)
    return ""
  }
  return value
}

export const SUPABASE_URL = publicEnv(
  "NEXT_PUBLIC_SUPABASE_URL",
  process.env.NEXT_PUBLIC_SUPABASE_URL
)
export const SUPABASE_ANON = publicEnv(
  "NEXT_PUBLIC_SUPABASE_ANON_KEY",
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
)
export const HOUR_START = 8
export const HOUR_END = 20
export const MAX_APPOINTMENTS_PER_DAY = 8

export const DURATIONS = [
  { label: "15 хв", value: "15" },
  { label: "30 хв", value: "30" },
  { label: "45 хв", value: "45" },
  { label: "1 година", value: "60" },
  { label: "1 год 30 хв", value: "90" },
  { label: "2 години", value: "120" },
] as const
