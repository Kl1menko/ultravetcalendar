"use client"

import { useEffect } from "react"
import { registerServiceWorker } from "@/lib/push"
import AppShell from "@/components/AppShell"
import UpdateBanner from "@/components/UpdateBanner"
import { AuthProvider } from "@/context/auth"
import { AppointmentsProvider } from "@/context/appointments"
import { NoticesProvider } from "@/context/notices"
import { ModalsProvider } from "@/context/modals"

export default function AppLayout({ children }: { children: React.ReactNode }) {
  // Реєструємо service worker (потрібен для Web Push + офлайн-кешу).
  useEffect(() => {
    registerServiceWorker()
  }, [])

  return (
    <AuthProvider>
      <AppointmentsProvider>
        <NoticesProvider>
          <ModalsProvider>
            <UpdateBanner />
            <AppShell>{children}</AppShell>
          </ModalsProvider>
        </NoticesProvider>
      </AppointmentsProvider>
    </AuthProvider>
  )
}
