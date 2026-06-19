"use client"

import { useEffect, useState, useCallback } from "react"
import { useRouter } from "next/navigation"
import { User } from "@supabase/supabase-js"
import { supabase } from "@/lib/supabase"
import { useAppointments } from "@/hooks/useAppointments"
import { fetchNotices } from "@/lib/notices"
import { fetchFeedback } from "@/lib/feedback"
import { registerServiceWorker } from "@/lib/push"
import {
  canSeeClients as canSeeClientsFn,
  canSeePrices as canSeePricesFn,
  canSeeAppointmentPrices as canSeeAppointmentPricesFn,
  doctorForEmail,
  roleForEmail,
} from "@/lib/doctors"
import AppShell from "@/components/AppShell"
import AppointmentForm from "@/components/AppointmentForm"
import AppointmentDetails from "@/components/AppointmentDetails"
import SearchDialog from "@/components/SearchDialog"
import NoticeBanner from "@/components/NoticeBanner"
import SplashScreen from "@/components/SplashScreen"
import { Appointment, Notice } from "@/types"
import { CalendarContext } from "@/context/calendar"

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter()
  const [user, setUser] = useState<User | null>(null)
  const [authLoading, setAuthLoading] = useState(true)

  const [formOpen, setFormOpen] = useState(false)
  const [prefillTime, setPrefillTime] = useState<string | undefined>()
  const [editingAppt, setEditingAppt] = useState<Appointment | null>(null)
  const [duplicatingAppt, setDuplicatingAppt] = useState<Appointment | null>(null)
  const [detailsAppt, setDetailsAppt] = useState<Appointment | null>(null)
  const [searchOpen, setSearchOpen] = useState(false)

  const [selectedDate, setSelectedDate] = useState(() => {
    const d = new Date()
    d.setHours(0, 0, 0, 0)
    return d
  })

  const userCanSeePrices = canSeePricesFn(user?.email)
  const userCanSeeApptPrices = canSeeAppointmentPricesFn(user?.email)
  // Суми у записах бачать усі → завантажуємо price для будь-якого користувача.
  const { appointments, reload } = useAppointments(userCanSeeApptPrices)

  const [alertsBadge, setAlertsBadge] = useState(0)
  const [bannerNotice, setBannerNotice] = useState<Notice | null>(null)

  // Двосторонній лічильник непрочитаного на вкладці «Сповіщення»:
  //   • Оголошення (notices) — нові від head/admin, бачать лікарі та асистенти.
  //   • Фідбек (тікети + відповіді) — нова активність від інших членів команди:
  //       admin бачить нові тікети/відповіді команди, автор тікета — відповіді
  //       на свій тікет. Власні дописи не рахуємо (created_by === user.id).
  // Маркери «бачив» — окремі в localStorage, оновлюються при відкритті кожної
  // вкладки (події notices-seen / feedback-seen зі сторінки /alerts).
  const EPOCH = "1970-01-01T00:00:00Z"

  const loadBadge = useCallback(async () => {
    if (!user) return
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
    if (!user) return
    const isHead = roleForEmail(user.email) === "head"

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
  }, [user])

  // Реєструємо service worker (потрібен для Web Push + офлайн-кешу).
  useEffect(() => {
    registerServiceWorker()
  }, [])

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!session) {
        router.replace("/login")
      } else {
        setUser(session.user)
        setAuthLoading(false)
      }
    })

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!session) {
        router.replace("/login")
      } else {
        setUser(session.user)
        setAuthLoading(false)
      }
    })

    return () => subscription.unsubscribe()
  }, [router])

  const openNewAppointment = () => {
    setEditingAppt(null)
    setDuplicatingAppt(null)
    setPrefillTime(undefined)
    setFormOpen(true)
  }

  const openNewAppointmentAtTime = (time: string) => {
    setEditingAppt(null)
    setDuplicatingAppt(null)
    setPrefillTime(time)
    setFormOpen(true)
  }

  const openEditAppointment = (appt: Appointment) => {
    setDuplicatingAppt(null)
    setEditingAppt(appt)
    setFormOpen(true)
  }

  // «Повторити»: відкриваємо форму, заповнену даними запису, але як НОВИЙ
  // (editing=null), тож збереження створить окрему копію, яку можна редагувати.
  const openDuplicateAppointment = (appt: Appointment) => {
    setEditingAppt(null)
    setPrefillTime(undefined)
    setDuplicatingAppt(appt)
    setFormOpen(true)
  }

  if (authLoading || !user) {
    return (
      <SplashScreen label="Перевіряємо сесію" sublabel="Завантажуємо календар клініки" />
    )
  }

  return (
    <>
    <NoticeBanner notice={bannerNotice} onDismiss={() => setBannerNotice(null)} />
    <AppShell
      user={user}
      alertsBadge={alertsBadge}
      onNewAppointment={openNewAppointment}
      onSearch={() => setSearchOpen(true)}
    >
      {/* Provide context to children via a custom approach — pass via data attributes won't work,
          Instead we use a simple approach: children receive full render with context through
          shared state via window globals for simplicity, but better: use React context */}
      <CalendarContext.Provider
        value={{
          appointments,
          selectedDate,
          setSelectedDate,
          user,
          role: roleForEmail(user.email),
          currentDoctor: doctorForEmail(user.email),
          canSeePrices: userCanSeePrices,
          canSeeAppointmentPrices: userCanSeeApptPrices,
          canSeeClients: canSeeClientsFn(user.email),
          reload,
          openDetailsAppt: setDetailsAppt,
          openNewAppointmentAtTime,
          openEditAppointment,
          triggerBanner: setBannerNotice,
        }}
      >
        {children}
      </CalendarContext.Provider>

      {/* Global modals */}
      <AppointmentForm
        open={formOpen}
        onClose={() => setFormOpen(false)}
        onSaved={reload}
        selectedDate={selectedDate}
        prefillTime={prefillTime}
        editing={editingAppt}
        duplicating={duplicatingAppt}
        userId={user.id}
        canEditPrice
      />

      <AppointmentDetails
        appointment={detailsAppt}
        onClose={() => setDetailsAppt(null)}
        onEdit={(appt) => { setDetailsAppt(null); openEditAppointment(appt) }}
        onDuplicate={(appt) => { setDetailsAppt(null); openDuplicateAppointment(appt) }}
        onDeleted={reload}
        canSeePrices={userCanSeeApptPrices}
      />

      <SearchDialog
        open={searchOpen}
        onClose={() => setSearchOpen(false)}
        appointments={appointments}
        onSelectAppointment={(appt) => { setSearchOpen(false); setDetailsAppt(appt) }}
      />
    </AppShell>
    </>
  )
}
