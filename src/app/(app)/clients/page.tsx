"use client"

import { useState, useMemo } from "react"
import { motion } from "motion/react"
import { useCalendarContext } from "@/context/calendar"
import { staggerContainer, staggerItem } from "@/lib/motion"
import { formatShortDate } from "@/lib/utils-app"
import { phoneMatches, hasDigits, digitsOnly } from "@/lib/phone"
import { deleteAppointment } from "@/lib/appointments"
import { isoDate } from "@/lib/utils-app"
import { buildClients } from "@/lib/clients"
import { Appointment } from "@/types"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { CalendarClock, ChevronDown, Check, Copy, MessageCircle, Phone, PawPrint, Search, X } from "lucide-react"

/** Посилання на WhatsApp у міжнародному форматі (укр. номери). */
function whatsappLink(phone: string) {
  const d = digitsOnly(phone)
  const intl = d.length === 10 && d.startsWith("0") ? "38" + d : d
  return `https://wa.me/${intl}`
}

/** Майбутній/активний візит — дата ≥ сьогодні і не скасований/завершений. */
function isUpcoming(a: Appointment, today: string) {
  return a.date >= today && a.status !== "Скасовано" && a.status !== "Завершено"
}

function clientsCountLabel(count: number) {
  if (count === 1) return "клієнт"
  if (count > 1 && count < 5) return "клієнти"
  return "клієнтів"
}

