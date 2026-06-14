"use client"

import { useState, useMemo } from "react"
import { useCalendarContext } from "@/context/calendar"
import { formatShortDate } from "@/lib/utils-app"
import { deleteAppointment } from "@/lib/appointments"
import { Appointment } from "@/types"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"

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

function PhoneIcon() {
  return (
    <svg viewBox="0 0 24 24" className="w-[18px] h-[18px]" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07A19.5 19.5 0 0 1 4.69 12a19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 3.6 1.27h3a2 2 0 0 1 2 1.72c.127.96.361 1.903.7 2.81a2 2 0 0 1-.45 2.11L7.91 8.91a16 16 0 0 0 6 6l.91-.91a2 2 0 0 1 2.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0 1 21.73 16z"/>
    </svg>
  )
}

function ChevronIcon({ open }: { open: boolean }) {
  return (
    <svg viewBox="0 0 24 24" className={`w-4 h-4 transition-transform duration-200 ${open ? "rotate-180" : ""}`} fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round">
      <path d="m6 9 6 6 6-6"/>
    </svg>
  )
}

export default function ClientsPage() {
  const { appointments, reload, canSeeClients } = useCalendarContext()
  const [query, setQuery] = useState("")
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
    const q = query.trim().toLowerCase()
    if (!q) return allClients
    return allClients.filter((c) =>
      [c.client, c.phone, ...[...c.pets.keys()]].join(" ").toLowerCase().includes(q)
    )
  }, [allClients, query])

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
        <h1 className="text-[22px] font-black text-[var(--ink)] md:text-[28px]">
          Клієнти
          {allClients.length > 0 && (
            <span className="ml-2 text-[16px] font-semibold text-[var(--muted-col)]">{allClients.length}</span>
          )}
        </h1>
        {duplicatesCount > 0 && (
          <p className="mt-1 text-[13px] font-semibold text-amber-700">
            Потенційних дублів: {duplicatesCount}
          </p>
        )}
      </header>

      {/* Search */}
      <div className="px-4 mb-4 md:mb-0 md:px-0">
        <div className="relative">
          <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--muted-col)] pointer-events-none" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
            <circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/>
          </svg>
          <Input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Ім'я, кличка або телефон"
            autoComplete="off"
            autoCorrect="off"
            spellCheck={false}
            className="h-11 rounded-xl border-[var(--line)] bg-white pl-10 pr-10 text-[14px] text-[var(--ink)] focus-visible:border-[var(--teal)] focus-visible:ring-0 md:h-12 md:rounded-2xl md:shadow-sm"
          />
          {query && (
            <button type="button" onClick={() => setQuery("")} className="absolute right-3 top-1/2 -translate-y-1/2 w-5 h-5 rounded-full bg-[var(--muted-col)] text-white flex items-center justify-center">
              <svg viewBox="0 0 24 24" className="w-3 h-3" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round"><path d="M18 6 6 18M6 6l12 12"/></svg>
            </button>
          )}
        </div>
      </div>

      {/* List */}
      {filtered.length === 0 ? (
        <div className="mx-4 rounded-2xl border border-dashed border-[var(--line)] py-8 text-center text-[14px] text-[var(--muted-col)] md:mx-0 md:bg-white/70">
          {query ? "Нічого не знайдено." : "Клієнтів поки немає."}
        </div>
      ) : (
        <div className="flex flex-col gap-3 px-4 md:grid md:grid-cols-2 md:px-0 xl:grid-cols-3">
          {filtered.map((c) => {
            const key = `${c.client}-${c.phone}`
            const isOpen = expanded === key
            const initials = c.client.trim().split(" ").map((w) => w[0]).join("").slice(0, 2).toUpperCase()
            const pets = [...c.pets.entries()]

            return (
              <div key={key} className="desktop-card-hover overflow-hidden rounded-2xl border border-[var(--line)] bg-white shadow-sm">

                {/* Main row */}
                <button
                  type="button"
                  onClick={() => toggle(key)}
                  className="w-full flex items-center gap-3 p-4 text-left active:bg-[var(--paper)] transition-colors"
                >
                  {/* Avatar */}
                  <div className="flex-shrink-0 w-11 h-11 rounded-full bg-[var(--teal-light)] text-[var(--teal-dark)] text-[13px] font-black grid place-items-center">
                    {initials}
                  </div>

                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-[14px] font-bold text-[var(--ink)] truncate">{c.client}</span>
                      {/* Visits badge */}
                      <Badge className="flex-shrink-0 bg-[var(--teal-light)] text-[10px] font-bold text-[var(--teal)]">
                        {c.visits} {c.visits === 1 ? "візит" : c.visits < 5 ? "візити" : "візитів"}
                      </Badge>
                      {c.duplicateCount > 1 && (
                        <Badge className="flex-shrink-0 bg-amber-100 text-[10px] font-bold text-amber-700">
                          дубль
                        </Badge>
                      )}
                    </div>
                    {/* Pets */}
                    <div className="text-[12px] font-semibold text-[var(--teal-dark)] truncate">
                      {pets.map(([name, animal]) => animal && animal !== name ? `${name} (${animal})` : name).join(", ")}
                    </div>
                    {/* Last visit */}
                    <div className="text-[11px] text-[var(--muted-col)] truncate">
                      {c.last.service} · {formatShortDate(new Date(c.last.date + "T12:00:00"))}
                    </div>
                  </div>

                  <ChevronIcon open={isOpen} />
                </button>

                {/* Expanded details */}
                {isOpen && (
                  <div className="border-t border-[var(--line)]">
                    {/* Phone + call */}
                    <div className="flex items-center justify-between px-4 py-3 border-b border-[var(--line)]">
                      <div>
                        <div className="text-[10px] font-bold text-[var(--muted-col)] uppercase tracking-[0.4px] mb-0.5">Телефон</div>
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
                        className="w-10 h-10 rounded-full bg-[var(--teal)] text-white grid place-items-center hover:bg-[var(--teal-dark)] active:scale-95 transition-all"
                      >
                        <PhoneIcon />
                      </a>
                    </div>

                    {/* Pets list */}
                    {pets.length > 0 && (
                      <div className="px-4 py-3 border-b border-[var(--line)]">
                        <div className="text-[10px] font-bold text-[var(--muted-col)] uppercase tracking-[0.4px] mb-2">Тварини</div>
                        <div className="flex flex-col gap-1.5">
                          {pets.map(([name, animal]) => (
                            <div key={name} className="flex items-center gap-2">
                              <span className="text-base leading-none">🐾</span>
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
                    <div className="px-4 py-3 border-b border-[var(--line)]">
                      <div className="text-[10px] font-bold text-[var(--muted-col)] uppercase tracking-[0.4px] mb-2">
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
                            className="h-9 flex-1 rounded-xl border-[var(--line)] bg-[var(--paper)] text-[13px] font-semibold text-[var(--ink-2)]"
                          >
                            Скасувати
                          </Button>
                          <Button
                            disabled={deletingKey === key}
                            onClick={() => handleDeleteClient(key, c.history)}
                            className="h-9 flex-1 rounded-xl bg-red-500 text-[13px] font-semibold text-white hover:bg-red-600"
                          >
                            {deletingKey === key ? "Видаляю…" : `Так, видалити (${c.visits})`}
                          </Button>
                        </div>
                      ) : (
                        <Button
                          variant="destructive"
                          onClick={() => setConfirmDeleteKey(key)}
                          className="h-9 w-full rounded-xl border border-red-200 bg-red-50 text-[13px] font-semibold text-red-600 hover:bg-red-100"
                        >
                          Видалити клієнта
                        </Button>
                      )}
                    </div>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
