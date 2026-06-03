"use client"

import { createContext, useContext } from "react"
import { User } from "@supabase/supabase-js"
import { Appointment } from "@/types"
import { Notice } from "@/types"
import { DoctorRole, DoctorName } from "@/lib/doctors"

export type CalendarContextType = {
  appointments: Appointment[]
  selectedDate: Date
  setSelectedDate: (d: Date) => void
  user: User
  /** Роль поточного користувача (head / doctor / assistant). */
  role: DoctorRole
  /** Ім'я лікаря, прив'язане до користувача (для персональної аналітики). */
  currentDoctor: DoctorName | null
  /** Бачить суми у записах та аналітику коштів. */
  canSeePrices: boolean
  /** Має доступ до бази клієнтів. */
  canSeeClients: boolean
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
