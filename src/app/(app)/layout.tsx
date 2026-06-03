"use client"

import { useEffect, useState, useCallback } from "react"
import { useRouter } from "next/navigation"
import { User } from "@supabase/supabase-js"
import { supabase } from "@/lib/supabase"
import { useAppointments } from "@/hooks/useAppointments"
import { fetchNotices } from "@/lib/notices"
import { HEAD_DOCTOR_EMAIL } from "@/lib/constants"
import AppShell from "@/components/AppShell"
import AppointmentForm from "@/components/AppointmentForm"
import AppointmentDetails from "@/components/AppointmentDetails"
import SearchDialog from "@/components/SearchDialog"
import NoticeBanner from "@/components/NoticeBanner"
import { Appointment } from "@/types"
import { Notice } from "@/types"

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter()
  const [user, setUser] = useState<User | null>(null)
  const [authLoading, setAuthLoading] = useState(true)

  // Modals
  const [formOpen, setFormOpen] = useState(false)
  const [prefillTime, setPrefillTime] = useState<string | undefined>()
  const [editingAppt, setEditingAppt] = useState<Appointment | null>(null)
  const [detailsAppt, setDetailsAppt] = useState<Appointment | null>(null)
  const [searchOpen, setSearchOpen] = useState(false)

  // Shared date state for the calendar
  const [selectedDate, setSelectedDate] = useState(() => {
    const d = new Date()
    d.setHours(0, 0, 0, 0)
    return d
  })

  const { appointments, reload } = useAppointments()

  // Alerts badge
  const [alertsBadge, setAlertsBadge] = useState(0)

  // In-app notice banner
  const [bannerNotice, setBannerNotice] = useState<Notice | null>(null)

  const loadBadge = useCallback(async () => {
    if (!user || user.email !== HEAD_DOCTOR_EMAIL) return
    const notices = await fetchNotices()
    const lastSeen = localStorage.getItem("notices_last_seen") || "1970-01-01T00:00:00Z"
    const unseen = notices.filter((n) => n.created_at > lastSeen).length
    setAlertsBadge(unseen)
  }, [user])

  useEffect(() => {
    loadBadge()
  }, [loadBadge])

  useEffect(() => {
    const handler = () => setAlertsBadge(0)
    document.addEventListener("notices-seen", handler)
    return () => document.removeEventListener("notices-seen", handler)
  }, [])

  // Realtime: показуємо банер коли head публікує нове сповіщення
  useEffect(() => {
    if (!user) return
    const isHead = user.email === HEAD_DOCTOR_EMAIL

    const channel = supabase
      .channel("notices-realtime")
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
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }, [user])

  // Auth
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
    setPrefillTime(undefined)
    setFormOpen(true)
  }

  const openNewAppointmentAtTime = (time: string) => {
    setEditingAppt(null)
    setPrefillTime(time)
    setFormOpen(true)
  }

  const openEditAppointment = (appt: Appointment) => {
    setEditingAppt(appt)
    setFormOpen(true)
  }

  if (authLoading || !user) {
    return (
      <div className="flex min-h-dvh items-center justify-center bg-[var(--teal-light)]">
        <div className="w-14 h-14 rounded-2xl bg-[var(--teal)] text-white flex items-center justify-center text-lg font-black animate-pulse-logo">
          UV
        </div>
      </div>
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
        userId={user.id}
      />

      <AppointmentDetails
        appointment={detailsAppt}
        onClose={() => setDetailsAppt(null)}
        onEdit={(appt) => { setDetailsAppt(null); openEditAppointment(appt) }}
        onDeleted={reload}
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

// ─── Context ────────────────────────────────────────────────────────────────

import { createContext, useContext } from "react"

type CalendarContextType = {
  appointments: Appointment[]
  selectedDate: Date
  setSelectedDate: (d: Date) => void
  user: User
  reload: () => void
  openDetailsAppt: (appt: Appointment) => void
  openNewAppointmentAtTime: (time: string) => void
  openEditAppointment: (appt: Appointment) => void
  triggerBanner: (notice: Notice) => void
}

export const CalendarContext = createContext<CalendarContextType | null>(null)

export function useCalendarContext() {
  const ctx = useContext(CalendarContext)
  if (!ctx) throw new Error("useCalendarContext must be used within AppLayout")
  return ctx
}
