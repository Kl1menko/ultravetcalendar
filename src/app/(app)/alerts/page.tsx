"use client"

import { useEffect, useState, useCallback } from "react"
import { Bug, Lightbulb, Send, Trash2 } from "lucide-react"
import { useCalendarContext } from "@/context/calendar"
import { fetchNotices, createNotice, deleteNotice } from "@/lib/notices"
import {
  fetchFeedback,
  createFeedback,
  updateFeedbackStatus,
  deleteFeedback,
} from "@/lib/feedback"
import { doctorShortName } from "@/lib/doctors"
import { Feedback, FeedbackStatus, FeedbackType, Notice } from "@/types"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Textarea } from "@/components/ui/textarea"
import { Input } from "@/components/ui/input"

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

// ─── Метадані статусів/типів фідбеку ─────────────────────────────────────────

const STATUS_META: Record<FeedbackStatus, { label: string; cls: string }> = {
  new: { label: "Новий", cls: "bg-blue-50 text-blue-700 border-blue-200" },
  in_progress: { label: "В роботі", cls: "bg-amber-50 text-amber-700 border-amber-200" },
  done: { label: "Закрито", cls: "bg-emerald-50 text-emerald-700 border-emerald-200" },
}
const STATUS_ORDER: FeedbackStatus[] = ["new", "in_progress", "done"]

const TYPE_META: Record<FeedbackType, { label: string; icon: typeof Bug; cls: string }> = {
  bug: { label: "Баг", icon: Bug, cls: "bg-red-50 text-red-600 border-red-200" },
  improvement: { label: "Покращення", icon: Lightbulb, cls: "bg-violet-50 text-violet-600 border-violet-200" },
}

// ─── Сторінка ─────────────────────────────────────────────────────────────────

export default function AlertsPage() {
  const { user, triggerBanner, role } = useCalendarContext()
  const [tab, setTab] = useState<"notices" | "feedback">("notices")

  const isHead = role === "head"
  const isAdmin = role === "admin"

  return (
    <div className="flex min-h-full flex-col md:gap-5">
      {/* Header + tabs */}
      <header className="px-4 pt-4 pb-3 md:desktop-page-header md:px-6 md:py-5">
        <h1 className="text-[22px] font-black tracking-tight text-[var(--ink)] md:text-[28px]">
          Сповіщення
        </h1>
        <div className="mt-3 flex gap-1 rounded-xl bg-[var(--paper)] p-1">
          <button
            onClick={() => setTab("notices")}
            className={`flex-1 rounded-lg py-2 text-[13px] font-bold transition-colors ${
              tab === "notices" ? "bg-white text-[var(--ink)] shadow-sm" : "text-[var(--muted-col)]"
            }`}
          >
            Оголошення
          </button>
          <button
            onClick={() => setTab("feedback")}
            className={`flex-1 rounded-lg py-2 text-[13px] font-bold transition-colors ${
              tab === "feedback" ? "bg-white text-[var(--ink)] shadow-sm" : "text-[var(--muted-col)]"
            }`}
          >
            Баги / Ідеї
          </button>
        </div>
      </header>

      {tab === "notices" ? (
        <NoticesTab user={user} isHead={isHead} triggerBanner={triggerBanner} />
      ) : (
        <FeedbackTab user={user} isAdmin={isAdmin} />
      )}
    </div>
  )
}

// ─── Вкладка: оголошення (head → усі) ────────────────────────────────────────

