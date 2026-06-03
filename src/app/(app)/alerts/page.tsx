"use client"

import { useEffect, useState } from "react"
import { useCalendarContext } from "../layout"
import { fetchNotices, createNotice, deleteNotice } from "@/lib/notices"
import { HEAD_DOCTOR_EMAIL } from "@/lib/constants"
import { Notice } from "@/types"

export default function AlertsPage() {
  const { user } = useCalendarContext()
  const [notices, setNotices] = useState<Notice[]>([])
  const [loading, setLoading] = useState(true)
  const [text, setText] = useState("")
  const [publishing, setPublishing] = useState(false)
  const [deletingId, setDeletingId] = useState<string | null>(null)

  const isHead = user.email === HEAD_DOCTOR_EMAIL

  const load = async () => {
    setLoading(true)
    const data = await fetchNotices()
    setNotices(data)
    setLoading(false)
    // Mark as seen
    localStorage.setItem("notices_last_seen", new Date().toISOString())
    // Dispatch event to update badge in layout
    document.dispatchEvent(new CustomEvent("notices-seen"))
  }

  useEffect(() => { load() }, [])  // eslint-disable-line react-hooks/exhaustive-deps

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
    <div className="pb-4 md:px-0 md:pt-0">
      <header className="px-4 pt-4 pb-2">
        <h1 className="text-[22px] font-black tracking-tight text-[var(--ink)] md:text-[28px]">
          Сповіщення
        </h1>
      </header>

      <div className="px-4 flex flex-col gap-3">
        {/* Publish form (head doctor only) */}
        {isHead && (
          <form
            onSubmit={handlePublish}
            className="p-4 rounded-2xl bg-[var(--teal-light)] border border-[var(--teal-mid)]"
          >
            <div className="flex items-center gap-2 text-[12px] font-bold text-[var(--teal-dark)] uppercase tracking-[0.3px] mb-3">
              <svg viewBox="0 0 24 24" className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
              </svg>
              Нове сповіщення
            </div>
            <textarea
              rows={3}
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder="Введіть текст для всіх лікарів…"
              required
              className="w-full rounded-xl border border-[var(--teal-mid)] bg-white px-3 py-3 text-[14px] text-[var(--ink)] outline-none focus:border-[var(--teal)] resize-y min-h-[80px] mb-3"
            />
            <div className="flex items-center justify-between">
              <span className="text-[11px] text-[var(--muted-col)]">
                Побачать усі при наступному відкритті
              </span>
              <button
                type="submit"
                disabled={publishing}
                className="flex items-center gap-2 h-9 px-4 rounded-xl bg-[var(--teal)] text-white text-[13px] font-semibold hover:bg-[var(--teal-dark)] disabled:opacity-60 transition-colors"
              >
                <svg viewBox="0 0 24 24" className="w-3 h-3" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                  <path d="M22 2 11 13M22 2 15 22l-4-9-9-4 20-7z"/>
                </svg>
                {publishing ? "Публікую…" : "Опублікувати"}
              </button>
            </div>
          </form>
        )}

        {/* Loading */}
        {loading && (
          <div className="py-8 text-center text-[14px] text-[var(--muted-col)]">
            Завантаження…
          </div>
        )}

        {/* Empty */}
        {!loading && notices.length === 0 && (
          <div className="py-8 border border-dashed border-[var(--line)] rounded-2xl text-center text-[14px] text-[var(--muted-col)]">
            Сповіщень поки немає.
          </div>
        )}

        {/* Notices */}
        {notices.map((notice) => {
          const date = new Date(notice.created_at).toLocaleDateString("uk-UA", {
            day: "numeric", month: "long", hour: "2-digit", minute: "2-digit",
          })
          return (
            <article
              key={notice.id}
              className="flex gap-3 p-4 rounded-2xl bg-amber-50 border border-amber-200 border-l-4 border-l-amber-400"
            >
              <div className="flex-shrink-0 w-8 h-8 rounded-full bg-amber-100 text-amber-600 grid place-items-center">
                <svg viewBox="0 0 24 24" className="w-[15px] h-[15px]" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                  <path d="M18 8a6 6 0 1 0-12 0c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/>
                </svg>
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-[14px] font-medium text-[var(--ink)] mb-2 whitespace-pre-wrap leading-relaxed">
                  {notice.text}
                </p>
                <div className="flex items-center justify-between">
                  <span className="text-[11px] text-[var(--muted-col)]">{date}</span>
                  {isHead && (
                    <button
                      type="button"
                      disabled={deletingId === notice.id}
                      onClick={() => handleDelete(notice.id)}
                      className="text-[11px] font-bold text-red-500 hover:underline disabled:opacity-50 flex-shrink-0"
                    >
                      {deletingId === notice.id ? "…" : "Видалити"}
                    </button>
                  )}
                </div>
              </div>
            </article>
          )
        })}
      </div>
    </div>
  )
}
