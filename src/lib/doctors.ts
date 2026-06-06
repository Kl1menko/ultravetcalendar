export const DOCTORS = [
  "Остап (головний лікар)",
  "Юрій (лікар)",
  "Устим (асистент)",
  "Іван (асистент)",
  "Анна (асистент)",
] as const

export type DoctorName = (typeof DOCTORS)[number]

export const DOCTOR_COLORS = [
  { bg: "#dbeafe", border: "#2563eb", text: "#1d4ed8" },
  { bg: "#dcfce7", border: "#16a34a", text: "#15803d" },
  { bg: "#fef3c7", border: "#d97706", text: "#b45309" },
  { bg: "#fce7f3", border: "#db2777", text: "#be185d" },
  { bg: "#ede9fe", border: "#7c3aed", text: "#6d28d9" },
] as const

export function doctorColor(doctorName: string) {
  const idx = DOCTORS.indexOf(doctorName as DoctorName)
  return DOCTOR_COLORS[idx >= 0 ? idx : 0]
}

// ─── Ролі та доступ ────────────────────────────────────────────────────────────
//
// Роль визначається через email → запис у DOCTOR_ACCESS. Це надійніше за звірку
// display_name (його юзер може змінити) і легко синхронізується з RLS у БД.
//
//   head      — головний лікар (Остап): бачить усе, включно з сумами та аналітикою коштів.
//   doctor    — звичайний лікар: бачить записи без сум, має доступ до бази клієнтів.
//   assistant — асистент (Анна, Устим): бачить записи без сум і НЕ має доступу до клієнтів.

export type DoctorRole = "head" | "doctor" | "assistant"

type DoctorAccount = {
  /** Має збігатися з елементом DOCTORS, щоб прив'язати записи до лікаря. */
  doctor: DoctorName
  role: DoctorRole
}

// Email → акаунт лікаря. Email порівнюється без урахування регістру.
// ⚠️ Тримай у синхроні з RLS-політиками у supabase/rls-policies.sql.
export const DOCTOR_ACCESS: Record<string, DoctorAccount> = {
  "head@clinic.com": { doctor: "Остап (головний лікар)", role: "head" },
  "yurii@clinic.com": { doctor: "Юрій (лікар)", role: "doctor" },
  "ustym@clinic.com": { doctor: "Устим (асистент)", role: "assistant" },
  "ivan@clinic.com": { doctor: "Іван (асистент)", role: "assistant" },
  "ania@clinic.com": { doctor: "Анна (асистент)", role: "assistant" },
}

export function accountForEmail(email: string | null | undefined): DoctorAccount | null {
  if (!email) return null
  return DOCTOR_ACCESS[email.trim().toLowerCase()] ?? null
}

export function roleForEmail(email: string | null | undefined): DoctorRole {
  return accountForEmail(email)?.role ?? "assistant"
}

export function doctorForEmail(email: string | null | undefined): DoctorName | null {
  return accountForEmail(email)?.doctor ?? null
}

/** Бачить суми (price) у записах та аналітику коштів — лише головний лікар. */
export function canSeePrices(email: string | null | undefined): boolean {
  return roleForEmail(email) === "head"
}

/** Має доступ до бази клієнтів — усі, крім асистентів. */
export function canSeeClients(email: string | null | undefined): boolean {
  return roleForEmail(email) !== "assistant"
}

export function roleLabel(role: DoctorRole): string {
  switch (role) {
    case "head":
      return "Головний лікар"
    case "doctor":
      return "Лікар"
    case "assistant":
      return "Асистент"
  }
}
