"use client"

import { createContext, useContext, useState } from "react"
import { Appointment } from "@/types"
import { useAppointments } from "@/hooks/useAppointments"

// Записи (з realtime) + календарний UI-стан (обрана дата).
export type AppointmentsContextType = {
  appointments: Appointment[]
  reload: () => void
  selectedDate: Date
  setSelectedDate: (d: Date) => void
}

const AppointmentsContext = createContext<AppointmentsContextType | null>(null)

export function useAppointmentsContext() {
  const ctx = useContext(AppointmentsContext)
  if (!ctx) throw new Error("useAppointmentsContext must be used within AppointmentsProvider")
  return ctx
}

export function AppointmentsProvider({ children }: { children: React.ReactNode }) {
  const { appointments, reload } = useAppointments()
  const [selectedDate, setSelectedDate] = useState(() => {
    const d = new Date()
    d.setHours(0, 0, 0, 0)
    return d
  })

  return (
    <AppointmentsContext.Provider value={{ appointments, reload, selectedDate, setSelectedDate }}>
      {children}
    </AppointmentsContext.Provider>
  )
}
