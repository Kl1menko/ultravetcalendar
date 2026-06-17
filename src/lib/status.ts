import { AppointmentStatus } from "@/types"

// Статуси запису — порядок = природний життєвий цикл прийому.
// Синхронно з enum public.appointment_status (supabase/add-appointment-status.sql)
// та типом AppointmentStatus (src/types/index.ts).
// «В кабінеті» прибрано зі списку вибору за вимогою. Значення лишається в типі
// та enum БД (для старих записів), але користувач його не обирає; нормалізація
// нижче зводить старі «in_progress» до «Очікує».
export const STATUSES: AppointmentStatus[] = [
  "Заплановано",
  "Очікує",
  "Завершено",
  "Скасовано",
]

// Кольори pill — на тих самих брендових токенах, що й .status-pill у globals.css.
// bg/text як CSS-змінні, щоб не дублювати hex і триматися спільної палітри.
type StatusStyle = { bg: string; text: string }

const STATUS_STYLES: Record<AppointmentStatus, StatusStyle> = {
  "Заплановано": { bg: "rgba(107,114,128,.12)", text: "var(--ink-2)" },
  "Очікує": { bg: "var(--amber-bg)", text: "var(--amber)" },
  "В кабінеті": { bg: "var(--blue-bg)", text: "var(--blue)" },
  "Завершено": { bg: "var(--green-bg)", text: "var(--green)" },
  "Скасовано": { bg: "var(--red-bg)", text: "var(--red)" },
}

export function statusStyle(status: AppointmentStatus): StatusStyle {
  return STATUS_STYLES[status] ?? STATUS_STYLES["Заплановано"]
}

export function statusLabel(status: AppointmentStatus): string {
  return status
}

// Старі записи могли мати англомовний статус (scheduled, waiting тощо) або
// інакший регістр. Зводимо до канонічного укр. значення enum. Невідоме → null
// (виклик у normalizeRow підставить «Заплановано»).
export function normalizeStatus(raw: string | null | undefined): AppointmentStatus | null {
  if (!raw) return null
  const v = raw.trim()
  // Уже валідне укр. значення
  if ((STATUSES as string[]).includes(v)) return v as AppointmentStatus
  switch (v.toLowerCase()) {
    case "scheduled":
    case "planned":
      return "Заплановано"
    case "waiting":
    case "pending":
      return "Очікує"
    // «В кабінеті» більше не пропонується — старі записи зводимо до «Очікує».
    case "in_progress":
    case "in-progress":
    case "in progress":
    case "in_office":
    case "в кабінеті":
      return "Очікує"
    case "completed":
    case "done":
    case "finished":
      return "Завершено"
    case "cancelled":
    case "canceled":
      return "Скасовано"
    default:
      return null
  }
}
