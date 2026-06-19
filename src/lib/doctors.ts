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
 * і збігаються з даними в БД та DOCTOR_ACCESS) — скорочуємо лише для відображення.
 */
export function doctorShortName(doctorName: string): string {
  return doctorName.replace(/\s*\(.*\)\s*/, "").trim()
}

// ─── Ролі та доступ ────────────────────────────────────────────────────────────
//
// Роль визначається через email → запис у DOCTOR_ACCESS. Це надійніше за звірку
// display_name (його юзер може змінити) і легко синхронізується з RLS у БД.
//
//   admin     — адміністратор системи: бачить усе + сторінку /admin, debug/dev,
//               фінанси, помилки. Для прив'язки записів дивиться як головний лікар.
//   head      — головний лікар (Остап): бачить усе, включно з сумами та аналітикою коштів.
//   doctor    — звичайний лікар: бачить записи без сум, має доступ до бази клієнтів.
//   assistant — асистент (Анна, Устим): бачить записи без сум і НЕ має доступу до клієнтів.

export type DoctorRole = "admin" | "head" | "doctor" | "assistant"

type DoctorAccount = {
  /**
   * Лікар, до якого прив'язані записи. Має збігатися з елементом DOCTORS.
   * Для admin може бути null (адмін не є лікарем у розкладі) — тоді
   * currentDoctor буде null, що безпечно обробляється у profile/аналітиці.
   */
  doctor: DoctorName | null
  role: DoctorRole
}

// Email → акаунт лікаря. Email порівнюється без урахування регістру.
// ⚠️ Тримай у синхроні з RLS-політиками у supabase/rls-policies.sql.
export const DOCTOR_ACCESS: Record<string, DoctorAccount> = {
  // Admin прив'язаний до головного лікаря, щоб бачити календар як повноцінний
  // користувач і не ламати currentDoctor / doctorForEmail.
  "v.klimenko2014@gmail.com": { doctor: "Остап (головний лікар)", role: "admin" },
  "head@clinic.com": { doctor: "Остап (головний лікар)", role: "head" },
  "yurii@clinic.com": { doctor: "Юрій (лікар)", role: "doctor" },
  "iryna@clinic.com": { doctor: "Ірина (лікар)", role: "doctor" },
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

/** Доступ до аналітики коштів (сторінка «Аналітика») — admin та головний лікар. */
export function canSeePrices(email: string | null | undefined): boolean {
  const role = roleForEmail(email)
  return role === "admin" || role === "head"
}

/**
 * Бачить суми (price) на тікетах та в деталях записів — усі залогінені.
 * Асистенти (Іван, Устим, Аня) вписують ціну при створенні запису
 * (див. canEditPrice у формі) і мають бачити її назад: інакше введена сума
 * обнуляється на читанні (fetchAppointments) і виглядає так, ніби «не зберігається».
 * Доступ до сторінки аналітики коштів при цьому вужчий — лише head (canSeePrices).
 */
export function canSeeAppointmentPrices(email: string | null | undefined): boolean {
  return accountForEmail(email) !== null
}

/** Має доступ до бази клієнтів — admin, головний лікар та звичайні лікарі.
 *  Асистенти бази клієнтів НЕ бачать.
 *  (Дані клієнтів будуються з записів, які за RLS читають усі автентифіковані.) */
export function canSeeClients(email: string | null | undefined): boolean {
  const role = roleForEmail(email)
  return role === "admin" || role === "head" || role === "doctor"
}

/** Доступ до сторінки /admin — лише admin. */
export function canSeeAdmin(email: string | null | undefined): boolean {
  return roleForEmail(email) === "admin"
}

/** Керування користувачами — лише admin (найбезпечніший варіант). */
export function canManageUsers(email: string | null | undefined): boolean {
  return roleForEmail(email) === "admin"
}

/** Доступ до debug/dev-інформації та логу помилок — лише admin. */
export function canSeeDebug(email: string | null | undefined): boolean {
  return roleForEmail(email) === "admin"
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
