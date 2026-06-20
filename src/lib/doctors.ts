export const DOCTORS = [
  "Остап (головний лікар)",
  "Юрій (лікар)",
  "Ірина (лікар)",
  "Устим (асистент)",
  "Іван (асистент)",
  "Анна (асистент)",
] as const

export type DoctorName = (typeof DOCTORS)[number]

export const DOCTOR_COLORS = [
  { bg: "#dbeafe", border: "#2563eb", text: "#1d4ed8" },
  { bg: "#dcfce7", border: "#16a34a", text: "#15803d" },
  { bg: "#cffafe", border: "#0891b2", text: "#0e7490" },
  { bg: "#fef3c7", border: "#d97706", text: "#b45309" },
  { bg: "#fce7f3", border: "#db2777", text: "#be185d" },
  { bg: "#ede9fe", border: "#7c3aed", text: "#6d28d9" },
] as const

export function doctorColor(doctorName: string) {
  const idx = DOCTORS.indexOf(doctorName as DoctorName)
  return DOCTOR_COLORS[idx >= 0 ? idx : 0]
}

/**
 * Ім'я лікаря для показу без ролі в дужках: "Остап (головний лікар)" → "Остап".
 * Значення DOCTORS/appointment.doctor НЕ змінюємо (вони — ключ прив'язки записів
 * і збігаються з doctors.name у БД) — скорочуємо лише для відображення.
 */
export function doctorShortName(doctorName: string): string {
  return doctorName.replace(/\s*\(.*\)\s*/, "").trim()
}

// ─── Ролі та доступ ────────────────────────────────────────────────────────────
//
// ЄДИНЕ джерело ролей — таблиця `profiles` у БД (див. supabase/add-roles-tables.sql).
// Роль поточного юзера резолвиться один раз через RPC current_user_profile() у
// src/app/(app)/layout.tsx і прокидається в CalendarContext. Хелпери нижче —
// чисті функції над роллю, БЕЗ власного джерела істини (жодних email/мапінгів).
//
// Суми (price) у записах бачать УСІ працівники. Доступ до сторінки аналітики
// коштів (canSeePrices) вужчий — лише admin та head.
//
//   admin     — адміністратор системи: бачить усе + сторінку /admin, debug/dev,
//               аналітику коштів, помилки. Для прив'язки записів — як головний лікар.
//   head      — головний лікар (Остап): бачить усе, включно з аналітикою коштів.
//   doctor    — звичайний лікар: має доступ до бази клієнтів, без аналітики коштів.
//   assistant — асистент (Анна, Устим): без бази клієнтів і без аналітики коштів.

export type DoctorRole = "admin" | "head" | "doctor" | "assistant"

/** Доступ до аналітики коштів (сторінка «Аналітика») — admin та головний лікар. */
export function canSeePrices(role: DoctorRole): boolean {
  return role === "admin" || role === "head"
}

/** Має доступ до бази клієнтів — admin, головний лікар та звичайні лікарі.
 *  Асистенти бази клієнтів НЕ бачать.
 *  (Дані клієнтів будуються з записів, які за RLS читають усі автентифіковані.) */
export function canSeeClients(role: DoctorRole): boolean {
  return role === "admin" || role === "head" || role === "doctor"
}

/** Доступ до сторінки /admin — лише admin. */
export function canSeeAdmin(role: DoctorRole): boolean {
  return role === "admin"
}

/** Керування користувачами — лише admin (найбезпечніший варіант). */
export function canManageUsers(role: DoctorRole): boolean {
  return role === "admin"
}

/** Доступ до debug/dev-інформації та логу помилок — лише admin. */
export function canSeeDebug(role: DoctorRole): boolean {
  return role === "admin"
}

export function roleLabel(role: DoctorRole): string {
  switch (role) {
    case "admin":
      return "Адмін системи"
    case "head":
      return "Головний лікар"
    case "doctor":
      return "Лікар"
    case "assistant":
      return "Асистент"
  }
}
