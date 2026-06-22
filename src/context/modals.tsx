"use client"

import { createContext, useContext, useState } from "react"
import { Appointment } from "@/types"
import AppointmentForm from "@/components/AppointmentForm"
import AppointmentDetails from "@/components/AppointmentDetails"
import SearchDialog from "@/components/SearchDialog"
import { useAuth } from "@/context/auth"
import { useAppointmentsContext } from "@/context/appointments"

// Оркестрація глобальних модалок: форма (нова/редагування/повтор), деталі, пошук.
export type ModalsContextType = {
  openNewAppointment: () => void
  openNewAppointmentAtTime: (time: string) => void
  openEditAppointment: (appt: Appointment) => void
  openDetailsAppt: (appt: Appointment) => void
  openSearch: () => void
}

const ModalsContext = createContext<ModalsContextType | null>(null)

export function useModalsContext() {
  const ctx = useContext(ModalsContext)
  if (!ctx) throw new Error("useModalsContext must be used within ModalsProvider")
  return ctx
}

export function ModalsProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth()
  const { appointments, selectedDate, reload } = useAppointmentsContext()

  const [formOpen, setFormOpen] = useState(false)
  const [prefillTime, setPrefillTime] = useState<string | undefined>()
  const [editingAppt, setEditingAppt] = useState<Appointment | null>(null)
  const [duplicatingAppt, setDuplicatingAppt] = useState<Appointment | null>(null)
  const [detailsAppt, setDetailsAppt] = useState<Appointment | null>(null)
  const [searchOpen, setSearchOpen] = useState(false)

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

  return (
    <ModalsContext.Provider
      value={{
        openNewAppointment,
        openNewAppointmentAtTime,
        openEditAppointment,
        openDetailsAppt: setDetailsAppt,
        openSearch: () => setSearchOpen(true),
      }}
    >
      {children}

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
        appointments={appointments}
      />

      <AppointmentDetails
        appointment={detailsAppt}
        onClose={() => setDetailsAppt(null)}
        onEdit={(appt) => { setDetailsAppt(null); openEditAppointment(appt) }}
        onDuplicate={(appt) => { setDetailsAppt(null); openDuplicateAppointment(appt) }}
        onDeleted={reload}
        canSeePrices={true}
        canDelete={true}
      />

      <SearchDialog
        open={searchOpen}
        onClose={() => setSearchOpen(false)}
        appointments={appointments}
        onSelectAppointment={(appt) => { setSearchOpen(false); setDetailsAppt(appt) }}
      />
    </ModalsContext.Provider>
  )
}