function NoticesTab({
  user,
  isHead,
  triggerBanner,
}: {
  user: ReturnType<typeof useCalendarContext>["user"]
  isHead: boolean
  triggerBanner: ReturnType<typeof useCalendarContext>["triggerBanner"]
}) {
  const [notices, setNotices] = useState<Notice[]>([])
  const [loading, setLoading] = useState(true)
  const [text, setText] = useState("")
  const [publishing, setPublishing] = useState(false)
  const [deletingId, setDeletingId] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    const data = await fetchNotices()
    setNotices(data)
    setLoading(false)
    localStorage.setItem("notices_last_seen", new Date().toISOString())
    document.dispatchEvent(new CustomEvent("notices-seen"))
  }, [])

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
    <div className="flex flex-col gap-3 px-4 pb-6 md:px-0">
      {isHead && (
        <div className="flex justify-end">
          <Button
            variant="outline"
            onClick={() => triggerBanner({
              id: "test",
              text: "Увага! Завтра о 9:00 нарада всього персоналу клініки.",
              created_by: user.id,
              created_at: new Date().toISOString(),
            })}
            className="h-8 gap-1.5 rounded-xl border-[var(--line)] bg-white px-3 text-[12px] font-semibold text-[var(--muted-col)] hover:bg-white hover:text-[var(--ink)]"
          >
            Тест-банер
          </Button>
        </div>
      )}

      {isHead && (
        <form onSubmit={handlePublish} className="rounded-2xl bg-[var(--teal)] p-4 shadow-lg shadow-black/15 md:rounded-[24px] md:p-5">
          <div className="flex items-center gap-2 mb-3">
            <div className="w-7 h-7 rounded-lg bg-white/20 flex items-center justify-center">
              <Send className="w-3.5 h-3.5 text-white" />
            </div>
            <span className="text-[12px] font-bold text-white/90 uppercase tracking-[0.4px]">
              Нове оголошення
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
            <span className="text-[11px] text-white/60">Побачать усі при відкритті</span>
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

      {loading && (
        <div className="py-12 flex flex-col items-center gap-3">
          <div className="w-8 h-8 rounded-full border-2 border-[var(--teal)] border-t-transparent animate-spin" />
          <span className="text-[13px] text-[var(--muted-col)]">Завантаження…</span>
        </div>
      )}

      {!loading && notices.length === 0 && (
        <div className="py-16 flex flex-col items-center gap-3 text-center">
          <div className="w-14 h-14 rounded-2xl bg-[var(--paper)] flex items-center justify-center">
            <svg viewBox="0 0 24 24" className="w-6 h-6 text-[var(--muted-col)]" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round">
              <path d="M18 8a6 6 0 1 0-12 0c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/>
            </svg>
          </div>
          <div>
            <p className="text-[15px] font-bold text-[var(--ink)]">Поки тихо</p>
            <p className="text-[13px] text-[var(--muted-col)] mt-0.5">Нових оголошень немає</p>
          </div>
        </div>
      )}

      {!loading && notices.length > 0 && (
        <div className="flex flex-col gap-2.5 md:grid md:grid-cols-2 md:gap-4 xl:grid-cols-3">
          {notices.map((notice, i) => (
            <Card
              key={notice.id}
              className="desktop-card-hover gap-0 rounded-2xl border border-[var(--line)] bg-white py-0 ring-0"
              style={{ opacity: i > 0 ? Math.max(0.6, 1 - i * 0.08) : 1 }}
            >
              <div className="h-1 bg-[var(--teal)]" style={{ opacity: Math.max(0.3, 1 - i * 0.15) }} />
              <div className="px-4 py-3.5">
                <p className="text-[14px] text-[var(--ink)] leading-relaxed whitespace-pre-wrap mb-3">
                  {notice.text}
                </p>
                <div className="flex items-center justify-between">
                  <span className="text-[11px] text-[var(--muted-col)] font-medium">{timeAgo(notice.created_at)}</span>
                  {isHead && (
                    <Button
                      variant="ghost"
                      size="xs"
                      disabled={deletingId === notice.id}
                      onClick={() => handleDelete(notice.id)}
                      className="gap-1 px-1.5 text-[11px] font-semibold text-[var(--muted-col)] hover:bg-transparent hover:text-red-500"
                    >
                      {deletingId === notice.id ? "…" : <><Trash2 className="w-3 h-3" />Видалити</>}
                    </Button>
                  )}
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}

// ─── Вкладка: фідбек (команда → admin) ───────────────────────────────────────

function FeedbackTab({
  user,
  isAdmin,
}: {
  user: ReturnType<typeof useCalendarContext>["user"]
  isAdmin: boolean
}) {
  const [items, setItems] = useState<Feedback[]>([])
  const [loading, setLoading] = useState(true)
  const [type, setType] = useState<FeedbackType>("bug")
  const [title, setTitle] = useState("")
  const [body, setBody] = useState("")
  const [sending, setSending] = useState(false)
  const [busyId, setBusyId] = useState<string | null>(null)
  const [filter, setFilter] = useState<FeedbackStatus | "all">("all")

  const authorName = (() => {
    const m = user.user_metadata ?? {}
    return (
      (typeof m.display_name === "string" && m.display_name.trim()) ||
      (typeof m.full_name === "string" && m.full_name.trim()) ||
      (user.email || "").split("@")[0]
    )
  })()

  const load = useCallback(async () => {
    setLoading(true)
    setItems(await fetchFeedback())
    setLoading(false)
  }, [])

  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { load() }, [load])

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!title.trim()) return
    setSending(true)
    await createFeedback({ type, title: title.trim(), body: body.trim(), authorName })
    setTitle("")
    setBody("")
    setType("bug")
    setSending(false)
    load()
  }

  const handleStatus = async (id: string, status: FeedbackStatus) => {
    setBusyId(id)
    await updateFeedbackStatus(id, status)
    setBusyId(null)
    load()
  }

  const handleDelete = async (id: string) => {
    setBusyId(id)
    await deleteFeedback(id)
    setBusyId(null)
    load()
  }

  const visible = filter === "all" ? items : items.filter((i) => i.status === filter)
  const openCount = items.filter((i) => i.status !== "done").length

  return (
    <div className="flex flex-col gap-3 px-4 pb-6 md:px-0">
      {/* Форма створення тікета — доступна всім */}
      <form onSubmit={handleSend} className="rounded-2xl border border-[var(--line)] bg-white p-4 shadow-sm md:rounded-[24px] md:p-5">
        <span className="mb-3 block text-[12px] font-bold uppercase tracking-[0.4px] text-[var(--muted-col)]">
          Повідомити про баг або ідею
        </span>

        {/* Тип */}
        <div className="mb-3 flex gap-2">
          {(Object.keys(TYPE_META) as FeedbackType[]).map((t) => {
            const M = TYPE_META[t]
            const active = type === t
            return (
              <button
                key={t}
                type="button"
                onClick={() => setType(t)}
                className={`flex flex-1 items-center justify-center gap-1.5 rounded-xl border py-2 text-[13px] font-bold transition-colors ${
                  active ? M.cls : "border-[var(--line)] bg-[var(--paper)] text-[var(--muted-col)]"
                }`}
              >
                <M.icon className="h-3.5 w-3.5" />
                {M.label}
              </button>
            )
          })}
        </div>

        <Input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Коротко: що сталося / що покращити"
          required
          className="mb-2.5"
        />
        <Textarea
          rows={3}
          value={body}
          onChange={(e) => setBody(e.target.value)}
          placeholder="Деталі (необов'язково): кроки, екран, що очікувалось…"
          className="mb-3 resize-none"
        />
        <div className="flex items-center justify-between">
          <span className="text-[11px] text-[var(--muted-col)]">Від: {authorName}</span>
          <Button type="submit" disabled={sending || !title.trim()} className="h-9 gap-1.5 rounded-xl px-4 text-[13px] font-bold">
            <Send className="h-3.5 w-3.5" />
            {sending ? "Надсилаю…" : "Надіслати"}
          </Button>
        </div>
      </form>

      {/* Фільтр статусів */}
      {!loading && items.length > 0 && (
        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={() => setFilter("all")}
            className={`rounded-lg border px-2.5 py-1 text-[12px] font-bold ${
              filter === "all" ? "border-[var(--teal-mid)] bg-[var(--teal-light)] text-[var(--teal-dark)]" : "border-[var(--line)] bg-white text-[var(--muted-col)]"
            }`}
          >
            Усі {openCount > 0 && <span className="opacity-70">· {openCount} відкр.</span>}
          </button>
          {STATUS_ORDER.map((s) => (
            <button
              key={s}
              onClick={() => setFilter(s)}
              className={`rounded-lg border px-2.5 py-1 text-[12px] font-bold ${
                filter === s ? STATUS_META[s].cls : "border-[var(--line)] bg-white text-[var(--muted-col)]"
              }`}
            >
              {STATUS_META[s].label}
            </button>
          ))}
        </div>
      )}

      {loading && (
        <div className="py-12 flex flex-col items-center gap-3">
          <div className="w-8 h-8 rounded-full border-2 border-[var(--teal)] border-t-transparent animate-spin" />
          <span className="text-[13px] text-[var(--muted-col)]">Завантаження…</span>
        </div>
      )}

      {!loading && items.length === 0 && (
        <div className="py-16 flex flex-col items-center gap-3 text-center">
          <div className="w-14 h-14 rounded-2xl bg-[var(--paper)] flex items-center justify-center">
            <Bug className="w-6 h-6 text-[var(--muted-col)]" />
          </div>
          <div>
            <p className="text-[15px] font-bold text-[var(--ink)]">Поки порожньо</p>
            <p className="text-[13px] text-[var(--muted-col)] mt-0.5">Напишіть перший баг або ідею вище</p>
          </div>
        </div>
      )}

      {!loading && visible.length > 0 && (
        <div className="flex flex-col gap-2.5 md:grid md:grid-cols-2 md:gap-4">
          {visible.map((item) => {
            const T = TYPE_META[item.type]
            const canDelete = isAdmin || item.created_by === user.id
            return (
              <Card key={item.id} className="gap-0 rounded-2xl border border-[var(--line)] bg-white py-0 ring-0">
                <div className="px-4 py-3.5">
                  {/* Бейджі типу + статусу */}
                  <div className="mb-2 flex items-center gap-2">
                    <span className={`inline-flex items-center gap-1 rounded-md border px-1.5 py-0.5 text-[11px] font-black ${T.cls}`}>
                      <T.icon className="h-3 w-3" />
                      {T.label}
                    </span>
                    <span className={`rounded-md border px-1.5 py-0.5 text-[11px] font-black ${STATUS_META[item.status].cls}`}>
                      {STATUS_META[item.status].label}
                    </span>
                  </div>

                  <p className="text-[14px] font-bold text-[var(--ink)] leading-snug">{item.title}</p>
                  {item.body && (
                    <p className="mt-1 text-[13px] text-[var(--ink-2)] leading-relaxed whitespace-pre-wrap">{item.body}</p>
                  )}

                  <div className="mt-3 flex items-center justify-between">
                    <span className="text-[11px] font-medium text-[var(--muted-col)]">
                      {item.author_name ? doctorShortName(item.author_name) : "—"} · {timeAgo(item.created_at)}
                    </span>
                    {canDelete && (
                      <Button
                        variant="ghost"
                        size="xs"
                        disabled={busyId === item.id}
                        onClick={() => handleDelete(item.id)}
                        className="gap-1 px-1.5 text-[11px] font-semibold text-[var(--muted-col)] hover:bg-transparent hover:text-red-500"
                      >
                        <Trash2 className="w-3 h-3" />
                      </Button>
                    )}
                  </div>

                  {/* Зміна статусу — лише admin */}
                  {isAdmin && (
                    <div className="mt-2.5 flex gap-1.5 border-t border-[var(--line)] pt-2.5">
                      {STATUS_ORDER.map((s) => (
                        <button
                          key={s}
                          disabled={busyId === item.id || item.status === s}
                          onClick={() => handleStatus(item.id, s)}
                          className={`flex-1 rounded-lg border py-1.5 text-[11px] font-bold transition-colors disabled:opacity-50 ${
                            item.status === s ? STATUS_META[s].cls : "border-[var(--line)] bg-white text-[var(--muted-col)] hover:bg-[var(--paper)]"
                          }`}
                        >
                          {STATUS_META[s].label}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </Card>
            )
          })}
        </div>
      )}
    </div>
  )
}
