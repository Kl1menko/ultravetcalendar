"use client"

import { useEffect, useState, useCallback } from "react"
import { Bug, CornerDownRight, Lightbulb, MessageSquare, Send, Trash2 } from "lucide-react"
import { useCalendarContext } from "@/context/calendar"
import { fetchNotices, createNotice, deleteNotice } from "@/lib/notices"
import {
  fetchFeedback,
  createFeedback,
  updateFeedbackStatus,
  deleteFeedback,
  fetchReplies,
  createReply,
  deleteReply,
} from "@/lib/feedback"
import { doctorShortName } from "@/lib/doctors"
import { Feedback, FeedbackReply, FeedbackStatus, FeedbackType, Notice } from "@/types"
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
  const { user, role } = useCalendarContext()
  const [tab, setTab] = useState<"notices" | "feedback">("notices")

  // Бейдж єдиний на іконці «Сповіщення» й охоплює обидва канали (оголошення +
  // фідбек). Тож відкриття сторінки = переглянуто все: позначаємо обидва
  // last_seen і просимо layout перерахувати бейдж у нуль. Інакше непрочитане
  // в невідкритій вкладці тримало б бейдж нескінченно.
  useEffect(() => {
    const now = new Date().toISOString()
    localStorage.setItem("notices_last_seen", now)
    localStorage.setItem("feedback_last_seen", now)
    document.dispatchEvent(new CustomEvent("notices-seen"))
    document.dispatchEvent(new CustomEvent("feedback-seen"))
  }, [])

  // Admin прирівняний до головного лікаря (БД: is_head_doctor() = head|admin),
  // тож оголошення створюють обидві ролі.
  const isHead = role === "head" || role === "admin"
  const isAdmin = role === "admin"

  return (
    <div className="flex flex-col md:gap-5">
      {/* Header + tabs */}
      <header className="px-4 pt-4 pb-3 md:desktop-page-header md:px-6 md:py-5">
        <h1 className="text-[22px] font-bold tracking-tight text-[var(--ink)] md:text-[28px]">
          Сповіщення
        </h1>
        <div className="glass mt-3 flex gap-1 rounded-xl p-1">
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
        <NoticesTab user={user} isHead={isHead} />
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
}: {
  user: ReturnType<typeof useCalendarContext>["user"]
  isHead: boolean
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
        <form onSubmit={handlePublish} className="glass flex flex-col gap-3 rounded-2xl p-4 md:p-5">
          <Textarea
            rows={3}
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="Текст оголошення для всіх лікарів…"
            required
            className="resize-none rounded-xl border-[var(--line)] bg-[var(--paper)] px-3.5 py-3 text-[15px] text-[var(--ink)] placeholder:text-[var(--muted-col)] focus-visible:ring-2 focus-visible:ring-[var(--teal-mid)]"
          />
          <div className="flex items-center justify-end">
            <Button
              type="submit"
              disabled={publishing || !text.trim()}
              className="h-10 rounded-xl bg-[var(--teal)] px-5 text-[14px] font-semibold text-[var(--on-teal)] transition-colors hover:bg-[var(--teal-dark)] disabled:opacity-40"
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
          {notices.map((notice) => (
            <Card
              key={notice.id}
              className="glass-hover gap-0 rounded-2xl py-0"
            >
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
    // Відкрили вкладку фідбеку → позначаємо активність переглянутою й
    // повідомляємо layout перерахувати бейдж.
    localStorage.setItem("feedback_last_seen", new Date().toISOString())
    document.dispatchEvent(new CustomEvent("feedback-seen"))
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
    <div className="flex flex-col gap-4 px-4 pb-6 md:px-0">
      {/* Форма створення тікета — для команди. Адмін тікети приймає, а не
          створює, тож йому форму не показуємо. */}
      {!isAdmin && (
      <form onSubmit={handleSend} className="flex flex-col gap-3">
        {/* Сегментований перемикач типу */}
        <div className="grid grid-cols-2 gap-1 rounded-2xl bg-[var(--paper)] p-1">
          {(Object.keys(TYPE_META) as FeedbackType[]).map((t) => {
            const M = TYPE_META[t]
            const active = type === t
            return (
              <button
                key={t}
                type="button"
                onClick={() => setType(t)}
                className={`flex items-center justify-center gap-1.5 rounded-xl py-2.5 text-[13px] font-bold transition-all ${
                  active
                    ? t === "bug"
                      ? "bg-white text-red-600 shadow-sm"
                      : "bg-white text-violet-600 shadow-sm"
                    : "text-[var(--muted-col)]"
                }`}
              >
                <M.icon className="h-4 w-4" />
                {M.label}
              </button>
            )
          })}
        </div>

        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder={type === "bug" ? "Що зламалось?" : "Що варто покращити?"}
          required
          className="glass h-12 rounded-2xl px-4 text-[15px] font-semibold text-[var(--ink)] outline-none ring-0 transition placeholder:font-normal placeholder:text-[var(--muted-col)] focus:ring-2 focus:ring-[var(--teal-mid)]"
        />
        <textarea
          rows={4}
          value={body}
          onChange={(e) => setBody(e.target.value)}
          placeholder="Деталі: на якому екрані, що очікували, кроки… (необов'язково)"
          className="glass resize-none rounded-2xl px-4 py-3 text-[14px] leading-relaxed text-[var(--ink)] outline-none ring-0 transition placeholder:text-[var(--muted-col)] focus:ring-2 focus:ring-[var(--teal-mid)]"
        />

        <button
          type="submit"
          disabled={sending || !title.trim()}
          className="flex h-12 items-center justify-center gap-2 rounded-2xl bg-[var(--teal)] text-[15px] font-bold text-[var(--on-teal)] shadow-lg shadow-[var(--teal)]/20 transition-all hover:bg-[var(--teal-dark)] active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-40 disabled:shadow-none"
        >
          <Send className="h-4 w-4" />
          {sending ? "Надсилаємо…" : "Надіслати"}
        </button>
        <p className="text-center text-[11px] text-[var(--muted-col)]">
          Надсилається від імені <span className="font-semibold text-[var(--ink-2)]">{authorName}</span>
        </p>
      </form>
      )}

      {/* Фільтр статусів */}
      {!loading && items.length > 0 && (
        <div className="flex flex-wrap items-center gap-2 border-t border-[var(--line)] pt-4">
          <button
            onClick={() => setFilter("all")}
            className={`rounded-full px-3 py-1.5 text-[12px] font-bold transition-colors ${
              filter === "all"
                ? "bg-[var(--ink)] text-white"
                : "bg-[var(--paper)] text-[var(--muted-col)] hover:text-[var(--ink)]"
            }`}
          >
            Усі{openCount > 0 ? ` · ${openCount}` : ""}
          </button>
          {STATUS_ORDER.map((s) => {
            const active = filter === s
            const count = items.filter((i) => i.status === s).length
            return (
              <button
                key={s}
                onClick={() => setFilter(s)}
                className={`rounded-full border px-3 py-1.5 text-[12px] font-bold transition-colors ${
                  active ? STATUS_META[s].cls : "border-transparent bg-[var(--paper)] text-[var(--muted-col)] hover:text-[var(--ink)]"
                }`}
              >
                {STATUS_META[s].label}
                {count > 0 ? ` · ${count}` : ""}
              </button>
            )
          })}
        </div>
      )}

      {loading && (
        <div className="py-12 flex flex-col items-center gap-3">
          <div className="w-8 h-8 rounded-full border-2 border-[var(--teal)] border-t-transparent animate-spin" />
          <span className="text-[13px] text-[var(--muted-col)]">Завантаження…</span>
        </div>
      )}

      {!loading && items.length === 0 && (
        <div className="flex flex-col items-center gap-2 py-12 text-center">
          <div className="mb-1 flex gap-2 text-[var(--muted-col)]">
            <Bug className="h-5 w-5" />
            <Lightbulb className="h-5 w-5" />
          </div>
          <p className="text-[15px] font-bold text-[var(--ink)]">Тут поки тихо</p>
          <p className="max-w-[260px] text-[13px] leading-relaxed text-[var(--muted-col)]">
            Помітили помилку чи маєте ідею, як зробити краще? Напишіть у формі вище — побачу одразу.
          </p>
        </div>
      )}

      {!loading && visible.length > 0 && (
        <div className="flex flex-col gap-2.5 md:grid md:grid-cols-2 md:gap-4">
          {visible.map((item) => {
            const T = TYPE_META[item.type]
            const canDelete = isAdmin || item.created_by === user.id
            return (
              <Card key={item.id} className="glass-hover gap-0 rounded-2xl py-0">
                <div className="px-4 py-3.5">
                  {/* Бейджі типу + статусу */}
                  <div className="mb-2 flex items-center gap-2">
                    <span className={`inline-flex items-center gap-1 rounded-md border px-1.5 py-0.5 text-[11px] font-bold ${T.cls}`}>
                      <T.icon className="h-3 w-3" />
                      {T.label}
                    </span>
                    <span className={`rounded-md border px-1.5 py-0.5 text-[11px] font-bold ${STATUS_META[item.status].cls}`}>
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
                            item.status === s ? STATUS_META[s].cls : "glass border-transparent text-[var(--muted-col)]"
                          }`}
                        >
                          {STATUS_META[s].label}
                        </button>
                      ))}
                    </div>
                  )}

                  {/* Тред відповідей — пишуть admin та автор тікета */}
                  <FeedbackReplies
                    feedbackId={item.id}
                    replyCount={item.reply_count ?? 0}
                    canReply={isAdmin || item.created_by === user.id}
                    isAdmin={isAdmin}
                    currentUserId={user.id}
                    authorName={authorName}
                  />
                </div>
              </Card>
            )
          })}
        </div>
      )}
    </div>
  )
}

// ─── Тред відповідей на тікет ────────────────────────────────────────────────

function FeedbackReplies({
  feedbackId,
  replyCount,
  canReply,
  isAdmin,
  currentUserId,
  authorName,
}: {
  feedbackId: string
  replyCount: number
  canReply: boolean
  isAdmin: boolean
  currentUserId: string
  authorName: string
}) {
  const [open, setOpen] = useState(false)
  const [replies, setReplies] = useState<FeedbackReply[]>([])
  const [loading, setLoading] = useState(false)
  const [text, setText] = useState("")
  const [sending, setSending] = useState(false)
  const [busyId, setBusyId] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setReplies(await fetchReplies(feedbackId))
    setLoading(false)
  }, [feedbackId])

  const toggle = () => {
    const next = !open
    setOpen(next)
    if (next && replies.length === 0) load()
  }

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!text.trim()) return
    setSending(true)
    await createReply({ feedbackId, body: text.trim(), authorName })
    setText("")
    setSending(false)
    load()
  }

  const handleDelete = async (id: string) => {
    setBusyId(id)
    await deleteReply(id)
    setBusyId(null)
    load()
  }

  // Лічильник у згорнутому стані бере серверний replyCount; коли відкрито —
  // фактичну довжину завантаженого треду (актуальніше після додавання/видалення).
  const count = open ? replies.length : replyCount

  return (
    <div className="mt-2.5 border-t border-[var(--line)] pt-2.5">
      <button
        type="button"
        onClick={toggle}
        className="flex items-center gap-1.5 text-[12px] font-semibold text-[var(--muted-col)] transition-colors hover:text-[var(--ink)]"
      >
        <MessageSquare className="h-3.5 w-3.5" />
        {count > 0 ? `Відповіді · ${count}` : "Відповісти"}
      </button>

      {open && (
        <div className="mt-2.5 flex flex-col gap-2">
          {loading && replies.length === 0 && (
            <span className="text-[12px] text-[var(--muted-col)]">Завантаження…</span>
          )}

          {replies.map((r) => {
            const mine = r.created_by === currentUserId
            return (
              <div key={r.id} className="flex gap-2 rounded-xl bg-[var(--paper)] px-3 py-2">
                <CornerDownRight className="mt-0.5 h-3.5 w-3.5 flex-shrink-0 text-[var(--muted-col)]" />
                <div className="min-w-0 flex-1">
                  <p className="text-[13px] leading-relaxed text-[var(--ink)] whitespace-pre-wrap">{r.body}</p>
                  <div className="mt-1 flex items-center justify-between gap-2">
                    <span className="text-[10px] font-medium text-[var(--muted-col)]">
                      {r.author_name ? doctorShortName(r.author_name) : "—"} · {timeAgo(r.created_at)}
                    </span>
                    {(isAdmin || mine) && (
                      <button
                        type="button"
                        disabled={busyId === r.id}
                        onClick={() => handleDelete(r.id)}
                        className="text-[var(--muted-col)] transition-colors hover:text-red-500 disabled:opacity-50"
                        aria-label="Видалити відповідь"
                      >
                        <Trash2 className="h-3 w-3" />
                      </button>
                    )}
                  </div>
                </div>
              </div>
            )
          })}

          {!loading && replies.length === 0 && (
            <span className="text-[12px] text-[var(--muted-col)]">Відповідей поки немає.</span>
          )}

          {canReply && (
            <form onSubmit={handleSend} className="mt-1 flex items-end gap-2">
              <textarea
                rows={1}
                value={text}
                onChange={(e) => setText(e.target.value)}
                placeholder="Написати відповідь…"
                className="min-h-9 flex-1 resize-none rounded-xl border border-[var(--line)] bg-white/55 px-3 py-2 text-[13px] text-[var(--ink)] outline-none placeholder:text-[var(--muted-col)] focus:ring-2 focus:ring-[var(--teal-mid)]"
              />
              <Button
                type="submit"
                disabled={sending || !text.trim()}
                className="h-9 rounded-xl bg-[var(--teal)] px-3 text-[13px] font-semibold text-[var(--on-teal)] hover:bg-[var(--teal-dark)] disabled:opacity-40"
              >
                <Send className="h-3.5 w-3.5" />
              </Button>
            </form>
          )}
        </div>
      )}
    </div>
  )
}
