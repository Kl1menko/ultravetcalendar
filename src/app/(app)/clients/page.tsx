"use client"

import { useState, useMemo } from "react"
import { motion } from "motion/react"
import { useCalendarContext } from "@/context/calendar"
import { staggerContainer, staggerItem } from "@/lib/motion"
import { formatShortDate } from "@/lib/utils-app"
import { phoneMatches, hasDigits } from "@/lib/phone"
import { deleteAppointment } from "@/lib/appointments"
import { Appointment } from "@/types"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { ChevronDown, Phone, PawPrint, Search, X } from "lucide-react"

type ClientEntry = {
  client: string
  phone: string
  pets: Map<string, string>   // pet name → animal (вид/порода)
  visits: number
  last: Appointment
  history: Appointment[]
  duplicateCount: number
  duplicateReason: string
}

function normalizePetName(value: string) {
  return value.trim().toLowerCase().replace(/\s+/g, " ")
}

function normalizePhone(value: string) {
  const digits = value.replace(/\D/g, "")

  if (digits.length >= 9) {
    return digits.slice(-9)
  }

  return digits
}

function clientsCountLabel(count: number) {
  if (count === 1) return "клієнт"
  if (count > 1 && count < 5) return "клієнти"
  return "клієнтів"
}

function buildClients(appointments: Appointment[]): ClientEntry[] {
  const map = new Map<string, ClientEntry>()
  // сортуємо по даті щоб last завжди був найновішим
  const sorted = [...appointments].sort((a, b) =>
    `${b.date} ${b.start}`.localeCompare(`${a.date} ${a.start}`)
  )
  sorted.forEach((a) => {
    const key = `${a.client}-${a.phone}`
    if (!map.has(key)) {
      map.set(key, { client: a.client, phone: a.phone, pets: new Map(), visits: 0, last: a, history: [], duplicateCount: 0, duplicateReason: "" })
    }
    const entry = map.get(key)!
    entry.pets.set(a.pet, a.animal || a.pet)
    entry.visits += 1
    entry.history.push(a)
    // last — найновіший запис (sorted DESC)
    if (`${a.date} ${a.start}` > `${entry.last.date} ${entry.last.start}`) {
      entry.last = a
    }
  })
  const clients = [...map.values()]
  const duplicateGroups = new Map<string, ClientEntry[]>()

  clients.forEach((client) => {
    const phoneKey = normalizePhone(client.phone)
    const petKeys = [...new Set([...client.pets.keys()].map(normalizePetName).filter(Boolean))]
    const keys = [
      phoneKey.length >= 9 ? `phone:${phoneKey}` : "",
      ...petKeys.map((petKey) => `pet:${petKey}`),
    ].filter(Boolean)

    keys.forEach((key) => {
      const group = duplicateGroups.get(key) ?? []
      group.push(client)
      duplicateGroups.set(key, group)
    })
  })

  clients.forEach((client) => {
    const phoneKey = normalizePhone(client.phone)
    const petKeys = [...new Set([...client.pets.keys()].map(normalizePetName).filter(Boolean))]
    const groups = [
      phoneKey.length >= 9 ? { reason: "однаковий телефон", group: duplicateGroups.get(`phone:${phoneKey}`) ?? [] } : null,
      ...petKeys.map((petKey) => ({
        reason: "однакова кличка тварини",
        group: duplicateGroups.get(`pet:${petKey}`) ?? [],
      })),
    ].filter((item): item is { reason: string; group: ClientEntry[] } => Boolean(item))
    const duplicate = groups.find((item) => item.group.length > 1)

    if (duplicate) {
      client.duplicateCount = duplicate.group.length
      client.duplicateReason = duplicate.reason
    }
  })

  // сортуємо клієнтів по кількості візитів
  return clients.sort((a, b) => b.visits - a.visits)
}

