"use client"

import { Moon, Sun } from "lucide-react"
import { useTheme } from "@/hooks/useTheme"

// Сегментований перемикач світла/темна тема. Вибір зберігається в localStorage
// і застосовується миттєво (тогл класу .dark на <html>).
export default function ThemeToggle() {
  const { theme, setTheme } = useTheme()

  const options = [
    { value: "light" as const, label: "Світла", icon: Sun },
    { value: "dark" as const, label: "Темна", icon: Moon },
  ]

  return (
    <div className="flex items-center justify-between gap-3">
      <div className="min-w-0">
        <div className="text-[14px] font-semibold text-[var(--ink)]">Тема</div>
        <div className="text-[12px] text-[var(--muted-col)]">Світле або темне оформлення</div>
      </div>
      <div className="flex shrink-0 gap-1 rounded-xl border border-[var(--line)] bg-[var(--paper)] p-1">
        {options.map(({ value, label, icon: Icon }) => {
          const active = theme === value
          return (
            <button
              key={value}
              type="button"
              onClick={() => setTheme(value)}
              aria-pressed={active}
              className={`flex h-9 items-center gap-1.5 rounded-lg px-3 text-[13px] font-semibold transition-colors ${
                active
                  ? "bg-[var(--teal)] text-[var(--on-teal)] shadow-sm"
                  : "text-[var(--ink-2)] hover:text-[var(--ink)]"
              }`}
            >
              <Icon className="h-4 w-4" />
              {label}
            </button>
          )
        })}
      </div>
    </div>
  )
}
