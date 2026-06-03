"use client"

import { createContext, useContext } from "react"
import { User } from "@supabase/supabase-js"
import { Appointment } from "@/types"
import { Notice } from "@/types"

export type CalendarContextType = {
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
