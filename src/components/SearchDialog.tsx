"use client"

import { useState, useEffect, useRef } from "react"
import { motion } from "motion/react"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Appointment } from "@/types"
import { doctorColor, doctorShortName } from "@/lib/doctors"
import { staggerContainer, staggerItem } from "@/lib/motion"
import { formatShortDate } from "@/lib/utils-app"
import { phoneMatches, hasDigits } from "@/lib/phone"

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
      const timer = window.setTimeout(() => {
        setQuery("")
        inputRef.current?.focus()
      }, 100)

      return () => window.clearTimeout(timer)
    }
  }, [open])

  const q = query.trim()
  const results = q
    ? appointments.filter((a) => {
        // Текстовий матч — ім'я клієнта / кличка тварини.
        const text = [a.client, a.pet].join(" ").toLowerCase().includes(q.toLowerCase())
        // Телефонний матч — нормалізований номер (формат вводу не важливий),
        // пробуємо лише коли в запиті є цифри.
        const phone = hasDigits(q) && phoneMatches(a.phone, q)
        return text || phone
      })
    : []

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="flex max-h-[80svh] max-w-[420px] flex-col gap-0 overflow-hidden rounded-[18px] border-white/80 p-0 shadow-[0_24px_80px_rgba(17,24,39,0.22)] md:max-h-[78dvh] md:max-w-[720px] md:rounded-[28px]">
        <DialogHeader className="border-b border-[var(--line)] bg-[linear-gradient(135deg,#fff,#fafafa)] px-4 pt-4 pb-3 text-left md:px-6 md:pt-5 md:pb-4">
          <DialogTitle className="text-[22px] font-bold tracking-tight text-[var(--ink)] md:text-[26px]">Пошук</DialogTitle>
        </DialogHeader>

        {/* Search input */}
        <div className="relative px-4 py-3 md:px-6 md:py-5">
          <svg
            className="pointer-events-none absolute left-7 top-1/2 h-[15px] w-[15px] -translate-y-1/2 text-[var(--muted-col)] md:left-10 md:h-5 md:w-5"
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
            className="search-field w-full rounded-xl py-2.5 pl-9 pr-8 text-base text-[var(--ink)] outline-none transition-colors md:h-14 md:rounded-2xl md:pl-12 md:pr-12 md:text-[18px]"
          />
          {query && (
            <button
              type="button"
              onClick={() => setQuery("")}
              className="absolute right-7 top-1/2 flex h-5 w-5 -translate-y-1/2 items-center justify-center rounded-full bg-[var(--muted-col)] text-white md:right-10"
              aria-label="Очистити"
            >
              <svg viewBox="0 0 24 24" className="w-3 h-3" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round">
                <path d="M18 6 6 18M6 6l12 12"/>
              </svg>
            </button>
          )}
        </div>

        {/* Results */}
        <div className="flex-1 overflow-y-auto px-4 pb-4 md:px-6 md:pb-6">
          {!query.trim() && (
            <p className="py-5 text-center text-[13px] text-[var(--muted-col)]">
              Введіть ім&apos;я клієнта, кличку або номер телефону
            </p>
          )}

          {query.trim() && results.length === 0 && (
            <div className="mt-2 rounded-xl border-[1.5px] border-dashed border-[var(--line)] bg-[var(--paper)] py-8 text-center text-[14px] text-[var(--muted-col)] md:rounded-2xl">
              Нічого не знайдено.
            </div>
          )}

          {results.length > 0 && (
            <motion.div
              key={query.trim().toLowerCase()}
              variants={staggerContainer}
              initial="hidden"
              animate="visible"
              className="mt-1 grid gap-2 md:grid-cols-2 md:gap-3"
            >
              {results.map((item) => {
                const color = doctorColor(item.doctor)
                return (
                  <motion.button
                    key={item.id}
                    variants={staggerItem}
                    type="button"
                    onClick={() => { onClose(); onSelectAppointment(item) }}
                    className="grid min-h-16 w-full grid-cols-[44px_1fr] gap-2 rounded-lg border-[1.5px] border-[var(--line)] bg-white p-2.5 text-left shadow-sm transition-all active:scale-[0.985] md:rounded-2xl md:p-3 md:hover:-translate-y-0.5 md:hover:border-[var(--teal-mid)] md:hover:shadow-[var(--desktop-soft)]"
                    style={{ borderLeft: `4px solid ${color.border}`, background: color.bg }}
                  >
                    <span className="text-sm font-bold" style={{ color: color.border }}>{item.start}</span>
                    <span className="min-w-0">
                      <strong className="block text-[13px] font-bold text-[var(--ink)] truncate">
                        {item.pet} — {item.service}
                      </strong>
                      <span className="block text-[11px] text-[var(--muted-col)]">
                        {doctorShortName(item.doctor)} · {item.client}
                      </span>
                      <span className="block text-[10px] text-[var(--muted-col)]">
                        {formatShortDate(new Date(item.date + "T12:00:00"))}
                      </span>
                    </span>
                  </motion.button>
                )
              })}
            </motion.div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}
