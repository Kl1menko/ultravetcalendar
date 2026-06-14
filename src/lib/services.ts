// Список послуг для вибору в записі. Значення = те, що зберігається у appointment.service.
export const SERVICES = [
  "Операція",
  "Огляд",
  "Вакцинація",
  "УЗД",
  "ЗАК",
  "БАК",
  "Рентген",
  "Крапельниці",
  "Терапія",
  "Зуби",
  "Стаціонар",
  "Стерилізація",
  "Кастрація",
  "Інфузія",
] as const

export type ServiceName = (typeof SERVICES)[number]

// Кілька послуг зберігаються в одному текстовому полі appointment.service через
// кому-роздільник — без зміни схеми БД. Записи з однією послугою лишаються як є.
export const SERVICE_SEPARATOR = ", "

// Перейменовані послуги: старі записи в БД ще містять колишні назви. Мапимо їх
// при читанні, щоб кнопка підсвічувалась і назва показувалась актуальною
// (історичні дані можна окремо оновити supabase/rename-services.sql).
const SERVICE_ALIASES: Record<string, string> = {
  "Аналізи (загальний)": "ЗАК",
  "Аналізи (біохімічний)": "БАК",
}

/** Рядок service → масив окремих послуг (без порожніх). */
export function parseServices(service: string): string[] {
  return service
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean)
    .map((s) => SERVICE_ALIASES[s] ?? s)
}

/** Масив послуг → рядок для збереження у appointment.service. */
export function joinServices(services: string[]): string {
  return services.join(SERVICE_SEPARATOR)
}
