// Список послуг для вибору в записі. Значення = те, що зберігається у appointment.service.
export const SERVICES = [
  "Операція",
  "Огляд",
  "Вакцинація",
  "УЗД",
  "Аналізи (загальний)",
  "Аналізи (біохімічний)",
  "Рентген",
  "Крапельниці",
  "Терапія",
  "Стаціонар",
  "Стерилізація",
] as const

export type ServiceName = (typeof SERVICES)[number]

// Кілька послуг зберігаються в одному текстовому полі appointment.service через
// кому-роздільник — без зміни схеми БД. Записи з однією послугою лишаються як є.
export const SERVICE_SEPARATOR = ", "

/** Рядок service → масив окремих послуг (без порожніх). */
export function parseServices(service: string): string[] {
  return service
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean)
}

/** Масив послуг → рядок для збереження у appointment.service. */
export function joinServices(services: string[]): string {
  return services.join(SERVICE_SEPARATOR)
}
