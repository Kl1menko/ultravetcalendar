// Нормалізація телефонів для пошуку незалежно від формату вводу.
// Один і той самий номер може бути збережений/введений як:
//   0123456789 · 0 (12) 345 67 89 · +380 12 345 67 89 · 380123456789
// Усі ці варіанти мають збігатись при пошуку. Зводимо до самих цифр і
// канонічного укр. вигляду (10 цифр, що починаються з 0).

/** Лишає у рядку тільки цифри. */
export function digitsOnly(value: string): string {
  return value.replace(/\D+/g, "")
}

/**
 * Канонічний вигляд укр. номера для порівняння.
 * +380XXXXXXXXX / 380XXXXXXXXX / 0XXXXXXXXX → 0XXXXXXXXX (10 цифр).
 * Для нестандартних/часткових вводів просто повертає самі цифри —
 * щоб частковий пошук («345 67») усе одно працював як підрядок.
 */
export function normalizePhone(value: string): string {
  const d = digitsOnly(value)
  // 380XXXXXXXXX (12 цифр, із кодом країни) → 0 + останні 9 цифр.
  if (d.length === 12 && d.startsWith("380")) return "0" + d.slice(3)
  // 80XXXXXXXXX (11 цифр, «+» з’їли при копіюванні) → 0 + останні 9.
  if (d.length === 11 && d.startsWith("80")) return "0" + d.slice(2)
  return d
}

/**
 * Чи відповідає телефон запису пошуковому запиту-номеру.
 * Порівнюємо нормалізовані цифри як підрядок, тож працює і повний номер,
 * і його фрагмент (напр. останні чотири цифри).
 */
export function phoneMatches(phone: string, query: string): boolean {
  const q = normalizePhone(query)
  if (!q) return false
  return normalizePhone(phone).includes(q)
}

/** Чи містить запит хоча б одну цифру (тоді є сенс пробувати телефонний матч). */
export function hasDigits(value: string): boolean {
  return /\d/.test(value)
}
