"use client"

import { useEffect, useState, useCallback } from "react"
import { Appointment } from "@/types"
import { fetchAppointments } from "@/lib/appointments"
import { supabase } from "@/lib/supabase"

export function useAppointments() {
  const [appointments, setAppointments] = useState<Appointment[]>([])
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    const data = await fetchAppointments()
    setAppointments(data)
    setLoading(false)
  }, [])

  useEffect(() => {
    load()

    // Realtime subscription
    const channel = supabase
      .channel("appointments-changes")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "appointments" },
        () => {
          load()
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [load])

  return { appointments, loading, reload: load }
}
