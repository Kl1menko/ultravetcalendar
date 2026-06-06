import { Appointment } from "@/types"

// Екранування значення для CSV: обгортаємо в лапки й подвоюємо внутрішні лапки,
// якщо є кома/лапка/перенос рядка. Інакше повертаємо як є.
function csvCell(value: string | number): string {
  const s = String(value ?? "")
  if (/[",\n;]/.test(s)) {
    return `"${s.replace(/"/g, '""')}"`
  }
  return s
}

const HEADERS = [
  "Дата",
  "Час",
  "Клієнт",
  "Телефон",
  "Тварина",
  "Вид/порода",
  "Послуга",
  "Лікар",
  "Ціна",
  "Коментар",
] as const

function appointmentRow(a: Appointment): (string | number)[] {
  return [
    a.date,
    `${a.start}–${a.end}`,
    a.client,
    a.phone,
    a.pet,
    a.animal,
    a.service,
    a.doctor,
    a.price || 0,
    a.comment,
  ]
}

// Будуємо CSV з записів. Кодуємо з BOM (﻿), щоб Excel коректно прочитав
// кирилицю в UTF-8. Рядки впорядковані за датою й часом.
export function appointmentsToCsv(appointments: Appointment[]): string {
  const header = HEADERS.map(csvCell).join(",")
  const rows = [...appointments]
    .sort((a, b) => `${a.date} ${a.start}`.localeCompare(`${b.date} ${b.start}`))
    .map((a) => appointmentRow(a).map(csvCell).join(","))
  return "﻿" + [header, ...rows].join("\r\n")
}

// Тригеримо завантаження CSV-файлу у браузері.
export function downloadCsv(filename: string, csv: string): void {
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8" })
  const url = URL.createObjectURL(blob)
  const link = document.createElement("a")
  link.href = url
  link.download = filename
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  URL.revokeObjectURL(url)
}
