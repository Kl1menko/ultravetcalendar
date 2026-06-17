// Локальний логер помилок — зберігає останні помилки застосунку в localStorage,
// щоб admin міг переглянути їх на сторінці /admin без зовнішнього сервісу.
//
// Працює лише на клієнті: усі функції безпечні на сервері (no-op або console.error),
// тож виклик із коду, що може виконуватись під час SSR/prerender, нічого не зламає.

export type AppError = {
  id: string
  source: string
  message: string
  createdAt: string
  details?: unknown
}

const STORAGE_KEY = "ultravet_error_log"
const MAX_ERRORS = 100

// localStorage доступний лише в браузері. Загортаємо доступ, щоб жоден виклик
// не падав на сервері й не ламав app, якщо storage вимкнено (приватний режим).
function getStorage(): Storage | null {
  if (typeof window === "undefined") return null
  try {
    return window.localStorage
  } catch {
    return null
  }
}

function errorMessage(error: unknown): string {
  if (error instanceof Error) return error.message
  if (typeof error === "string") return error
  try {
    return JSON.stringify(error)
  } catch {
    return String(error)
  }
}

// Деталі мають бути серіалізовними для localStorage. Error не серіалізується
// напряму через JSON, тож для нього зберігаємо name/message/stack.
function serializableDetails(error: unknown): unknown {
  if (error instanceof Error) {
    return { name: error.name, message: error.message, stack: error.stack }
  }
  return error
}

function makeId(): string {
  try {
    if (typeof crypto !== "undefined" && crypto.randomUUID) return crypto.randomUUID()
  } catch {
    /* fall through */
  }
  return `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`
}

/**
 * Записати помилку в локальний лог. Завжди дублює в console.error.
 * Безпечно для server-середовища: якщо localStorage недоступний — лише console.error.
 */
export function logAppError(source: string, error: unknown): void {
  // Дублюємо в консоль завжди — і на сервері, і на клієнті.
  console.error(`[${source}]`, error)

  const storage = getStorage()
  if (!storage) return

  const entry: AppError = {
    id: makeId(),
    source,
    message: errorMessage(error),
    createdAt: new Date().toISOString(),
    details: serializableDetails(error),
  }

  try {
    const existing = getAppErrors()
    // Найновіші — на початку, обрізаємо до MAX_ERRORS.
    const next = [entry, ...existing].slice(0, MAX_ERRORS)
    storage.setItem(STORAGE_KEY, JSON.stringify(next))
  } catch {
    // Квота/серіалізація — не ламаємо app, помилка вже у консолі.
  }
}

/** Повернути збережені помилки (найновіші першими). Порожній масив на сервері. */
export function getAppErrors(): AppError[] {
  const storage = getStorage()
  if (!storage) return []
  try {
    const raw = storage.getItem(STORAGE_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw)
    return Array.isArray(parsed) ? (parsed as AppError[]) : []
  } catch {
    return []
  }
}

/** Очистити лог помилок. */
export function clearAppErrors(): void {
  const storage = getStorage()
  if (!storage) return
  try {
    storage.removeItem(STORAGE_KEY)
  } catch {
    /* no-op */
  }
}

/** JSON-рядок з усіма помилками (для копіювання / завантаження). */
export function appErrorsJson(): string {
  return JSON.stringify(getAppErrors(), null, 2)
}

/** Завантажити лог помилок як JSON-файл (тільки в браузері). */
export function downloadAppErrorsJson(): void {
  if (typeof window === "undefined") return
  try {
    const blob = new Blob([appErrorsJson()], { type: "application/json;charset=utf-8" })
    const url = URL.createObjectURL(blob)
    const link = document.createElement("a")
    link.href = url
    link.download = `ultravet_errors_${new Date().toISOString().slice(0, 10)}.json`
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    URL.revokeObjectURL(url)
  } catch (e) {
    console.error("downloadAppErrorsJson failed", e)
  }
}
