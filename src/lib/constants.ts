export const SUPABASE_URL = "https://ptukvvbnbqbahwobitls.supabase.co"
export const SUPABASE_ANON =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InB0dWt2dmJuYnFiYWh3b2JpdGxzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzc1ODgzMzAsImV4cCI6MjA5MzE2NDMzMH0.P3Gwipqpc2poADf01mzcgl3p9V63LhdfCIi-JYIvfWQ"

export const HEAD_DOCTOR_EMAIL = "head@clinic.com"
export const HOUR_START = 8
export const HOUR_END = 20
export const MAX_APPOINTMENTS_PER_DAY = 8

export const STATUSES = ["Заплановано", "Очікує", "В кабінеті", "Завершено"] as const
export const DURATIONS = [
  { label: "15 хв", value: "15" },
  { label: "30 хв", value: "30" },
  { label: "45 хв", value: "45" },
  { label: "1 година", value: "60" },
  { label: "1 год 30 хв", value: "90" },
  { label: "2 години", value: "120" },
] as const
