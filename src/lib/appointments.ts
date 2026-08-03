import { supabase } from "./supabase";
import { Appointment, AppointmentRow, AppointmentStatus } from "@/types";
import { normalizeStatus } from "./status";
import { logAppError } from "./error-log";

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
    status: normalizeStatus(row.status) ?? "Заплановано",
    created_by: row.created_by,
    remind: row.remind ?? false,
  };
}

// Помилка «об'єкта (view/таблиці) немає в схемі» — RLS SQL ще не застосовано.
// PostgREST повертає PGRST205 (не знайдено в кеші схеми), Postgres — 42P01.
function isMissingObject(code?: string) {
  return code === "PGRST205" || code === "42P01";
}

// Поля remind/reminded_at недоступні в БД — повна міграція ще не накатана.
// Можливі коди:
//   PGRST204 / 42703 — колонки взагалі немає в схемі (add-column не зроблено);
//   42501            — колонка є, але немає column-level grant на неї
//                      (rls-policies дає insert/update лише на перелік колонок).
// У будь-якому з цих випадків повторюємо запит без полів нагадування.
function isReminderFieldUnavailable(code?: string) {
  return code === "PGRST204" || code === "42703" || code === "42501";
}

// Прибирає поля нагадування з payload — фолбек, якщо їх ще немає/недоступні в БД.
// Базовий запис не має ламатись через відсутню опційну фічу нагадувань.
function stripReminderFields<T extends Record<string, unknown>>(payload: T): T {
  const rest = { ...payload };
  delete rest.remind;
  delete rest.reminded_at;
  delete rest.client_reminded_at;
  return rest;
}

// Усі читають записи з view appointments_public. Суми (price) відкриті для всіх
// authenticated прямо у view (див. supabase/appointment-prices-for-all.sql) — їх
// бачать усі працівники, тож normalizeRow завжди забирає price з рядка.
//
// ⚠️ Поки supabase/rls-policies.sql + appointment-prices-for-all.sql не
// застосовано (немає view) — записи просто не завантажаться. Накатай SQL.
//
// fromDate (ISO «YYYY-MM-DD», включно) обмежує вибірку нижньою межею дати, щоб
// не тягнути всю історію в браузер. Це дефолтне «робоче вікно» календаря —
// старіші записи довантажуються окремо (див. fetchAppointments({ fromDate: null })
// для повної історії: клієнти/аналітика за весь час). Запит спирається на індекс
// appointments_date_start_idx (supabase/add-appointments-date-index.sql).
//
// PostgREST за замовчуванням обрізає відповідь до 1000 рядків (max-rows), тож при
// зростанні бази найдальші за датою записи (сортування зростає) мовчки губились —
// їх просто не було у відповіді, хоча в БД вони існували. Довантажуємо сторінками
// по PAGE_SIZE, поки чергова сторінка не виявиться неповною.
const PAGE_SIZE = 1000;

export async function fetchAppointments(
  opts: { fromDate?: string | null } = {},
): Promise<Appointment[]> {
  const rows: AppointmentRow[] = [];
  let from = 0;

  for (;;) {
    let query = supabase
      .from("appointments_public")
      .select("*")
      .order("date", { ascending: true })
      .order("start_time", { ascending: true })
      .range(from, from + PAGE_SIZE - 1);

    if (opts.fromDate) {
      query = query.gte("date", opts.fromDate);
    }

    const { data, error } = await query;

    if (error) {
      if (isMissingObject(error.code)) {
        logAppError(
          "fetchAppointments",
          "view appointments_public відсутній — застосуй supabase/rls-policies.sql",
        );
      } else {
        logAppError("fetchAppointments", error);
      }
      return [];
    }

    const page = data as unknown as AppointmentRow[];
    rows.push(...page);

    if (page.length < PAGE_SIZE) break;
    from += PAGE_SIZE;
  }

  return rows.map(normalizeRow);
}

export type AppointmentPayload = {
  date: string;
  start_time: string;
  end_time: string;
  client: string;
  phone: string;
  pet: string;
  animal: string;
  age: string;
  weight: string;
  address: string;
  service: string;
  price?: number;
  status?: AppointmentStatus;
  doctor: string;
  comment: string;
  created_by?: string;
  remind?: boolean;
  /** Скидання прапорця «вже надіслано» — щоб нагадування пішло знову (новий час). */
  reminded_at?: string | null;
  /** Скидання Telegram-нагадування клієнту — щоб пішло знову на новий час. */
  client_reminded_at?: string | null;
};

export async function createAppointment(
  payload: AppointmentPayload,
): Promise<{ error: Error | null }> {
  let { error } = await supabase.from("appointments").insert(payload);
  // Фолбек: поля remind/reminded_at ще недоступні в БД — повторюємо без них,
  // щоб базовий запис створювався навіть до повного накату міграції нагадувань.
  if (error && isReminderFieldUnavailable(error.code)) {
    ({ error } = await supabase
      .from("appointments")
      .insert(stripReminderFields(payload)));
  }
  if (error) logAppError("createAppointment", error);
  return { error: error ? new Error(error.message) : null };
}

export async function updateAppointment(
  id: string,
  payload: Partial<AppointmentPayload>,
): Promise<{ error: Error | null }> {
  let { error } = await supabase
    .from("appointments")
    .update(payload)
    .eq("id", id);
  if (error && isReminderFieldUnavailable(error.code)) {
    ({ error } = await supabase
      .from("appointments")
      .update(stripReminderFields(payload))
      .eq("id", id));
  }
  if (error) logAppError("updateAppointment", error);
  return { error: error ? new Error(error.message) : null };
}

// Редагування «картки клієнта»: ім'я/телефон/адреса повторюються в усіх записах
// клієнта (окремої таблиці клієнтів немає — вони виводяться з історії записів).
// Тож оновлюємо ці спільні поля одразу в усіх його записах одним запитом по .in().
export type ClientFields = { client: string; phone: string; address: string };

export async function updateClientFields(
  ids: string[],
  fields: ClientFields,
): Promise<{ error: Error | null }> {
  if (ids.length === 0) return { error: null };
  const { error } = await supabase
    .from("appointments")
    .update(fields)
    .in("id", ids);
  if (error) logAppError("updateClientFields", error);
  return { error: error ? new Error(error.message) : null };
}

// Тонка обгортка для швидкої зміни статусу з деталей запису.
export async function updateStatus(
  id: string,
  status: AppointmentStatus,
): Promise<{ error: Error | null }> {
  return updateAppointment(id, { status });
}

export async function deleteAppointment(
  id: string,
): Promise<{ error: Error | null }> {
  const { error } = await supabase.from("appointments").delete().eq("id", id);
  if (error) logAppError("deleteAppointment", error);
  return { error: error ? new Error(error.message) : null };
}

// Видалення кількох записів одним запитом (історія клієнта при видаленні картки).
// Замість N окремих DELETE — один із .in(), щоб не навантажувати мережу.
export async function deleteAppointments(
  ids: string[],
): Promise<{ error: Error | null }> {
  if (ids.length === 0) return { error: null };
  const { error } = await supabase.from("appointments").delete().in("id", ids);
  if (error) logAppError("deleteAppointments", error);
  return { error: error ? new Error(error.message) : null };
}
