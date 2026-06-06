import { Appointment } from "@/types"

// Версія формату бекапу. Підвищуй, якщо зміниться структура appointments,
// щоб під час відновлення можна було розрізнити старі дампи.
const BACKUP_VERSION = 1

export type AppointmentsBackup = {
  version: number
  /** ISO-час створення бекапу. */
  createdAt: string
  /** Кількість записів — для швидкої перевірки цілісності. */
  count: number
  /** Чи включені суми (price). false для не-head — суми будуть 0. */
  includesPrices: boolean
  appointments: Appointment[]
}

// Збираємо повний JSON-бекап записів. Дані беремо як є (нормалізований
// Appointment з контексту) — це сирий зліпок, придатний для відновлення 1:1.
export function buildAppointmentsBackup(
  appointments: Appointment[],
  includesPrices: boolean
): AppointmentsBackup {
  return {
    version: BACKUP_VERSION,
    createdAt: new Date().toISOString(),
    count: appointments.length,
    includesPrices,
    // Сортуємо за датою/часом — стабільний порядок між бекапами.
    appointments: [...appointments].sort((a, b) =>
      `${a.date} ${a.start}`.localeCompare(`${b.date} ${b.start}`)
    ),
  }
}

// Тригеримо завантаження JSON-файлу у браузері.
export function downloadJson(filename: string, data: unknown): void {
  const json = JSON.stringify(data, null, 2)
  const blob = new Blob([json], { type: "application/json;charset=utf-8" })
  const url = URL.createObjectURL(blob)
  const link = document.createElement("a")
  link.href = url
  link.download = filename
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  URL.revokeObjectURL(url)
}
