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
  "УЗ-зубів",
  "Видалення зубів",
  "Стаціонар",
  "Інфузія",
  "Чіпування",
  "Титр антитіл до сказу",
  "Сказ",
] as const

export type ServiceName = (typeof SERVICES)[number]

// Конкретні види операцій. Обираються у підсписку під послугою «Операція» і
// зберігаються як окремі послуги (нарівні з рештою) у тому ж кому-роздільному
// полі appointment.service. Тобто запис на кастрацію має service = «Кастрація».
export const OPERATION_TYPES = [
  "Кастрація",
  "ОГЕ",
  "Видалення новоутворення",
  "Мастектомія тотальна",
  "Мастектомія локальна",
  "Грижа пупкова",
  "Грижа пахова",
  "Грижа парапроктальна",
] as const

export type OperationType = (typeof OPERATION_TYPES)[number]

/** Чи є послуга конкретним видом операції (для рендеру підсписку «Операції»). */
export function isOperationType(s: string): boolean {
  return (OPERATION_TYPES as readonly string[]).includes(s)
}

// Кілька послуг зберігаються в одному текстовому полі appointment.service через
// кому-роздільник — без зміни схеми БД. Записи з однією послугою лишаються як є.
export const SERVICE_SEPARATOR = ", "

// Перейменовані послуги: старі записи в БД ще містять колишні назви. Мапимо їх
// при читанні, щоб кнопка підсвічувалась і назва показувалась актуальною
// (історичні дані можна окремо оновити supabase/rename-services.sql).
const SERVICE_ALIASES: Record<string, string> = {
  "Аналізи (загальний)": "ЗАК",
  "Аналізи (біохімічний)": "БАК",
  // «Стерилізація» перейменовано на «ОГЕ» і перенесено у підсписок «Операції».
  "Стерилізація": "ОГЕ",
  // «Зуби» розділено на дві послуги; історичні записи зводимо до «УЗ-зубів».
  "Зуби": "УЗ-зубів",
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