export default function ClientsPage() {
  const { appointments, reload, canSeeClients, role } = useCalendarContext()
  // Видалення картки клієнта (масове видалення історії) — лише head/admin.
  const canDeleteClient = role === "head" || role === "admin"
  const [query, setQuery] = useState("")
  const [scope, setScope] = useState<"all" | "duplicates">("all")
  const [expanded, setExpanded] = useState<string | null>(null)
  const [confirmDeleteKey, setConfirmDeleteKey] = useState<string | null>(null)
  const [deletingKey, setDeletingKey] = useState<string | null>(null)
  const [copiedKey, setCopiedKey] = useState<string | null>(null)
  const today = useMemo(() => isoDate(new Date()), [])

  const handleCopyPhone = async (key: string, phone: string) => {
    try {
      await navigator.clipboard.writeText(phone)
      setCopiedKey(key)
      setTimeout(() => setCopiedKey((k) => (k === key ? null : k)), 1500)
    } catch {
      /* clipboard недоступний — мовчки ігноруємо */
    }
  }

  const handleDeleteClient = async (key: string, history: Appointment[]) => {
    setDeletingKey(key)
    await Promise.all(history.map((a) => deleteAppointment(a.id)))
    setDeletingKey(null)
    setConfirmDeleteKey(null)
    setExpanded(null)
    reload()
  }

  const allClients = useMemo(() => buildClients(appointments), [appointments])
  const duplicatesCount = allClients.filter((client) => client.duplicateCount > 1).length

  const filtered = useMemo(() => {
    const raw = query.trim()
    const base = scope === "duplicates"
      ? allClients.filter((client) => client.duplicateCount > 1)
      : allClients

    if (!raw) return base
    const q = raw.toLowerCase()
    return base.filter((c) => {
      // Текстовий матч — ім'я клієнта / клички тварин.
      const text = [c.client, ...[...c.pets.keys()]].join(" ").toLowerCase().includes(q)
      // Телефонний матч — нормалізований номер (формат вводу не важливий).
      const phone = hasDigits(raw) && phoneMatches(c.phone, raw)
      return text || phone
    })
  }, [allClients, query, scope])

  const toggle = (key: string) => setExpanded((prev) => (prev === key ? null : key))

  if (!canSeeClients) {
    return (
      <div className="px-4 pt-4 md:px-0 md:pt-0">
        <header className="pb-4 md:desktop-page-header md:px-6 md:py-5">
          <h1 className="text-[22px] font-bold text-[var(--ink)] md:text-[28px]">Клієнти</h1>
        </header>
        <div className="glass mx-auto mt-6 max-w-md rounded-2xl px-5 py-8 text-center">
          <p className="text-[15px] font-bold text-[var(--ink)]">Доступ обмежено</p>
          <p className="mt-1.5 text-[13px] text-[var(--muted-col)]">
            База клієнтів доступна лише лікарям. Зверніться до головного лікаря.
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="pb-6 md:flex md:flex-col md:gap-5 md:px-0 md:pt-0">
      {/* Header */}
      <header className="px-4 pt-4 pb-3 md:desktop-page-header md:px-6 md:py-5">
        <div className="flex items-end justify-between gap-3">
          <div>
            <h1 className="text-[24px] font-bold leading-tight text-[var(--ink)] md:text-[28px]">
              Клієнти
              {allClients.length > 0 && (
                <span className="ml-2 text-[16px] font-medium text-[var(--muted-col)]">{allClients.length}</span>
              )}
            </h1>
          </div>
          {allClients.length > 0 && (
            <div className="hidden text-right md:block">
              <div className="text-[11px] font-medium uppercase tracking-[0.4px] text-[var(--muted-col)]">Показано</div>
              <div className="text-[18px] font-semibold text-[var(--ink)]">{filtered.length}</div>
            </div>
          )}
        </div>
      </header>

      {/* Search */}
      <div className="mb-3 px-4 md:mb-0 md:px-0">
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--muted-col)]" />
          <Input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Ім'я, кличка або телефон"
            autoComplete="off"
            autoCorrect="off"
            spellCheck={false}
            className="search-field h-11 rounded-xl pl-10 pr-10 text-[14px] text-[var(--ink)] focus-visible:ring-0 md:h-12 md:rounded-2xl"
          />
          {query && (
            <button type="button" onClick={() => setQuery("")} className="absolute right-3 top-1/2 flex h-6 w-6 -translate-y-1/2 items-center justify-center rounded-md text-[var(--muted-col)] hover:bg-[var(--paper)] hover:text-[var(--ink)]">
              <X className="h-4 w-4" />
            </button>
          )}
        </div>
      </div>

      {/* Scope */}
      <div className="mb-4 flex gap-2 overflow-x-auto px-4 md:mb-0 md:px-0">
        {[
          { key: "all" as const, label: "Усі", count: allClients.length },
          { key: "duplicates" as const, label: "Дублі", count: duplicatesCount },
        ].map((item) => {
          const active = scope === item.key
          return (
            <button
              key={item.key}
              type="button"
              onClick={() => setScope(item.key)}
              className={`flex h-9 items-center gap-2 rounded-lg border px-3 text-[13px] font-semibold transition-colors ${
                active
                  ? "border-[var(--teal)] bg-[var(--teal)] text-[var(--on-teal)] shadow-sm"
                  : "glass-chip border-transparent text-[var(--ink-2)]"
              }`}
            >
              <span>{item.label}</span>
              <span className={`rounded-md px-1.5 py-0.5 text-[11px] ${active ? "bg-[var(--on-teal)]/15 text-[var(--on-teal)]" : "bg-[var(--paper)] text-[var(--muted-col)]"}`}>
                {item.count}
              </span>
            </button>
          )
        })}
      </div>

      {/* List */}
      {filtered.length === 0 ? (
        <div className="glass mx-4 rounded-2xl py-8 text-center text-[14px] text-[var(--muted-col)] md:mx-0">
          {query ? "Нічого не знайдено." : "Клієнтів поки немає."}
        </div>
      ) : (
        <motion.div
          key={query.trim().toLowerCase()}
          variants={staggerContainer}
          initial="hidden"
          animate="visible"
          className="flex flex-col gap-2 px-3 md:grid md:grid-cols-2 md:gap-2.5 md:px-0 xl:grid-cols-3"
        >
          {filtered.map((c) => {
            const key = `${c.client}-${c.phone}`
            const isOpen = expanded === key
            const initials = c.client.trim().split(" ").map((w) => w[0]).join("").slice(0, 2).toUpperCase()
            const pets = [...c.pets.entries()]
            const sortedHistory = [...c.history].sort((a, b) =>
              `${b.date} ${b.start}`.localeCompare(`${a.date} ${a.start}`)
            )
            // Майбутні візити — окремим блоком зверху (від найближчого).
            const upcoming = sortedHistory
              .filter((a) => isUpcoming(a, today))
              .sort((a, b) => `${a.date} ${a.start}`.localeCompare(`${b.date} ${b.start}`))

            return (
              <motion.div key={key} variants={staggerItem} className={`glass glass-hover overflow-hidden rounded-xl transition-colors md:rounded-lg ${
                c.duplicateCount > 1 ? "border-amber-200" : ""
              }`}>

                {/* Main row */}
                <button
                  type="button"
                  onClick={() => toggle(key)}
                  className="flex w-full items-center gap-2.5 p-2.5 text-left transition-colors active:bg-[var(--paper)] md:gap-3 md:p-4"
                >
                  {/* Avatar */}
                  <div className="relative grid h-9 w-9 flex-shrink-0 place-items-center rounded-xl bg-[var(--paper)] text-[12px] font-semibold text-[var(--ink-2)] md:h-11 md:w-11 md:rounded-lg md:text-[13px]">
                    <span>{initials}</span>
                    {c.duplicateCount > 1 && (
                      <span className="absolute -right-0.5 -top-0.5 h-2.5 w-2.5 rounded-full border-2 border-white bg-amber-500" />
                    )}
                  </div>

                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 pr-1">
                      <span className="truncate text-[15px] font-semibold leading-tight text-[var(--ink)]">{c.client}</span>
                      {/* Visits badge */}
                      <Badge className="h-5 flex-shrink-0 rounded-md bg-[var(--paper)] px-1.5 text-[10px] font-medium text-[var(--ink-2)] md:h-6 md:px-2 md:text-[11px]">
                        <span className="md:hidden">{c.visits}</span>
                        <span className="hidden md:inline">
                          {c.visits} {c.visits === 1 ? "візит" : c.visits < 5 ? "візити" : "візитів"}
                        </span>
                      </Badge>
                      {c.duplicateCount > 1 && (
                        <Badge className="h-5 flex-shrink-0 rounded-md bg-amber-100 px-1.5 text-[10px] font-semibold text-amber-700 md:h-6 md:px-2 md:text-[11px]">
                          дубль
                        </Badge>
                      )}
                      {upcoming.length > 0 && (
                        <Badge className="flex h-5 flex-shrink-0 items-center gap-1 rounded-md bg-[var(--teal)]/12 px-1.5 text-[10px] font-semibold text-[var(--teal-dark)] md:h-6 md:px-2 md:text-[11px]">
                          <CalendarClock className="h-3 w-3" />
                          <span>{upcoming.length}</span>
                        </Badge>
                      )}
                    </div>
                    {/* Pets */}
                    <div className="mt-1 flex min-w-0 items-center gap-1.5 text-[12px] font-medium leading-snug text-[var(--ink-2)] md:text-[13px]">
                      <PawPrint className="h-3.5 w-3.5 flex-shrink-0 text-[var(--muted-col)]" />
                      <span className="truncate">
                        {pets.map(([name, animal]) => animal && animal !== name ? `${name} (${animal})` : name).join(", ")}
                      </span>
                    </div>
                    {/* Last visit */}
                    <div className="mt-0.5 truncate text-[11px] text-[var(--muted-col)] md:text-[12px]">
                      {formatShortDate(new Date(c.last.date + "T12:00:00"))} · {c.last.service}
                    </div>
                  </div>

                  <ChevronDown className={`h-4 w-4 flex-shrink-0 text-[var(--ink)] transition-transform duration-200 ${isOpen ? "rotate-180" : ""}`} />
                </button>

                {/* Expanded details */}
                {isOpen && (
                  <div className="border-t border-[var(--line)]">
                    {/* Phone */}
                    <div className="border-b border-[var(--line)] px-4 py-3">
                      <div className="mb-0.5 text-[10px] font-medium uppercase tracking-[0.4px] text-[var(--muted-col)]">Телефон</div>
                      <a href={`tel:${c.phone}`} className="text-[14px] font-semibold tabular-nums text-[var(--ink)]">{c.phone}</a>
                      {c.duplicateCount > 1 && (
                        <div className="mt-1 text-[11px] font-medium text-amber-700">
                          Можливий дубль: {c.duplicateReason}, {c.duplicateCount} {clientsCountLabel(c.duplicateCount)}
                        </div>
                      )}
                      {/* Quick actions */}
                      <div className="mt-3 grid grid-cols-4 gap-2">
                        <a
                          href={`tel:${c.phone}`}
                          aria-label={`Подзвонити ${c.client}`}
                          className="flex h-10 flex-col items-center justify-center gap-0.5 rounded-lg bg-[var(--teal)] text-[var(--on-teal)] transition-all hover:bg-[var(--teal-dark)] active:scale-95"
                        >
                          <Phone className="h-[18px] w-[18px]" />
                        </a>
                        <a
                          href={whatsappLink(c.phone)}
                          target="_blank"
                          rel="noopener noreferrer"
                          aria-label={`Написати ${c.client} у WhatsApp`}
                          className="flex h-10 items-center justify-center rounded-lg bg-[var(--paper)] text-[var(--ink-2)] transition-all hover:bg-[var(--line)] active:scale-95"
                        >
                          <MessageCircle className="h-[18px] w-[18px]" />
                        </a>
                        <a
                          href={`sms:${c.phone}`}
                          aria-label={`SMS ${c.client}`}
                          className="flex h-10 items-center justify-center rounded-lg bg-[var(--paper)] text-[var(--ink-2)] transition-all hover:bg-[var(--line)] active:scale-95"
                        >
                          <span className="text-[12px] font-semibold">SMS</span>
                        </a>
                        <button
                          type="button"
                          onClick={() => handleCopyPhone(key, c.phone)}
                          aria-label="Скопіювати телефон"
                          className="flex h-10 items-center justify-center rounded-lg bg-[var(--paper)] text-[var(--ink-2)] transition-all hover:bg-[var(--line)] active:scale-95"
                        >
                          {copiedKey === key ? (
                            <Check className="h-[18px] w-[18px] text-[var(--teal)]" />
                          ) : (
                            <Copy className="h-[18px] w-[18px]" />
                          )}
                        </button>
                      </div>
                    </div>

                    {/* Upcoming visits */}
                    {upcoming.length > 0 && (
                      <div className="border-b border-[var(--line)] bg-[var(--teal)]/[0.04] px-4 py-3">
                        <div className="mb-2 flex items-center gap-1.5 text-[10px] font-medium uppercase tracking-[0.4px] text-[var(--teal-dark)]">
                          <CalendarClock className="h-3 w-3" />
                          Заплановані візити ({upcoming.length})
                        </div>
                        <div className="flex flex-col gap-1.5">
                          {upcoming.map((a) => (
                            <div key={a.id} className="flex items-center gap-2.5 rounded-xl border border-[var(--teal)]/20 bg-white/50 px-3 py-2">
                              <div className="flex flex-col items-center justify-center rounded-lg bg-[var(--teal)]/10 px-2 py-1 text-center">
                                <span className="text-[11px] font-semibold tabular-nums leading-none text-[var(--teal-dark)]">
                                  {formatShortDate(new Date(a.date + "T12:00:00"))}
                                </span>
                                <span className="mt-0.5 text-[10px] font-medium tabular-nums leading-none text-[var(--muted-col)]">{a.start}</span>
                              </div>
                              <div className="min-w-0 flex-1">
                                <div className="truncate text-[12px] font-medium text-[var(--ink)]">{a.service}</div>
                                <div className="mt-0.5 flex min-w-0 items-center gap-1.5 text-[11px] text-[var(--muted-col)]">
                                  <span className="truncate font-medium text-[var(--ink-2)]">{a.pet}</span>
                                  <span>·</span>
                                  <span className="truncate">{a.status}</span>
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Pets list */}
                    {pets.length > 0 && (
                      <div className="border-b border-[var(--line)] px-4 py-3">
                        <div className="mb-2 text-[10px] font-medium uppercase tracking-[0.4px] text-[var(--muted-col)]">Тварини</div>
                        <div className="flex flex-col gap-1.5">
                          {pets.map(([name, animal]) => (
                            <div key={name} className="flex items-center gap-2">
                              <PawPrint className="h-3.5 w-3.5 text-[var(--teal)]" />
                              <span className="text-[13px] font-medium text-[var(--ink)]">{name}</span>
                              {animal && animal !== name && (
                                <span className="text-[11px] text-[var(--muted-col)]">{animal}</span>
                              )}
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Visit history */}
                    <div className="border-b border-[var(--line)] px-4 py-3">
                      <div className="mb-2 text-[10px] font-medium uppercase tracking-[0.4px] text-[var(--muted-col)]">
                        Історія візитів ({c.visits})
                      </div>
                      <div className="relative space-y-2 pl-4 before:absolute before:bottom-2 before:left-[5px] before:top-2 before:w-px before:bg-[var(--line)]">
                        {sortedHistory.map((a, index) => (
                          <div key={a.id} className="relative grid grid-cols-[54px_minmax(0,1fr)] gap-2">
                            <span className={`absolute -left-[15px] top-2 h-2.5 w-2.5 rounded-full border-2 border-white ${
                              index === 0 ? "bg-[var(--teal)]" : "bg-[var(--uv-gray-300)]"
                            }`} />
                            <div className="pt-0.5 text-right">
                              <div className="text-[10px] font-semibold tabular-nums text-[var(--ink-2)]">
                                {formatShortDate(new Date(a.date + "T12:00:00"))}
                              </div>
                              <div className="text-[10px] font-medium tabular-nums text-[var(--muted-col)]">{a.start}</div>
                            </div>
                            <div className="min-w-0 rounded-xl border border-[var(--line)] bg-white/35 px-3 py-2">
                              <div className="truncate text-[12px] font-medium text-[var(--ink)]">{a.service}</div>
                              <div className="mt-0.5 flex min-w-0 items-center gap-1.5 text-[11px] text-[var(--muted-col)]">
                                <span className="truncate font-medium text-[var(--ink-2)]">{a.pet}</span>
                                <span>·</span>
                                <span className="truncate">{a.doctor.split(" ")[0]}</span>
                                {a.status && (
                                  <>
                                    <span>·</span>
                                    <span className="truncate">{a.status}</span>
                                  </>
                                )}
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Delete client — лише head/admin */}
                    {canDeleteClient && (
                    <div className="px-4 py-3">
                      {confirmDeleteKey === key ? (
                        <div className="flex gap-2">
                          <Button
                            variant="outline"
                            onClick={() => setConfirmDeleteKey(null)}
                            className="h-9 flex-1 rounded-lg border-[var(--line)] bg-[var(--paper)] text-[13px] font-semibold text-[var(--ink-2)]"
                          >
                            Скасувати
                          </Button>
                          <Button
                            disabled={deletingKey === key}
                            onClick={() => handleDeleteClient(key, c.history)}
                            className="h-9 flex-1 rounded-lg bg-red-500 text-[13px] font-semibold text-white hover:bg-red-600"
                          >
                            {deletingKey === key ? "Видаляю…" : `Так, видалити (${c.visits})`}
                          </Button>
                        </div>
                      ) : (
                        <Button
                          variant="destructive"
                          onClick={() => setConfirmDeleteKey(key)}
                          className="h-9 w-full rounded-lg border border-red-200 bg-red-50 text-[13px] font-semibold text-red-600 hover:bg-red-100"
                        >
                          Видалити клієнта
                        </Button>
                      )}
                    </div>
                    )}
                  </div>
                )}
              </motion.div>
            )
          })}
        </motion.div>
      )}
    </div>
  )
}