export default function ClientsPage() {
  const { appointments, reload, canSeeClients } = useCalendarContext()
  const [query, setQuery] = useState("")
  const [scope, setScope] = useState<"all" | "duplicates">("all")
  const [expanded, setExpanded] = useState<string | null>(null)
  const [confirmDeleteKey, setConfirmDeleteKey] = useState<string | null>(null)
  const [deletingKey, setDeletingKey] = useState<string | null>(null)

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
          <h1 className="text-[22px] font-black text-[var(--ink)] md:text-[28px]">Клієнти</h1>
        </header>
        <div className="mx-auto mt-6 max-w-md rounded-2xl border border-dashed border-[var(--line)] bg-white/70 px-5 py-8 text-center">
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
            <h1 className="text-[24px] font-black leading-tight text-[var(--ink)] md:text-[28px]">
              Клієнти
              {allClients.length > 0 && (
                <span className="ml-2 text-[16px] font-semibold text-[var(--muted-col)]">{allClients.length}</span>
              )}
            </h1>
            {duplicatesCount > 0 && (
              <p className="mt-1 text-[13px] font-semibold text-amber-700">
                {duplicatesCount} потенційних {clientsCountLabel(duplicatesCount)} для перевірки
              </p>
            )}
          </div>
          {allClients.length > 0 && (
            <div className="hidden text-right md:block">
              <div className="text-[11px] font-bold uppercase tracking-[0.4px] text-[var(--muted-col)]">Показано</div>
              <div className="text-[18px] font-black text-[var(--ink)]">{filtered.length}</div>
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
            className="h-11 rounded-lg border-[var(--line)] bg-white pl-10 pr-10 text-[14px] text-[var(--ink)] shadow-sm focus-visible:border-[var(--teal)] focus-visible:ring-0 md:h-12"
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
              className={`flex h-9 items-center gap-2 rounded-lg border px-3 text-[13px] font-bold transition-colors ${
                active
                  ? "border-[var(--teal)] bg-[var(--teal)] text-white shadow-sm"
                  : "border-[var(--line)] bg-white text-[var(--ink-2)] hover:bg-[var(--paper)]"
              }`}
            >
              <span>{item.label}</span>
              <span className={`rounded-md px-1.5 py-0.5 text-[11px] ${active ? "bg-white/20 text-white" : "bg-[var(--paper)] text-[var(--muted-col)]"}`}>
                {item.count}
              </span>
            </button>
          )
        })}
      </div>

      {/* List */}
      {filtered.length === 0 ? (
        <div className="mx-4 rounded-2xl border border-dashed border-[var(--line)] py-8 text-center text-[14px] text-[var(--muted-col)] md:mx-0 md:bg-white/70">
          {query ? "Нічого не знайдено." : "Клієнтів поки немає."}
        </div>
      ) : (
        <motion.div
          key={query.trim().toLowerCase()}
          variants={staggerContainer}
          initial="hidden"
          animate="visible"
          className="flex flex-col gap-2.5 px-4 md:grid md:grid-cols-2 md:px-0 xl:grid-cols-3"
        >
          {filtered.map((c) => {
            const key = `${c.client}-${c.phone}`
            const isOpen = expanded === key
            const initials = c.client.trim().split(" ").map((w) => w[0]).join("").slice(0, 2).toUpperCase()
            const pets = [...c.pets.entries()]

            return (
              <motion.div key={key} variants={staggerItem} className={`desktop-card-hover overflow-hidden rounded-lg border bg-white shadow-sm transition-colors ${
                c.duplicateCount > 1 ? "border-amber-200" : "border-[var(--line)]"
              }`}>

                {/* Main row */}
                <button
                  type="button"
                  onClick={() => toggle(key)}
                  className="flex w-full items-center gap-3 p-3.5 text-left transition-colors active:bg-[var(--paper)] md:p-4"
                >
                  {/* Avatar */}
                  <div className="relative grid h-11 w-11 flex-shrink-0 place-items-center rounded-lg bg-[var(--paper)] text-[13px] font-black text-[var(--ink)]">
                    <span>{initials}</span>
                    {c.duplicateCount > 1 && (
                      <span className="absolute -right-0.5 -top-0.5 h-2.5 w-2.5 rounded-full border-2 border-white bg-amber-500" />
                    )}
                  </div>

                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 pr-1">
                      <span className="truncate text-[15px] font-black leading-tight text-[var(--ink)]">{c.client}</span>
                      {/* Visits badge */}
                      <Badge className="h-6 flex-shrink-0 rounded-md bg-[var(--paper)] px-2 text-[11px] font-bold text-[var(--ink)]">
                        {c.visits} {c.visits === 1 ? "візит" : c.visits < 5 ? "візити" : "візитів"}
                      </Badge>
                      {c.duplicateCount > 1 && (
                        <Badge className="h-6 flex-shrink-0 rounded-md bg-amber-100 px-2 text-[11px] font-bold text-amber-700">
                          дубль
                        </Badge>
                      )}
                    </div>
                    {/* Pets */}
                    <div className="mt-0.5 truncate text-[13px] font-bold leading-snug text-[var(--ink)]">
                      {pets.map(([name, animal]) => animal && animal !== name ? `${name} (${animal})` : name).join(", ")}
                    </div>
                    {/* Last visit */}
                    <div className="mt-0.5 truncate text-[12px] text-[var(--muted-col)]">
                      {c.last.service} · {formatShortDate(new Date(c.last.date + "T12:00:00"))}
                    </div>
                  </div>

                  <ChevronDown className={`h-4 w-4 flex-shrink-0 text-[var(--ink)] transition-transform duration-200 ${isOpen ? "rotate-180" : ""}`} />
                </button>

                {/* Expanded details */}
                {isOpen && (
                  <div className="border-t border-[var(--line)]">
                    {/* Phone + call */}
                    <div className="flex items-center justify-between border-b border-[var(--line)] px-4 py-3">
                      <div>
                        <div className="mb-0.5 text-[10px] font-bold uppercase tracking-[0.4px] text-[var(--muted-col)]">Телефон</div>
                      <a href={`tel:${c.phone}`} className="text-[14px] font-bold text-[var(--teal)]">{c.phone}</a>
                        {c.duplicateCount > 1 && (
                          <div className="mt-1 text-[11px] font-semibold text-amber-700">
                            Можливий дубль: {c.duplicateReason}, {c.duplicateCount} {clientsCountLabel(c.duplicateCount)}
                          </div>
                        )}
                      </div>
                      <a
                        href={`tel:${c.phone}`}
                        aria-label={`Подзвонити ${c.client}`}
                        className="grid h-10 w-10 place-items-center rounded-lg bg-[var(--teal)] text-white transition-all hover:bg-[var(--teal-dark)] active:scale-95"
                      >
                        <Phone className="h-[18px] w-[18px]" />
                      </a>
                    </div>

                    {/* Pets list */}
                    {pets.length > 0 && (
                      <div className="border-b border-[var(--line)] px-4 py-3">
                        <div className="mb-2 text-[10px] font-bold uppercase tracking-[0.4px] text-[var(--muted-col)]">Тварини</div>
                        <div className="flex flex-col gap-1.5">
                          {pets.map(([name, animal]) => (
                            <div key={name} className="flex items-center gap-2">
                              <PawPrint className="h-3.5 w-3.5 text-[var(--teal)]" />
                              <span className="text-[13px] font-semibold text-[var(--ink)]">{name}</span>
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
                      <div className="mb-2 text-[10px] font-bold uppercase tracking-[0.4px] text-[var(--muted-col)]">
                        Історія візитів ({c.visits})
                      </div>
                      <div className="flex flex-col gap-2">
                        {c.history
                          .sort((a, b) => `${b.date} ${b.start}`.localeCompare(`${a.date} ${a.start}`))
                          .map((a) => (
                            <div key={a.id} className="flex items-start justify-between gap-2">
                              <div className="min-w-0">
                                <div className="text-[12px] font-semibold text-[var(--ink)] truncate">{a.service}</div>
                                <div className="text-[11px] text-[var(--muted-col)]">{a.pet} · {a.doctor.split(" ")[0]}</div>
                              </div>
                              <div className="text-right flex-shrink-0">
                                <div className="text-[11px] font-semibold text-[var(--ink-2)]">
                                  {formatShortDate(new Date(a.date + "T12:00:00"))}
                                </div>
                                <div className="text-[10px] text-[var(--muted-col)]">{a.start}</div>
                              </div>
                            </div>
                          ))}
                      </div>
                    </div>

                    {/* Delete client */}
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
