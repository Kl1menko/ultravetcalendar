"use client"

import { useState } from "react"
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet"
import { Appointment } from "@/types"
import { STATUSES } from "@/lib/constants"
import { minutesFromTime, durationLabel, formatShortDate } from "@/lib/utils-app"
import { updateAppointment, deleteAppointment } from "@/lib/appointments"

type Props = {
  appointment: Appointment | null
  onClose: () => void
  onEdit: (appt: Appointment) => void
  onDeleted: () => void
  onStatusChanged: () => void
}

export default function AppointmentDetails({
  appointment,
  onClose,
  onEdit,
  onDeleted,
  onStatusChanged,
}: Props) {
  const [deleting, setDeleting] = useState(false)

  if (!appointment) return null

  const durMins = minutesFromTime(appointment.end) - minutesFromTime(appointment.start)
  const priceStr = appointment.price
    ? Number(appointment.price).toLocaleString("uk-UA") + " ₴"
    : null

  const handleStatusChange = async (newStatus: string) => {
    await updateAppointment(appointment.id, { status: newStatus })
    onStatusChanged()
    onClose()
  }

  const handleDelete = async () => {
    if (!confirm(`Видалити запис: ${appointment.pet} — ${appointment.service}?`)) return
    setDeleting(true)
    await deleteAppointment(appointment.id)
    setDeleting(false)
    onDeleted()
    onClose()
  }

  const rows = [
    { label: "Клієнт", value: appointment.client },
    { label: "Телефон", value: appointment.phone },
    { label: "Тварина", value: appointment.animal || appointment.pet },
    { label: "Лікар", value: appointment.doctor },
    { label: "Статус", value: appointment.status },
    ...(priceStr ? [{ label: "Ціна", value: priceStr }] : []),
    ...(appointment.comment ? [{ label: "Коментар", value: appointment.comment }] : []),
  ]

  return (
    <Sheet open={!!appointment} onOpenChange={(v) => !v && onClose()}>
      <SheetContent
        side="bottom"
        className="max-h-[88svh] overflow-y-auto px-4 pb-6 rounded-t-[18px]"
      >
        {/* Handle bar */}
        <div className="w-10 h-1 mx-auto mb-4 mt-1 rounded-full bg-[var(--line)]" />

        <SheetHeader className="mb-0 text-left">
          <SheetTitle className="text-[20px] font-black text-[var(--ink)] text-left">
            {appointment.pet} — {appointment.service}
          </SheetTitle>
        </SheetHeader>

        <p className="text-[13px] text-[var(--muted-col)] font-medium mt-1 mb-4">
          {appointment.start}–{appointment.end} ({durationLabel(durMins)}) ·{" "}
          {formatShortDate(new Date(appointment.date + "T12:00:00"))}
        </p>

        {/* Detail grid */}
        <div className="rounded-2xl border border-[var(--line)] overflow-hidden mb-4">
          {rows.map((row, i) => (
            <div
              key={i}
              className={`flex justify-between items-baseline px-4 py-3 ${
                i < rows.length - 1 ? "border-b border-[var(--line)]" : ""
              }`}
            >
              <span className="text-[12px] text-[var(--muted-col)] font-semibold flex-shrink-0">
                {row.label}
              </span>
              <strong className="text-[13px] font-bold text-[var(--ink)] text-right break-words">
                {row.value}
              </strong>
            </div>
          ))}
        </div>

        {/* Quick status change */}
        <label className="flex flex-col gap-1.5 mb-5">
          <span className="text-[11px] font-bold text-[var(--muted-col)] uppercase tracking-[0.4px]">
            Швидка зміна статусу
          </span>
          <select
            defaultValue={appointment.status}
            onChange={(e) => handleStatusChange(e.target.value)}
            className="w-full rounded-xl border border-[var(--teal-mid)] h-11 px-3 text-[15px] font-semibold text-[var(--ink)] outline-none focus:border-[var(--teal)] bg-white"
          >
            {STATUSES.map((s) => (
              <option key={s}>{s}</option>
            ))}
          </select>
        </label>

        {/* Actions */}
        <div className="flex flex-col gap-2.5">
          <a
            href={`tel:${appointment.phone}`}
            className="rounded-xl bg-[var(--teal)] text-white h-11 font-semibold text-[14px] text-center flex items-center justify-center"
          >
            Подзвонити
          </a>
          <button
            type="button"
            onClick={() => { onClose(); onEdit(appointment) }}
            className="rounded-xl border border-[var(--line)] bg-[var(--paper)] h-11 font-semibold text-[14px] text-[var(--ink-2)] active:scale-[0.98] transition-transform"
          >
            Редагувати
          </button>
          <button
            type="button"
            disabled={deleting}
            onClick={handleDelete}
            className="rounded-xl bg-red-500 text-white h-11 font-semibold text-[14px] active:scale-[0.98] transition-transform disabled:opacity-60"
          >
            {deleting ? "Видаляю…" : "Видалити"}
          </button>
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl border border-[var(--line)] h-11 font-semibold text-[14px] text-[var(--muted-col)] active:scale-[0.98] transition-transform"
          >
            Закрити
          </button>
        </div>
      </SheetContent>
    </Sheet>
  )
}
