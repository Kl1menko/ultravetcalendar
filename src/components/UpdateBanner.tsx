"use client"

import { useServiceWorkerUpdate } from "@/hooks/useServiceWorkerUpdate"

// Ненав'язливий банер зверху: з'являється, коли для застосунку вже завантажена
// нова версія (новий деплой), і дозволяє оновитись без ручного очищення кешу.
export default function UpdateBanner() {
  const { updateAvailable, applyUpdate } = useServiceWorkerUpdate()

  if (!updateAvailable) return null

  return (
    <div
      className="fixed top-0 left-0 right-0 z-50 flex justify-center px-3"
      style={{ paddingTop: "max(env(safe-area-inset-top), 12px)" }}
    >
      <div className="flex w-full max-w-sm items-center gap-3 rounded-2xl bg-[var(--ink)] px-4 py-3 text-white shadow-2xl shadow-black/30">
        <div className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-xl bg-[var(--teal)]">
          <svg
            viewBox="0 0 24 24"
            className="h-5 w-5"
            fill="none"
            stroke="currentColor"
            strokeWidth={2}
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M21 12a9 9 0 1 1-2.64-6.36" />
            <path d="M21 3v6h-6" />
          </svg>
        </div>

        <p className="min-w-0 flex-1 text-[13px] font-medium leading-snug text-white/95">
          Доступна нова версія застосунку
        </p>

        <button
          type="button"
          onClick={applyUpdate}
          className="flex-shrink-0 rounded-xl bg-[var(--teal)] px-3 py-2 text-[13px] font-semibold text-[var(--on-teal)] transition-colors hover:bg-[var(--teal-dark)]"
        >
          Оновити
        </button>
      </div>
    </div>
  )
}
