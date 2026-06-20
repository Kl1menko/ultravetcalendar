"use client"

import { useCallback, useSyncExternalStore } from "react"

export type Theme = "light" | "dark"

// Ключ у localStorage — має збігатися з інлайн-скриптом у layout.tsx, який
// застосовує тему ще до гідрації (щоб не було спалаху світлої теми).
export const THEME_STORAGE_KEY = "uv-theme"

function applyTheme(theme: Theme) {
  const root = document.documentElement
  root.classList.toggle("dark", theme === "dark")
  // Синхронізуємо <meta name="theme-color"> зі статус-баром PWA.
  const meta = document.querySelector('meta[name="theme-color"]')
  if (meta) meta.setAttribute("content", theme === "dark" ? "#0d0d0f" : "#fafafa")
}

// ─── Зовнішнє сховище теми для useSyncExternalStore ──────────────────────────
// Джерело правди — наявність класу .dark на <html> (його ставить інлайн-скрипт
// ще до гідрації). Так читання теми гідрація-безпечне й без setState-in-effect.

const listeners = new Set<() => void>()

function subscribe(cb: () => void) {
  listeners.add(cb)
  return () => listeners.delete(cb)
}

function getSnapshot(): Theme {
  return document.documentElement.classList.contains("dark") ? "dark" : "light"
}

// На сервері document недоступний — рендеримо як світлу (інлайн-скрипт усе одно
// застосує темну до показу, а клієнтський getSnapshot одразу дасть правильне).
function getServerSnapshot(): Theme {
  return "light"
}

/**
 * Керування темою (світла/темна) з ручним перемикачем і збереженням вибору.
 * Початкове значення вже застосоване інлайн-скриптом у <head>; тут читаємо
 * його з класу .dark і даємо API для перемикання.
 */
export function useTheme() {
  const theme = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot)

  const setTheme = useCallback((next: Theme) => {
    window.localStorage.setItem(THEME_STORAGE_KEY, next)
    applyTheme(next)
    listeners.forEach((cb) => cb())
  }, [])

  const toggleTheme = useCallback(() => {
    setTheme(getSnapshot() === "dark" ? "light" : "dark")
  }, [setTheme])

  return { theme, setTheme, toggleTheme }
}
