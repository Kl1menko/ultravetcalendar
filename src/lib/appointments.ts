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

// Помилка «об'єкта (view/таблиці) немає в схемі» — RLS SQL ще не застосовано.
// PostgREST повертає PGRST205 (не знайдено в кеші схеми), Postgres — 42P01.
function isMissingObject(code?: string) {
  return code === "PGRST205" || code === "42P01"
}
// Функції немає: PostgREST PGRST202, Postgres 42883.
function isMissingFunction(code?: string) {
  return code === "PGRST202" || code === "42883"
}

// price на рівні БД недоступна напряму (column GRANT відкликано) і прихована у
// view appointments_public. Усі читають записи з цього view, а головний лікар
// додатково доливає суми через security-definer RPC appointment_prices().
//
// Поки supabase/rls-policies.sql не застосовано (немає view/RPC) — м'яко падаємо
// назад на звичайну таблицю appointments, щоб застосунок працював одразу.
export async function fetchAppointments(canSeePrices = false): Promise<Appointment[]> {
  let { data, error } = await supabase
    .from("appointments_public")
    .select("*")
    .order("date", { ascending: true })
    .order("start_time", { ascending: true })

  // Fallback: view ще не створено → читаємо базову таблицю.
  if (error && isMissingObject(error.code)) {
    ;({ data, error } = await supabase
      .from("appointments")
      .select("*")
      .order("date", { ascending: true })
      .order("start_time", { ascending: true }))
  }

  if (error) {
    console.error("fetchAppointments error:", error)
    return []
  }

  const rows = (data as unknown as AppointmentRow[]).map(normalizeRow)

  if (!canSeePrices) return rows

  // Якщо рядки вже містять price (fallback читав appointments напряму) — нічого доливати.
  if (rows.length > 0 && rows.some((r) => r.price > 0)) return rows

  const { data: prices, error: priceError } = await supabase.rpc("appointment_prices")
  if (priceError) {
    // RPC ще немає (SQL не застосовано) → пробуємо прочитати price напряму з таблиці.
    if (isMissingFunction(priceError.code)) {
      const { data: full } = await supabase.from("appointments").select("id, price")
      if (full) {
        const map = new Map<string, number>(
          (full as { id: string; price: number | null }[]).map((p) => [p.id, p.price || 0])
        )
        return rows.map((r) => ({ ...r, price: map.get(r.id) ?? 0 }))
      }
    }
    console.error("appointment_prices error:", priceError)
    return rows
  }

  const priceById = new Map<string, number>(
    (prices as { id: string; price: number | null }[]).map((p) => [p.id, p.price || 0])
  )
  return rows.map((r) => ({ ...r, price: priceById.get(r.id) ?? 0 }))
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
  price?: number
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
