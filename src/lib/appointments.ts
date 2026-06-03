import { supabase } from "./supabase"
import { Appointment, AppointmentRow } from "@/types"

function normalizeRow(row: AppointmentRow): Appointment {
  return {
    id: row.id,
    date: row.date,
    start: row.start_time?.slice(0, 5) || "00:00",
    end: row.end_time?.slice(0, 5) || "00:30",
    client: row.client,
    phone: row.phone,
    pet: row.pet,
    animal: row.animal || row.pet,
    service: row.service,
    doctor: row.doctor,
    comment: row.comment || "",
    price: row.price || 0,
  }
}

export async function fetchAppointments(): Promise<Appointment[]> {
  const { data, error } = await supabase
    .from("appointments")
    .select("*")
    .order("date", { ascending: true })
    .order("start_time", { ascending: true })

  if (error) {
    console.error("fetchAppointments error:", error)
    return []
  }
  return (data as AppointmentRow[]).map(normalizeRow)
}

export type AppointmentPayload = {
  date: string
  start_time: string
  end_time: string
  client: string
  phone: string
  pet: string
  animal: string
  service: string
  price: number
  doctor: string
  comment: string
  created_by?: string
}

export async function createAppointment(
  payload: AppointmentPayload
): Promise<{ error: Error | null }> {
  const { error } = await supabase.from("appointments").insert(payload)
  return { error: error ? new Error(error.message) : null }
}

export async function updateAppointment(
  id: string,
  payload: Partial<AppointmentPayload>
): Promise<{ error: Error | null }> {
  const { error } = await supabase.from("appointments").update(payload).eq("id", id)
  return { error: error ? new Error(error.message) : null }
}

export async function deleteAppointment(id: string): Promise<{ error: Error | null }> {
  const { error } = await supabase.from("appointments").delete().eq("id", id)
  return { error: error ? new Error(error.message) : null }
}
