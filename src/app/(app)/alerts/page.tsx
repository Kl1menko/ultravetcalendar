"use client"

import { useEffect, useState, useCallback } from "react"
import { useCalendarContext } from "@/context/calendar"
import { fetchNotices, createNotice, deleteNotice } from "@/lib/notices"
import { Notice } from "@/types"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Textarea } from "@/components/ui/textarea"

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 1) return "щойно"
  if (mins < 60) return `${mins} хв тому`
  const hours = Math.floor(mins / 60)
  if (hours < 24) return `${hours} год тому`
  const days = Math.floor(hours / 24)
  if (days < 7) return `${days} д тому`
  return new Date(iso).toLocaleDateString("uk-UA", { day: "numeric", month: "short" })
}

export default function AlertsPage() {
  const { user, triggerBanner, role } = useCalendarContext()
  const [notices, setNotices] = useState<Notice[]>([])
  const [loading, setLoading] = useState(true)
  const [text, setText] = useState("")
  const [publishing, setPublishing] = useState(false)
  const [deletingId, setDeletingId] = useState<string | null>(null)

  const isHead = role === "head"

  const load = useCallback(async () => {
    setLoading(true)
    const data = await fetchNotices()
    setNotices(data)
    setLoading(false)
    localStorage.setItem("notices_last_seen", new Date().toISOString())
    document.dispatchEvent(new CustomEvent("notices-seen"))
  }, [])

  // load() стартує завантаження сповіщень на маунті; setLoading(true) — навмисний
  // одноразовий setState, каскадних ре-рендерів немає.
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { load() }, [load])

  const handlePublish = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!text.trim()) return
    setPublishing(true)
    await createNotice(text.trim(), user.id)
    setText("")
    setPublishing(false)
    load()
  }

  const handleDelete = async (id: string) => {
    setDeletingId(id)
    await deleteNotice(id)
    setDeletingId(null)
    load()
  }

  return (
    <div className="flex min-h-full flex-col md:gap-5">
      {/* Header */}
      <header className="flex items-center justify-between px-4 pt-4 pb-3 md:desktop-page-header md:px-6 md:py-5">
        <div>
          <h1 className="text-[22px] font-black tracking-tight text-[var(--ink)] md:text-[28px]">
            Сповіщення
          </h1>
          {!loading && (
            <p className="text-[12px] text-[var(--muted-col)] font-medium mt-0.5">
              {notices.length === 0 ? "Немає сповіщень" : `${notices.length} повідомл.`}
            </p>
          )}
        </div>
        {isHead && (
          <Button
            variant="outline"
            onClick={() => triggerBanner({
              id: "test",
              text: "Увага! Завтра о 9:00 нарада всього персоналу клініки.",
              created_by: user.id,
              created_at: new Date().toISOString(),
            })}
            className="h-8 gap-1.5 rounded-xl border-[var(--line)] bg-white px-3 text-[12px] font-semibold text-[var(--muted-col)] hover:bg-white hover:text-[var(--ink)] md:h-10 md:rounded-2xl md:px-4 md:shadow-sm"
          >
            <svg viewBox="0 0 24 24" className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
              <polygon points="5 3 19 12 5 21 5 3"/>
            </svg>
            Тест
          </Button>
        )}
      </header>

      <div className="flex flex-col gap-3 px-4 pb-6 md:px-0">
        {/* Форма публікації (тільки head) */}
        {isHead && (
          <form onSubmit={handlePublish} className="rounded-2xl bg-[var(--teal)] p-4 shadow-lg shadow-teal-700/20 md:rounded-[24px] md:p-5">
            <div className="flex items-center gap-2 mb-3">
              <div className="w-7 h-7 rounded-lg bg-white/20 flex items-center justify-center">
                <svg viewBox="0 0 24 24" className="w-3.5 h-3.5 text-white" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                  <path d="M22 2 11 13M22 2 15 22l-4-9-9-4 20-7z"/>
                </svg>
              </div>
              <span className="text-[12px] font-bold text-white/90 uppercase tracking-[0.4px]">
                Нове сповіщення
              </span>
            </div>
            <Textarea
              rows={3}
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder="Введіть текст для всіх лікарів…"
              required
              className="mb-3 resize-none rounded-xl border-white/20 bg-white/15 px-3 py-2.5 text-[14px] text-white placeholder:text-white/50 focus-visible:border-white/30 focus-visible:bg-white/20 focus-visible:ring-0"
            />
            <div className="flex items-center justify-between">
              <span className="text-[11px] text-white/60">
                Побачать усі при відкритті
              </span>
              <Button
                type="submit"
                disabled={publishing || !text.trim()}
                className="h-8 gap-1.5 rounded-xl bg-white px-4 text-[13px] font-bold text-[var(--teal)] hover:bg-white/90"
              >
                {publishing ? "Надсилаю…" : "Надіслати"}
              </Button>
            </div>
          </form>
        )}

        {/* Loading */}
        {loading && (
          <div className="py-12 flex flex-col items-center gap-3">
            <div className="w-8 h-8 rounded-full border-2 border-[var(--teal)] border-t-transparent animate-spin" />
            <span className="text-[13px] text-[var(--muted-col)]">Завантаження…</span>
          </div>
        )}

        {/* Empty */}
        {!loading && notices.length === 0 && (
          <div className="py-16 flex flex-col items-center gap-3 text-center">
            <div className="w-14 h-14 rounded-2xl bg-[var(--paper)] flex items-center justify-center">
              <svg viewBox="0 0 24 24" className="w-6 h-6 text-[var(--muted-col)]" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round">
                <path d="M18 8a6 6 0 1 0-12 0c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/>
              </svg>
            </div>
            <div>
              <p className="text-[15px] font-bold text-[var(--ink)]">Поки тихо</p>
              <p className="text-[13px] text-[var(--muted-col)] mt-0.5">Нових сповіщень немає</p>
            </div>
          </div>
        )}

        {/* Список */}
        {!loading && notices.length > 0 && (
          <div className="flex flex-col gap-2.5 md:grid md:grid-cols-2 md:gap-4 xl:grid-cols-3">
            {notices.map((notice, i) => (
              <Card
                key={notice.id}
                className="desktop-card-hover gap-0 rounded-2xl border border-[var(--line)] bg-white py-0 ring-0"
                style={{ opacity: i > 0 ? Math.max(0.6, 1 - i * 0.08) : 1 }}
              >
                {/* Кольорова смужка зверху */}
                <div className="h-1 bg-[var(--teal)]" style={{ opacity: Math.max(0.3, 1 - i * 0.15) }} />

                <div className="px-4 py-3.5">
                  <p className="text-[14px] text-[var(--ink)] leading-relaxed whitespace-pre-wrap mb-3">
                    {notice.text}
                  </p>
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] text-[var(--muted-col)] font-medium">
                      {timeAgo(notice.created_at)}
                    </span>
                    {isHead && (
                      <Button
                        variant="ghost"
                        size="xs"
                        disabled={deletingId === notice.id}
                        onClick={() => handleDelete(notice.id)}
                        className="gap-1 px-1.5 text-[11px] font-semibold text-[var(--muted-col)] hover:bg-transparent hover:text-red-500"
                      >
                        {deletingId === notice.id ? (
                          "…"
                        ) : (
                          <>
                            <svg viewBox="0 0 24 24" className="w-3 h-3" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                              <path d="M3 6h18M8 6V4h8v2M19 6l-1 14H6L5 6"/>
                            </svg>
                            Видалити
                          </>
                        )}
                      </Button>
                    )}
                  </div>
                </div>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
