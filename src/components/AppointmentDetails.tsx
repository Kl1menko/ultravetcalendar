"use client"

import { useState } from "react"
import { motion } from "motion/react"
import { Sheet, SheetContent } from "@/components/ui/sheet"
import { Appointment, AppointmentStatus } from "@/types"
import { minutesFromTime, durationLabel, formatShortDate } from "@/lib/utils-app"
import { doctorShortName } from "@/lib/doctors"
import { STATUSES, statusStyle } from "@/lib/status"
import { springPop } from "@/lib/motion"
import { parseServices } from "@/lib/services"
import { deleteAppointment, updateStatus } from "@/lib/appointments"

type Props = {
  appointment: Appointment | null
  onClose: () => void
  onEdit: (appt: Appointment) => void
  onDuplicate: (appt: Appointment) => void
  onDeleted: () => void
  canSeePrices?: boolean
  /** Чи може користувач видалити цей запис (автор або head/admin). */
  canDelete?: boolean
}

export default function AppointmentDetails({
  appointment,
  onClose,
  onEdit,
  onDuplicate,
  onDeleted,
  canSeePrices = false,
  canDelete = false,
}: Props) {
  const [deleting, setDeleting] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [savingStatus, setSavingStatus] = useState(false)
  // Оптимістичний статус: батьківський detailsAppt не оновлюється після reload,
  // тож тримаємо відображуваний статус локально і скидаємо оверайд при зміні
  // запису (id+status у залежності рендер-синхронізації нижче).
  const [statusOverride, setStatusOverride] = useState<AppointmentStatus | null>(null)
  const [syncKey, setSyncKey] = useState<string>("")

  // Синхронізація під час рендеру (без ефекту): коли відкрито інший запис або
  // прийшов новий статус із пропсів — скидаємо локальний оверайд.
  const currentKey = `${appointment?.id ?? ""}:${appointment?.status ?? ""}`
  if (currentKey !== syncKey) {
    setSyncKey(currentKey)
    setStatusOverride(null)
  }

  if (!appointment) return null

  const durMins = minutesFromTime(appointment.end) - minutesFromTime(appointment.start)
  const status = statusOverride ?? appointment.status

  const handleStatusChange = async (next: AppointmentStatus) => {
    if (next === status || savingStatus) return
    setSavingStatus(true)
    setStatusOverride(next) // оптимістично
    const { error } = await updateStatus(appointment.id, next)
    setSavingStatus(false)
    if (error) {
      setStatusOverride(appointment.status) // відкат
      return
    }
    onDeleted() // = reload зі layout — оновлює список/календар
  }

  const handleDelete = async () => {
    setDeleting(true)
    await deleteAppointment(appointment.id)
    setDeleting(false)
    onDeleted()
    onClose()
  }

  return (
    <Sheet open={!!appointment} onOpenChange={(v) => { if (!v) { setConfirmDelete(false); onClose() } }}>
      <SheetContent
        side="bottom"
        className="flex max-h-[92svh] flex-col rounded-t-[20px] px-0 pb-0 md:max-h-[84dvh] md:w-[min(760px,calc(100vw-3rem))] md:rounded-[28px]"
      >
        {/* Handle */}
        <div className="mx-auto mb-3 mt-1.5 h-1 w-10 shrink-0 rounded-full bg-[var(--line)] md:hidden" />

        {/* Прокручувана частина — герой + інфо-рядки */}
        <div className="min-h-0 flex-1 overflow-y-auto">

        {/* Hero block */}
        <div className="matte-appt-card mx-4 mb-4 rounded-2xl px-4 py-3.5 md:mx-6 md:mt-6 md:rounded-[24px] md:px-6 md:py-5">
          {/* Статус + дата */}
          <div className="flex items-center justify-between mb-2">
            <motion.span
              key={status}
              variants={springPop}
              initial="hidden"
              animate="visible"
              className="rounded-full px-2.5 py-1 text-[11px] font-bold uppercase tracking-[0.3px]"
              style={{ background: statusStyle(status).bg, color: statusStyle(status).text }}
            >
              {status}
            </motion.span>
            <span className="text-[12px] font-semibold text-[var(--muted-col)]">
              {formatShortDate(new Date(appointment.date + "T12:00:00"))}
            </span>
          </div>

          {/* Тварина + послуга */}
          <h2 className="text-[22px] font-bold leading-tight text-[var(--ink)] mb-0.5">
            {appointment.pet}
          </h2>
          <div className="flex flex-wrap gap-1.5">
            {parseServices(appointment.service).map((s) => (
              <span
                key={s}
                className="rounded-md border border-[var(--line)] bg-white/70 px-2 py-0.5 text-[13px] font-semibold text-[var(--ink-2)]"
              >
                {s}
              </span>
            ))}
          </div>

          {/* Час */}
          <div className="flex items-center gap-2 mt-2.5">
            <span className="text-[13px] font-bold text-[var(--ink)]">
              {appointment.start}–{appointment.end}
            </span>
            <span className="text-[12px] text-[var(--muted-col)]">
              {durationLabel(durMins)}
            </span>
            {canSeePrices && appointment.price > 0 && (
              <span className="ml-auto rounded-lg bg-white/70 px-2 py-0.5 text-[14px] font-bold text-[var(--teal)] md:text-[15px]">
                {Number(appointment.price).toLocaleString("uk-UA")} ₴
              </span>
            )}
          </div>
        </div>

        {/* Інфо-рядки — мітка зверху дрібним капсом, значення під нею (стек,
            лівий край). Пари читаються єдиним блоком, без порожнечі посередині. */}
        <div className="mx-4 mb-4 overflow-hidden rounded-2xl border border-[var(--line)] md:mx-6 md:rounded-[24px]">
          {(() => {
            const rows = [
              { label: "Клієнт", value: appointment.client, phone: false, full: false },
              { label: "Телефон", value: appointment.phone, phone: true, full: false },
              { label: "Тварина", value: appointment.animal || appointment.pet, phone: false, full: false },
              ...(appointment.age
                ? [{ label: "Вік", value: appointment.age, phone: false, full: false }]
                : []),
              ...(appointment.weight
                ? [{ label: "Вага", value: appointment.weight, phone: false, full: false }]
                : []),
              ...(appointment.address
                ? [{ label: "Адреса", value: appointment.address, phone: false, full: true }]
                : []),
              { label: "Лікар", value: doctorShortName(appointment.doctor), phone: false, full: false },
              ...(appointment.comment
                ? [{ label: "Коментар", value: appointment.comment, phone: false, full: true }]
                : []),
            ]
            return (
              <div className="grid grid-cols-1 sm:grid-cols-2">
                {rows.map((row, i) => {
                  const isLast = i === rows.length - 1
                  // На ≥sm клітинки лягають у 2 колонки: ліва (парний індекс) має
                  // праву межу; всі, крім останнього рядка, мають нижню.
                  const leftCol = i % 2 === 0
                  const onLastSmRow = i >= rows.length - (rows.length % 2 === 0 ? 2 : 1)
                  return (
                    <div
                      key={i}
                      className={[
                        "flex flex-col gap-0.5 px-4 py-3 md:px-5 md:py-3.5 [border-color:var(--line)]",
                        isLast ? "" : "border-b",
                        row.full
                          ? "sm:col-span-2"
                          : [
                              leftCol ? "sm:border-r" : "",
                              onLastSmRow ? "sm:border-b-0" : "",
                            ].join(" "),
                      ].join(" ")}
                    >
                      <span className="text-[11px] font-bold uppercase tracking-[0.4px] text-[var(--muted-col)]">
                        {row.label}
                      </span>
                      {row.phone ? (
                        <a
                          href={`tel:${row.value}`}
                          className="w-fit text-[15px] font-bold text-[var(--teal)] underline-offset-2 hover:underline md:text-[16px]"
                        >
                          {row.value}
                        </a>
                      ) : (
                        <span className="text-[15px] font-bold text-[var(--ink)] md:text-[16px]">
                          {row.value}
                        </span>
                      )}
                    </div>
                  )
                })}
              </div>
            )
          })()}
        </div>

        {/* Швидка зміна статусу */}
        <div className="mx-4 mb-4 md:mx-6">
          <span className="mb-2 block text-[11px] font-bold uppercase tracking-[0.4px] text-[var(--muted-col)]">
            Статус
          </span>
          <div className="flex flex-wrap gap-2">
            {STATUSES.map((s) => {
              const active = status === s
              const style = statusStyle(s)
              return (
                <button
                  key={s}
                  type="button"
                  disabled={savingStatus}
                  onClick={() => handleStatusChange(s)}
                  className={[
                    "rounded-full border px-3 py-1.5 text-[13px] font-semibold transition active:scale-[0.97] disabled:opacity-60",
                    active ? "border-transparent" : "glass border-transparent text-[var(--ink-2)]",
                  ].join(" ")}
                  style={active ? { background: style.bg, color: style.text } : undefined}
                >
                  {s}
                </button>
              )
            })}
          </div>
        </div>

        </div>
        {/* кінець прокручуваної частини */}

        {/* Дії — закріплені знизу */}
        <div
          className="grid shrink-0 grid-cols-2 gap-2.5 border-t border-[var(--line)] px-4 pt-3 pb-4 md:gap-3 md:px-6 md:py-4"
          style={{ paddingBottom: "max(env(safe-area-inset-bottom), 16px)" }}
        >
          <a
            href={`tel:${appointment.phone}`}
            className="col-span-2 flex h-11 items-center justify-center gap-2 rounded-xl bg-[var(--teal)] text-[14px] font-semibold text-[var(--on-teal)] transition-transform active:scale-[0.98] md:h-12 md:rounded-2xl md:shadow-lg md:shadow-black/15"
          >
            <svg viewBox="0 0 24 24" className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
              <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07A19.5 19.5 0 0 1 4.69 12a19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 3.6 1.27h3a2 2 0 0 1 2 1.72c.127.96.361 1.903.7 2.81a2 2 0 0 1-.45 2.11L7.91 8.91a16 16 0 0 0 6.08 6.08l.98-.98a2 2 0 0 1 2.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0 1 22 16.92z"/>
            </svg>
            Подзвонити
          </a>
          {!confirmDelete && (
            <button
              type="button"
              onClick={() => { onClose(); onDuplicate(appointment) }}
              className="col-span-2 flex h-11 items-center justify-center gap-2 rounded-xl border border-[var(--line)] bg-[var(--paper)] text-[14px] font-semibold text-[var(--ink-2)] transition-transform active:scale-[0.98] md:h-12 md:rounded-2xl"
            >
              <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                <path d="M17 1l4 4-4 4" /><path d="M3 11V9a4 4 0 0 1 4-4h14" /><path d="M7 23l-4-4 4-4" /><path d="M21 13v2a4 4 0 0 1-4 4H3" />
              </svg>
              Повторити запис
            </button>
          )}
          {canDelete && confirmDelete ? (
            <>
              <button
                type="button"
                onClick={() => setConfirmDelete(false)}
                className="h-11 rounded-xl border border-[var(--line)] bg-[var(--paper)] text-[13px] font-semibold text-[var(--ink-2)] transition-transform active:scale-[0.98] md:h-12 md:rounded-2xl"
              >
                Скасувати
              </button>
              <button
                type="button"
                disabled={deleting}
                onClick={handleDelete}
                className="h-11 rounded-xl bg-red-500 text-[13px] font-semibold text-white transition-transform active:scale-[0.98] disabled:opacity-60 md:h-12 md:rounded-2xl"
              >
                {deleting ? "Видаляю…" : "Так, видалити"}
              </button>
            </>
          ) : (
            <>
              <button
                type="button"
                onClick={() => { onClose(); onEdit(appointment) }}
                className={`h-11 rounded-xl border border-[var(--line)] bg-[var(--paper)] text-[14px] font-semibold text-[var(--ink-2)] transition-transform active:scale-[0.98] md:h-12 md:rounded-2xl ${canDelete ? "" : "col-span-2"}`}
              >
                Редагувати
              </button>
              {canDelete && (
                <button
                  type="button"
                  onClick={() => setConfirmDelete(true)}
                  className="h-11 rounded-xl border border-red-200 bg-red-50 text-[14px] font-semibold text-red-600 transition-transform active:scale-[0.98] md:h-12 md:rounded-2xl"
                >
                  Видалити
                </button>
              )}
            </>
          )}
        </div>
      </SheetContent>
    </Sheet>
  )
}
