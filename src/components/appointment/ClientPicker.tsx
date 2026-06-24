"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import { AnimatePresence, motion } from "motion/react"
import { Appointment } from "@/types"
import { buildClients, ClientEntry } from "@/lib/clients"
import { phoneMatches, hasDigits } from "@/lib/phone"
import { PawPrint, Check } from "lucide-react"

export type ClientPick = {
  client: string
  phone: string
  address: string
  pet?: string
  animal?: string
  age?: string
  weight?: string
}

type Props = {
  appointments: Appointment[]
  /** Поточний текст у полі, за яким шукаємо (ім'я або номер). */
  query: string
  /** Режим пошуку — за яким полем фокус: підказує, як матчити запит. */
  mode: "name" | "phone"
  /** Заповнює поля форми обраним клієнтом (і, за вибором, твариною). */
  onPick: (pick: ClientPick) => void
}

/** Останній візит цієї тварини у клієнта — джерело вік/ваги/виду. */
function lastVisitForPet(entry: ClientEntry, pet: string): Appointment | undefined {
  return [...entry.history]
    .filter((a) => a.pet === pet)
    .sort((a, b) => `${b.date} ${b.start}`.localeCompare(`${a.date} ${a.start}`))[0]
}

/**
 * Випадний список збігів існуючих клієнтів під полем «Клієнт» або «Телефон».
 * Сам не рендерить інпут — лише панель підказок під ним (absolute), яку
 * показуємо доки поле у фокусі й у запиті є хоча б 2 символи.
 */
