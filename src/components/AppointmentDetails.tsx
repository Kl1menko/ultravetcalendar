"use client"

import { useState } from "react"
import { Sheet, SheetContent } from "@/components/ui/sheet"
import { Appointment } from "@/types"
import { minutesFromTime, durationLabel, formatShortDate } from "@/lib/utils-app"
import { doctorColor } from "@/lib/doctors"
import { deleteAppointment } from "@/lib/appointments"

type Props = {
  appointment: Appointment | null
  onClose: () => void
  onEdit: (appt: Appointment) => void
  onDeleted: () => void
}

export default function AppointmentDetails({
  appointment,
  onClose,
  onEdit,
  onDeleted,
}: Props) {
  const [deleting, setDeleting] = useState(false)

  if (!appointment) return null

  const durMins = minutesFromTime(appointment.end) - minutesFromTime(appointment.start)
  const color = doctorColor(appointment.doctor)

  const handleDelete = async () => {
    if (!confirm(`Видалити запис: ${appointment.pet} — ${appointment.service}?`)) return
    setDeleting(true)
    await deleteAppointment(appointment.id)
    setDeleting(false)
    onDeleted()
    onClose()
  }

  return (
    <Sheet open={!!appointment} onOpenChange={(v) => !v && onClose()}>
      <SheetContent
        side="bottom"
        className="max-h-[92svh] overflow-y-auto px-0 pb-0 rounded-t-[20px]"
      >
        {/* Handle */}
        <div className="w-10 h-1 mx-auto mb-3 mt-1.5 rounded-full bg-[var(--line)]" />

        {/* Hero block — кольоровий акцент лікаря */}
        <div
          className="mx-4 mb-4 rounded-2xl px-4 py-3.5"
          style={{ background: color.bg }}
        >
          {/* Дата */}
          <div className="flex items-center justify-end mb-2">
            <span className="text-[12px] font-semibold" style={{ color: color.border }}>
              {formatShortDate(new Date(appointment.date + "T12:00:00"))}
            </span>
          </div>

          {/* Тварина + послуга */}
          <h2 className="text-[22px] font-black leading-tight text-[var(--ink)] mb-0.5">
            {appointment.pet}
          </h2>
          <p className="text-[15px] font-semibold" style={{ color: color.text }}>
            {appointment.service}
          </p>

          {/* Час */}
          <div className="flex items-center gap-2 mt-2.5">
            <span className="text-[13px] font-bold text-[var(--ink)]">
              {appointment.start}–{appointment.end}
            </span>
            <span className="text-[12px] text-[var(--muted-col)]">
              {durationLabel(durMins)}
            </span>
            {appointment.price > 0 && (
              <>
                <span className="text-[var(--line)]">·</span>
                <span className="text-[13px] font-bold" style={{ color: color.border }}>
                  {Number(appointment.price).toLocaleString("uk-UA")} ₴
                </span>
              </>
            )}
          </div>
        </div>

        {/* Інфо-рядки */}
        <div className="mx-4 rounded-2xl border border-[var(--line)] overflow-hidden mb-4">
          {[
            { label: "Клієнт", value: appointment.client },
            { label: "Телефон", value: appointment.phone },
            { label: "Тварина", value: appointment.animal || appointment.pet },
            { label: "Лікар", value: appointment.doctor },
            ...(appointment.comment ? [{ label: "Коментар", value: appointment.comment }] : []),
          ].map((row, i, arr) => (
            <div
              key={i}
              className={`flex justify-between items-baseline px-4 py-2.5 ${
                i < arr.length - 1 ? "border-b border-[var(--line)]" : ""
              }`}
            >
              <span className="text-[12px] text-[var(--muted-col)] font-semibold flex-shrink-0 mr-3">
                {row.label}
              </span>
              <span className="text-[13px] font-semibold text-[var(--ink)] text-right">
                {row.value}
              </span>
            </div>
          ))}
        </div>

        {/* Дії */}
        <div
          className="px-4 pt-3 pb-4 border-t border-[var(--line)] grid grid-cols-2 gap-2.5"
          style={{ paddingBottom: "max(env(safe-area-inset-bottom), 16px)" }}
        >
          <a
            href={`tel:${appointment.phone}`}
            className="col-span-2 rounded-xl bg-[var(--teal)] text-white h-11 font-semibold text-[14px] flex items-center justify-center gap-2 active:scale-[0.98] transition-transform"
          >
            <svg viewBox="0 0 24 24" className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
              <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07A19.5 19.5 0 0 1 4.69 12a19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 3.6 1.27h3a2 2 0 0 1 2 1.72c.127.96.361 1.903.7 2.81a2 2 0 0 1-.45 2.11L7.91 8.91a16 16 0 0 0 6.08 6.08l.98-.98a2 2 0 0 1 2.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0 1 22 16.92z"/>
            </svg>
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
            className="rounded-xl border border-red-200 bg-red-50 text-red-600 h-11 font-semibold text-[14px] active:scale-[0.98] transition-transform disabled:opacity-60"
          >
            {deleting ? "Видаляю…" : "Видалити"}
          </button>
        </div>
      </SheetContent>
    </Sheet>
  )
}
