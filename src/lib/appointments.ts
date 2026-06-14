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
    age: row.age || "",
    weight: row.weight || "",
    address: row.address || "",
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

// Усі читають записи з view appointments_public. Суми (price) тепер відкриті
// для всіх authenticated прямо у view (див. supabase/appointment-prices-for-all.sql),
// тож окремий RPC більше не потрібен — normalizeRow забирає price з рядка.
//
// Параметр зберігаємо для зворотної сумісності виклику: коли false, price
// обнуляємо в нормалізованому результаті (на випадок, якщо колись знадобиться
// приховати суми для якоїсь ролі без зміни SQL).
//
// ⚠️ Поки supabase/rls-policies.sql + appointment-prices-for-all.sql не
// застосовано (немає view) — записи просто не завантажаться. Накатай SQL.
export async function fetchAppointments(canSeePrices = false): Promise<Appointment[]> {
  const { data, error } = await supabase
    .from("appointments_public")
    .select("*")
    .order("date", { ascending: true })
    .order("start_time", { ascending: true })

  if (error) {
    if (isMissingObject(error.code)) {
      console.error(
        "fetchAppointments: view appointments_public відсутній — застосуй supabase/rls-policies.sql"
      )
    } else {
      console.error("fetchAppointments error:", error)
    }
    return []
  }

  const rows = (data as unknown as AppointmentRow[]).map(normalizeRow)

  if (!canSeePrices) return rows.map((r) => ({ ...r, price: 0 }))

  return rows
}

export type AppointmentPayload = {
  date: string
  start_time: string
  end_time: string
  client: string
  phone: string
  pet: string
  animal: string
  age: string
  weight: string
  address: string
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
