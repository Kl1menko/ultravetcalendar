"use client"

import { useState } from "react"
import { AnimatePresence, motion } from "motion/react"
import { SERVICES, OPERATION_TYPES, isOperationType } from "@/lib/services"

// Блок вибору послуг у формі запису: повноширинна кнопка «Операція» з підсписком
// видів операцій + сітка-чекліст решти послуг. Кілька послуг можна обрати разом
// (зберігаються через роздільник у appointment.service — див. joinServices).
export function ServicePicker({
  services,
  setServices,
}: {
  services: string[]
  setServices: React.Dispatch<React.SetStateAction<string[]>>
}) {
  // Чи розкрито підсписок видів операцій. Початковий стан — за наявністю
  // операції в записі (редагування / «Повторити»); далі керується вручну.
  // Форма ремоунтить компонент через key при зміні запису, тож лінивий
  // ініціалізатор бачить актуальний services і не потребує ефекту.
  const [operationsOpen, setOperationsOpen] = useState(() =>
    services.some(isOperationType)
  )

  const toggle = (s: string) =>
    setServices((prev) =>
      prev.includes(s) ? prev.filter((x) => x !== s) : [...prev, s]
    )

  const opCount = services.filter(isOperationType).length
  const operationActive = operationsOpen || opCount > 0

  // Чеклист решти послуг: «Операція» та види операцій сюди НЕ потрапляють.
  const checklistServices = [
    ...SERVICES.filter((s) => s !== "Операція"),
    ...services.filter((s) => !SERVICES.includes(s as never) && !isOperationType(s)),
  ]

  return (
    <div className="flex min-w-0 w-full flex-col gap-2.5 md:col-span-2">
      <div className="flex items-center justify-between">
        <span className="text-[11px] font-bold uppercase tracking-[0.4px] text-[var(--muted-col)]">
          Послуги
        </span>
        <span className="text-[11px] font-medium text-[var(--muted-col)]">
          {services.length > 0 ? `Обрано: ${services.length}` : "Можна обрати кілька"}
        </span>
      </div>

      {/* «Операція» — окрема повноширинна кнопка над сіткою, щоб її
          підсписок розкривався ОДРАЗУ під нею, а не в кінці всієї сітки. */}
      <div>
        <button
          type="button"
          aria-expanded={operationsOpen}
          onClick={() => setOperationsOpen((v) => !v)}
          className={[
            "flex w-full items-center gap-2 rounded-xl border px-3 py-2.5 text-left text-[13px] font-semibold transition active:scale-[0.99]",
            operationActive
              ? "border-[var(--teal)] bg-[var(--teal-light)] text-[var(--ink)]"
              : "glass border-transparent text-[var(--ink-2)]",
            operationsOpen ? "rounded-b-none" : "",
          ].join(" ")}
        >
          <span className="truncate">Операція</span>
          {opCount > 0 && (
            <span className="grid h-4 min-w-4 shrink-0 place-items-center rounded-full bg-[var(--teal)] px-1 text-[10px] font-bold text-white">
              {opCount}
            </span>
          )}
          <svg
            viewBox="0 0 24 24"
            className={`ml-auto h-4 w-4 shrink-0 transition-transform ${operationsOpen ? "rotate-180" : ""}`}
            fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"
          >
            <path d="m6 9 6 6 6-6" />
          </svg>
        </button>

        {/* Підсписок видів операцій — впритул під кнопкою «Операція». */}
        <AnimatePresence initial={false}>
          {operationsOpen && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              transition={{ duration: 0.2, ease: [0.22, 0.61, 0.36, 1] }}
              className="overflow-hidden"
            >
              <div className="rounded-b-xl border border-t-0 border-[var(--teal)] bg-[var(--teal-light)]/40 p-2.5">
                <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                  {OPERATION_TYPES.map((op) => (
                    <ServiceToggle key={op} label={op} active={services.includes(op)} onToggle={() => toggle(op)} subtle />
                  ))}
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Рівна сітка-чекліст решти послуг: однакові комірки, чекбокс зліва. */}
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
        {checklistServices.map((s) => (
          <ServiceToggle key={s} label={s} active={services.includes(s)} onToggle={() => toggle(s)} />
        ))}
      </div>
    </div>
  )
}

// Одна кнопка-чекбокс послуги. subtle — варіант для підсписку операцій
// (трохи інший фон неактивної комірки).
function ServiceToggle({
  label,
  active,
  onToggle,
  subtle = false,
}: {
  label: string
  active: boolean
  onToggle: () => void
  subtle?: boolean
}) {
  const inactive = subtle
    ? "glass border-transparent text-[var(--ink-2)]"
    : "glass border-transparent text-[var(--ink-2)]"
  const activeCls = subtle
    ? "border-[var(--teal)] bg-white text-[var(--ink)]"
    : "border-[var(--teal)] bg-[var(--teal-light)] text-[var(--ink)]"
  const rounding = subtle ? "rounded-lg py-2" : "rounded-xl py-2.5"
  return (
    <button
      type="button"
      aria-pressed={active}
      onClick={onToggle}
      className={[
        "flex items-center gap-2 border px-3 text-left text-[13px] font-semibold transition active:scale-[0.98]",
        rounding,
        active ? activeCls : inactive,
      ].join(" ")}
    >
      <span
        className={[
          "grid h-4 w-4 shrink-0 place-items-center rounded-[5px] border transition-colors",
          active
            ? "border-[var(--teal)] bg-[var(--teal)] text-white"
            : "border-[var(--uv-gray-300)] bg-white",
        ].join(" ")}
      >
        {active && (
          <svg viewBox="0 0 24 24" className="h-3 w-3" fill="none" stroke="currentColor" strokeWidth={3.5} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M20 6 9 17l-5-5" />
          </svg>
        )}
      </span>
      <span className="truncate">{label}</span>
    </button>
  )
}
