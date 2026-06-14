"use client"

import { useState, useMemo } from "react"
import { PRICE_LIST, type PriceCategory } from "@/lib/price-list"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"

function norm(s: string) {
  return s.trim().toLowerCase()
}

/** Лишає категорії з елементами, що збігаються із запитом (по назві/нотатці/тарифах). */
function filterPrice(query: string): PriceCategory[] {
  const q = norm(query)
  if (!q) return PRICE_LIST

  return PRICE_LIST.map((cat) => {
    const catMatch = norm(cat.title).includes(q)
    const items = cat.items.filter((item) => {
      if (catMatch) return true
      const haystack = [
        item.name,
        item.note ?? "",
        item.price ?? "",
        ...(item.tiers?.map((t) => `${t.label} ${t.price}`) ?? []),
      ]
        .join(" ")
        .toLowerCase()
      return haystack.includes(q)
    })
    return { ...cat, items }
  }).filter((cat) => cat.items.length > 0)
}

export default function PricePage() {
  const [query, setQuery] = useState("")
  const filtered = useMemo(() => filterPrice(query), [query])

  const totalItems = useMemo(
    () => filtered.reduce((sum, c) => sum + c.items.length, 0),
    [filtered]
  )

  return (
    <div className="pb-6 md:flex md:flex-col md:gap-5 md:px-0 md:pt-0">
      {/* Header */}
      <header className="px-4 pt-4 pb-3 md:desktop-page-header md:px-6 md:py-5">
        <h1 className="text-[22px] font-black text-[var(--ink)] md:text-[28px]">
          Прайс
        </h1>
        <p className="mt-1 text-[13px] font-medium text-[var(--muted-col)]">
          Орієнтовні ціни. Уточнюйте на прийомі.
        </p>
      </header>

      {/* Search */}
      <div className="px-4 mb-4 md:mb-0 md:px-0">
        <div className="relative">
          <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--muted-col)] pointer-events-none" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
            <circle cx="11" cy="11" r="8" /><path d="m21 21-4.35-4.35" />
          </svg>
          <Input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Пошук послуги…"
            autoComplete="off"
            autoCorrect="off"
            spellCheck={false}
            className="h-11 rounded-xl border-[var(--line)] bg-white pl-10 pr-10 text-[14px] text-[var(--ink)] focus-visible:border-[var(--teal)] focus-visible:ring-0 md:h-12 md:rounded-2xl md:shadow-sm"
          />
          {query && (
            <button type="button" onClick={() => setQuery("")} className="absolute right-3 top-1/2 -translate-y-1/2 w-5 h-5 rounded-full bg-[var(--muted-col)] text-white flex items-center justify-center">
              <svg viewBox="0 0 24 24" className="w-3 h-3" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round"><path d="M18 6 6 18M6 6l12 12" /></svg>
            </button>
          )}
        </div>
      </div>

      {/* List */}
      {totalItems === 0 ? (
        <div className="mx-4 rounded-2xl border border-dashed border-[var(--line)] py-8 text-center text-[14px] text-[var(--muted-col)] md:mx-0 md:bg-white/70">
          Нічого не знайдено.
        </div>
      ) : (
        <div className="flex flex-col gap-4 px-4 md:grid md:grid-cols-2 md:items-start md:gap-5 md:px-0 xl:grid-cols-3">
          {filtered.map((cat) => (
            <Card
              key={cat.title}
              className="gap-0 rounded-2xl border border-[var(--line)] bg-white py-0 ring-0 md:shadow-sm"
            >
              <CardHeader className="border-b border-[var(--line)] bg-[var(--paper)] px-4 py-3">
                <CardTitle className="text-[14px] font-black text-[var(--ink)]">{cat.title}</CardTitle>
                {cat.subtitle && (
                  <p className="mt-0.5 text-[11px] font-semibold text-[var(--muted-col)]">{cat.subtitle}</p>
                )}
              </CardHeader>

              <CardContent className="px-0">
              <ul>
                {cat.items.map((item) => (
                  <li
                    key={item.name}
                    className="border-b border-[var(--line)] px-4 py-3 last:border-b-0"
                  >
                    <div className="flex items-baseline justify-between gap-3">
                      <span className="text-[14px] font-semibold text-[var(--ink)]">{item.name}</span>
                      {item.price && (
                        <span className="shrink-0 text-[14px] font-black text-[var(--teal-dark)]">{item.price}</span>
                      )}
                    </div>

                    {item.tiers && (
                      <div className="mt-2 grid grid-cols-2 gap-x-3 gap-y-1.5">
                        {item.tiers.map((t) => (
                          <div key={t.label} className="flex items-baseline justify-between gap-2">
                            <span className="text-[12px] text-[var(--muted-col)]">{t.label}</span>
                            <span className="shrink-0 text-[12px] font-bold text-[var(--teal-dark)]">{t.price}</span>
                          </div>
                        ))}
                      </div>
                    )}

                    {item.note && (
                      <p className="mt-2 text-[11px] font-medium text-amber-700">{item.note}</p>
                    )}
                  </li>
                ))}
              </ul>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}
