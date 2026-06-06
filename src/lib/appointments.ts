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
// ⚠️ Жодних fallback'ів на пряму таблицю appointments тут немає НАВМИСНО:
// якщо читати таблицю напряму, колонка price витекла б усім (асистентам теж),
// бо захист price тримається на column-GRANT у БД. Поки supabase/rls-policies.sql
// не застосовано (немає view/RPC) — записи просто не завантажаться, і це правильно:
// краще «нічого не показати», ніж показати ціни тому, кому не можна. Накатай SQL.
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

  if (!canSeePrices) return rows

  // Суми лише для head — виключно через security-definer RPC. Без fallback на таблицю.
  const { data: prices, error: priceError } = await supabase.rpc("appointment_prices")
  if (priceError) {
    if (isMissingFunction(priceError.code)) {
      console.error(
        "appointment_prices RPC відсутній — застосуй supabase/rls-policies.sql"
      )
    } else {
      console.error("appointment_prices error:", priceError)
    }
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
