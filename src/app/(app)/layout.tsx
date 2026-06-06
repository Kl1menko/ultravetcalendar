"use client"

import { useEffect, useState, useCallback } from "react"
import { useRouter } from "next/navigation"
import Image from "next/image"
import { User } from "@supabase/supabase-js"
import { supabase } from "@/lib/supabase"
import { useAppointments } from "@/hooks/useAppointments"
import { fetchNotices } from "@/lib/notices"
import {
  canSeeClients as canSeeClientsFn,
  canSeePrices as canSeePricesFn,
  doctorForEmail,
  roleForEmail,
} from "@/lib/doctors"
import AppShell from "@/components/AppShell"
import AppointmentForm from "@/components/AppointmentForm"
import AppointmentDetails from "@/components/AppointmentDetails"
import SearchDialog from "@/components/SearchDialog"
import NoticeBanner from "@/components/NoticeBanner"
import { Appointment, Notice } from "@/types"
import { CalendarContext } from "@/context/calendar"

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

  const userCanSeePrices = canSeePricesFn(user?.email)
  const { appointments, reload } = useAppointments(userCanSeePrices)

  // Alerts badge
  const [alertsBadge, setAlertsBadge] = useState(0)

  // In-app notice banner
  const [bannerNotice, setBannerNotice] = useState<Notice | null>(null)

  const loadBadge = useCallback(async () => {
    if (!user) return
    const notices = await fetchNotices()
    const lastSeen = localStorage.getItem("notices_last_seen") || "1970-01-01T00:00:00Z"
    const unseen = notices.filter((n) => n.created_at > lastSeen).length
    setAlertsBadge(unseen)
  }, [user])

  useEffect(() => {
    // loadBadge() — async: setAlertsBadge лише після await fetchNotices,
    // тож синхронних каскадних ре-рендерів немає (правило хибно-позитивне тут).
    // eslint-disable-next-line react-hooks/set-state-in-effect
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
    const isHead = roleForEmail(user.email) === "head"

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
        <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-white shadow-lg shadow-teal-700/15 ring-1 ring-[var(--teal-mid)] animate-pulse-logo">
          <Image src="/logo.svg" alt="UltraVet" width={40} height={40} unoptimized />
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
          role: roleForEmail(user.email),
          currentDoctor: doctorForEmail(user.email),
          canSeePrices: userCanSeePrices,
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
        userId={user.id}
        canSeePrices={userCanSeePrices}
      />

      <AppointmentDetails
        appointment={detailsAppt}
        onClose={() => setDetailsAppt(null)}
        onEdit={(appt) => { setDetailsAppt(null); openEditAppointment(appt) }}
        onDeleted={reload}
        canSeePrices={userCanSeePrices}
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

