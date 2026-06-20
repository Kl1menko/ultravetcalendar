"use client"

import { User } from "@supabase/supabase-js"
import { Appointment } from "@/types"
import { Notice } from "@/types"
import { DoctorRole, DoctorName } from "@/lib/doctors"
import { useAuth } from "@/context/auth"
import { useAppointmentsContext } from "@/context/appointments"
import { useNoticesContext } from "@/context/notices"
import { useModalsContext } from "@/context/modals"

// Публічний фасад для сторінок. Логіка розбита по провайдерах (auth/appointments/
// notices/modals), але споживачі бачать єдиний стабільний контракт через
// useCalendarContext() — щоб не переписувати їх при розбитті god-component.
export type CalendarContextType = {
  appointments: Appointment[]
  selectedDate: Date
  setSelectedDate: (d: Date) => void
  user: User
  /** Роль поточного користувача (head / doctor / assistant). */
  role: DoctorRole
  /** Ім'я лікаря, прив'язане до користувача (для персональної аналітики). */
  currentDoctor: DoctorName | null
  /** Доступ до аналітики коштів (сторінка «Аналітика») — лише head/admin. */
  canSeePrices: boolean
  /** Має доступ до бази клієнтів. */
  canSeeClients: boolean
  reload: () => void
  openDetailsAppt: (appt: Appointment) => void
  openNewAppointmentAtTime: (time: string) => void
  openEditAppointment: (appt: Appointment) => void
  triggerBanner: (notice: Notice) => void
}

export function useCalendarContext(): CalendarContextType {
  const { user, role, currentDoctor, canSeePrices, canSeeClients } = useAuth()
  const { appointments, reload, selectedDate, setSelectedDate } = useAppointmentsContext()
  const { triggerBanner } = useNoticesContext()
  const { openDetailsAppt, openNewAppointmentAtTime, openEditAppointment } = useModalsContext()

  return {
    appointments,
    selectedDate,
    setSelectedDate,
    user,
    role,
    currentDoctor,
    canSeePrices,
    canSeeClients,
    reload,
    openDetailsAppt,
    openNewAppointmentAtTime,
    openEditAppointment,
    triggerBanner,
  }
}
