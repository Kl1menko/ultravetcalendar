"use client"

import { createContext, useContext, useEffect, useState, useCallback } from "react"
import { supabase } from "@/lib/supabase"
import { fetchNotices } from "@/lib/notices"
import { fetchFeedback } from "@/lib/feedback"
import { Notice } from "@/types"
import NoticeBanner from "@/components/NoticeBanner"
import { useAuth } from "@/context/auth"

// Лічильник непрочитаного на вкладці «Сповіщення» + банер нового оголошення.
export type NoticesContextType = {
  alertsBadge: number
  triggerBanner: (notice: Notice) => void
}

const NoticesContext = createContext<NoticesContextType | null>(null)

export function useNoticesContext() {
  const ctx = useContext(NoticesContext)
  if (!ctx) throw new Error("useNoticesContext must be used within NoticesProvider")
  return ctx
}

const EPOCH = "1970-01-01T00:00:00Z"

export function NoticesProvider({ children }: { children: React.ReactNode }) {
  const { user, role } = useAuth()
  const [alertsBadge, setAlertsBadge] = useState(0)
  const [bannerNotice, setBannerNotice] = useState<Notice | null>(null)

  // Двосторонній лічильник непрочитаного:
  //   • Оголошення (notices) — нові від head/admin, бачать лікарі та асистенти.
  //   • Фідбек (тікети + відповіді) — нова активність від інших членів команди.
  // Маркери «бачив» — окремі в localStorage, оновлюються при відкритті кожної
  // вкладки (події notices-seen / feedback-seen зі сторінки /alerts).
  const loadBadge = useCallback(async () => {
    const noticesSeen = localStorage.getItem("notices_last_seen") || EPOCH
    const feedbackSeen = localStorage.getItem("feedback_last_seen") || EPOCH

    const [notices, feedback] = await Promise.all([fetchNotices(), fetchFeedback()])

    const unseenNotices = notices.filter((n) => n.created_at > noticesSeen).length

    // Нові тікети від інших + тікети з оновленням (updated_at = остання відповідь
    // або зміна статусу). Власні дописи виключаємо.
    const unseenFeedback = feedback.filter(
      (f) =>
        f.created_by !== user.id &&
        (f.created_at > feedbackSeen || f.updated_at > feedbackSeen)
    ).length

    setAlertsBadge(unseenNotices + unseenFeedback)
  }, [user])

  useEffect(() => {
    // loadBadge() — async: setAlertsBadge лише після await, тож синхронних
    // каскадних ре-рендерів немає (правило хибно-позитивне тут).
    // eslint-disable-next-line react-hooks/set-state-in-effect
    loadBadge()
  }, [loadBadge])

  useEffect(() => {
    // Сторінка /alerts повідомляє, що вкладку відкрито → перераховуємо бейдж
    // (маркер last_seen вже оновлено в localStorage перед подією).
    const handler = () => loadBadge()
    document.addEventListener("notices-seen", handler)
    document.addEventListener("feedback-seen", handler)
    return () => {
      document.removeEventListener("notices-seen", handler)
      document.removeEventListener("feedback-seen", handler)
    }
  }, [loadBadge])

  // Realtime: банер на нове оголошення + живий перерахунок бейджа на нову
  // активність у фідбеку (тікети/відповіді від інших).
  useEffect(() => {
    // admin прирівняний до head (може створювати оголошення) — банер на власне
    // оголошення йому теж не показуємо.
    const isHead = role === "head" || role === "admin"

    const channel = supabase
      .channel("alerts-realtime")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "notices" },
        (payload) => {
          const notice = payload.new as Notice
          // Head сам створює — не показуємо йому банер
          if (!isHead) {
            setBannerNotice(notice)
            setAlertsBadge((n) => n + 1)
          }
        }
      )
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "feedback" },
        (payload) => {
          if ((payload.new as { created_by?: string }).created_by !== user.id) {
            setAlertsBadge((n) => n + 1)
          }
        }
      )
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "feedback_replies" },
        (payload) => {
          if ((payload.new as { created_by?: string }).created_by !== user.id) {
            setAlertsBadge((n) => n + 1)
          }
        }
      )
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }, [user, role])

  return (
    <NoticesContext.Provider value={{ alertsBadge, triggerBanner: setBannerNotice }}>
      <NoticeBanner notice={bannerNotice} onDismiss={() => setBannerNotice(null)} />
      {children}
    </NoticesContext.Provider>
  )
}
