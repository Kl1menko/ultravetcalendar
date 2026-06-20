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
    // load() — async: усі setState відбуваються лише після await fetchAppointments,
    // тож синхронних каскадних ре-рендерів немає (правило хибно-позитивне тут).
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load()

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