export function ClientPicker({ appointments, query, mode, onPick }: Props) {
  // Розкритий клієнт — показуємо його тварин для вибору.
  const [openClient, setOpenClient] = useState<ClientEntry | null>(null)

  // На мобільному екранна клавіатура перекриває нижню частину списку.
  // Обмежуємо висоту панелі реальним вільним простором над клавіатурою
  // (visualViewport.height звужується, коли клавіатура відкрита), щоб
  // підказки скролились усередині видимої зони, а не ховались за нею.
  const panelRef = useRef<HTMLDivElement | null>(null)
  const [maxH, setMaxH] = useState(280)

  useEffect(() => {
    const vv = typeof window !== "undefined" ? window.visualViewport : null
    if (!vv) return
    const recompute = () => {
      const panel = panelRef.current
      if (!panel) return
      const top = panel.getBoundingClientRect().top
      // Низ видимої зони = offsetTop (зсув viewport) + його висота.
      const visibleBottom = vv.offsetTop + vv.height
      // 12px відступ від клавіатури; не даємо стиснути надто сильно.
      const avail = Math.max(120, Math.min(280, visibleBottom - top - 12))
      setMaxH(avail)
    }
    recompute()
    vv.addEventListener("resize", recompute)
    vv.addEventListener("scroll", recompute)
    return () => {
      vv.removeEventListener("resize", recompute)
      vv.removeEventListener("scroll", recompute)
    }
  }, [query, openClient])

  const clients = useMemo(() => buildClients(appointments), [appointments])

  const matches = useMemo(() => {
    const raw = query.trim()
    // Поріг у 2 символи — щоб не сипати весь список з першої літери/цифри.
    if (raw.length < 2) return []
    const q = raw.toLowerCase()
    return clients
      .filter((c) => {
        if (mode === "phone") return hasDigits(raw) && phoneMatches(c.phone, raw)
        return c.client.toLowerCase().includes(q)
      })
      .slice(0, 6)
  }, [clients, query, mode])

  const fillClientOnly = (c: ClientEntry) => {
    onPick({ client: c.client, phone: c.phone, address: c.last.address || "" })
  }

  const fillWithPet = (c: ClientEntry, pet: string) => {
    const visit = lastVisitForPet(c, pet)
    onPick({
      client: c.client,
      phone: c.phone,
      address: visit?.address || c.last.address || "",
      pet,
      animal: visit?.animal || pet,
      age: visit?.age || "",
      weight: visit?.weight || "",
    })
    setOpenClient(null)
  }

  if (matches.length === 0) return null

  return (
    <AnimatePresence>
      <motion.div
        ref={panelRef}
        initial={{ opacity: 0, y: -4 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -4 }}
        // Поверх наступних полів форми; mousedown (не click) — щоб вибір
        // спрацював до blur інпута, який інакше сховав би список.
        className="absolute left-0 right-0 top-full z-20 mt-1 overflow-hidden rounded-xl border border-[var(--lg-border)] bg-white/90 shadow-lg shadow-black/10 backdrop-blur"
      >
        <ul
          style={{ maxHeight: maxH }}
          className="divide-y divide-[var(--line)] overflow-y-auto"
        >
          {matches.map((c) => {
            const key = `${c.client}-${c.phone}`
            const isOpen = openClient && `${openClient.client}-${openClient.phone}` === key
            const pets = [...c.pets.entries()]
            return (
              <li key={key}>
                <button
                  type="button"
                  onMouseDown={(e) => {
                    e.preventDefault()
                    // Один вид тварини — підтягуємо одразу. Кілька — розкриваємо вибір.
                    if (pets.length <= 1) {
                      if (pets.length === 1) fillWithPet(c, pets[0][0])
                      else fillClientOnly(c)
                    } else {
                      setOpenClient(isOpen ? null : c)
                    }
                  }}
                  className="flex w-full items-center gap-2.5 px-3 py-2.5 text-left transition-colors hover:bg-[var(--paper)] active:bg-[var(--paper)]"
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="truncate text-[14px] font-semibold text-[var(--ink)]">{c.client}</span>
                      <span className="flex-shrink-0 text-[11px] font-medium text-[var(--muted-col)]">{c.visits} {c.visits === 1 ? "візит" : c.visits < 5 ? "візити" : "візитів"}</span>
                    </div>
                    <div className="mt-0.5 flex items-center gap-1.5 text-[12px] text-[var(--muted-col)]">
                      <span className="tabular-nums">{c.phone}</span>
                      {pets.length > 0 && (
                        <>
                          <span>·</span>
                          <PawPrint className="h-3 w-3 flex-shrink-0" />
                          <span className="truncate">{pets.map(([name]) => name).join(", ")}</span>
                        </>
                      )}
                    </div>
                  </div>
                  {pets.length > 1 && (
                    <span className="flex-shrink-0 text-[11px] font-semibold text-[var(--teal-dark)]">
                      {isOpen ? "Сховати" : "Обрати тварину"}
                    </span>
                  )}
                </button>

                {/* Вибір тварини, якщо їх кілька */}
                {isOpen && (
                  <div className="border-t border-[var(--line)] bg-[var(--teal)]/[0.04] px-3 py-2">
                    <button
                      type="button"
                      onMouseDown={(e) => { e.preventDefault(); fillClientOnly(c); setOpenClient(null) }}
                      className="mb-1.5 flex w-full items-center gap-2 rounded-lg px-2 py-2 text-left text-[13px] font-medium text-[var(--ink-2)] transition-colors hover:bg-white/60"
                    >
                      Лише контакти (без тварини)
                    </button>
                    {pets.map(([name, animal]) => (
                      <button
                        key={name}
                        type="button"
                        onMouseDown={(e) => { e.preventDefault(); fillWithPet(c, name) }}
                        className="flex w-full items-center gap-2 rounded-lg px-2 py-2 text-left transition-colors hover:bg-white/60"
                      >
                        <PawPrint className="h-3.5 w-3.5 flex-shrink-0 text-[var(--teal)]" />
                        <span className="text-[13px] font-semibold text-[var(--ink)]">{name}</span>
                        {animal && animal !== name && (
                          <span className="truncate text-[11px] text-[var(--muted-col)]">{animal}</span>
                        )}
                        <Check className="ml-auto h-3.5 w-3.5 flex-shrink-0 text-[var(--muted-col)]" />
                      </button>
                    ))}
                  </div>
                )}
              </li>
            )
          })}
        </ul>
      </motion.div>
    </AnimatePresence>
  )
}
