"use client"

import { useState, useEffect, useRef } from "react"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Appointment } from "@/types"
import { doctorColor } from "@/lib/doctors"
import { formatShortDate } from "@/lib/utils-app"

type Props = {
  open: boolean
  onClose: () => void
  appointments: Appointment[]
  onSelectAppointment: (appt: Appointment) => void
}

export default function SearchDialog({ open, onClose, appointments, onSelectAppointment }: Props) {
  const [query, setQuery] = useState("")
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (open) {
      setQuery("")
      setTimeout(() => inputRef.current?.focus(), 100)
    }
  }, [open])

  const results = query.trim()
    ? appointments.filter((a) =>
        [a.client, a.pet, a.phone].join(" ").toLowerCase().includes(query.trim().toLowerCase())
      )
    : []

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-[420px] max-h-[80svh] flex flex-col gap-0 p-0 rounded-[18px] overflow-hidden">
        <DialogHeader className="px-4 pt-4 pb-2">
          <DialogTitle>Пошук</DialogTitle>
        </DialogHeader>

        {/* Search input */}
        <div className="relative px-4 pb-2">
          <svg
            className="absolute left-7 top-1/2 -translate-y-1/2 w-[15px] h-[15px] text-[var(--muted-col)] pointer-events-none"
            viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"
          >
            <circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/>
          </svg>
          <input
            ref={inputRef}
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Клієнт, кличка або телефон"
            autoComplete="off"
            autoCorrect="off"
            spellCheck={false}
            className="w-full pl-9 pr-8 py-2.5 rounded-xl border-[1.5px] border-[var(--line)] bg-[var(--paper)] text-base text-[var(--ink)] outline-none focus:border-[var(--teal)] transition-colors"
          />
          {query && (
            <button
              type="button"
              onClick={() => setQuery("")}
              className="absolute right-7 top-1/2 -translate-y-1/2 w-5 h-5 rounded-full bg-[var(--muted-col)] text-white flex items-center justify-center"
              aria-label="Очистити"
            >
              <svg viewBox="0 0 24 24" className="w-3 h-3" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round">
                <path d="M18 6 6 18M6 6l12 12"/>
              </svg>
            </button>
          )}
        </div>

        {/* Results */}
        <div className="flex-1 overflow-y-auto px-4 pb-4">
          {!query.trim() && (
            <p className="py-5 text-center text-[13px] text-[var(--muted-col)]">
              Введіть ім&apos;я клієнта, кличку або номер телефону
            </p>
          )}

          {query.trim() && results.length === 0 && (
            <div className="py-8 border-[1.5px] border-dashed border-[var(--line)] rounded-xl text-center text-[14px] text-[var(--muted-col)] mt-2">
              Нічого не знайдено.
            </div>
          )}

          {results.length > 0 && (
            <div className="grid gap-2 mt-1">
              {results.map((item) => {
                const color = doctorColor(item.doctor)
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => { onClose(); onSelectAppointment(item) }}
                    className="grid grid-cols-[44px_1fr] gap-2 w-full min-h-16 p-2.5 border-[1.5px] border-[var(--line)] rounded-lg bg-white text-left shadow-sm active:scale-[0.985] transition-transform"
                    style={{ borderLeft: `4px solid ${color.border}`, background: color.bg }}
                  >
                    <span className="text-sm font-black" style={{ color: color.border }}>{item.start}</span>
                    <span className="min-w-0">
                      <strong className="block text-[13px] font-bold text-[var(--ink)] truncate">
                        {item.pet} — {item.service}
                      </strong>
                      <span className="block text-[11px] text-[var(--muted-col)]">
                        {item.doctor} · {item.client}
                      </span>
                      <span className="block text-[10px] text-[var(--muted-col)]">
                        {formatShortDate(new Date(item.date + "T12:00:00"))}
                      </span>
                    </span>
                  </button>
                )
              })}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}
