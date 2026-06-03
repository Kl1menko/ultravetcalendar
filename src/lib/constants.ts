function requiredPublicEnv(name: string, value: string | undefined) {
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`)
  }

  return value
}

export const SUPABASE_URL = requiredPublicEnv(
  "NEXT_PUBLIC_SUPABASE_URL",
  process.env.NEXT_PUBLIC_SUPABASE_URL
)
export const SUPABASE_ANON = requiredPublicEnv(
  "NEXT_PUBLIC_SUPABASE_ANON_KEY",
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
)
export const HEAD_DOCTOR_EMAIL = requiredPublicEnv(
  "NEXT_PUBLIC_HEAD_DOCTOR_EMAIL",
  process.env.NEXT_PUBLIC_HEAD_DOCTOR_EMAIL
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
