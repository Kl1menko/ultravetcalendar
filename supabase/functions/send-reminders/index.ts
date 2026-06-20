// Supabase Edge Function: push-нагадування про прийом за кілька хвилин до нього.
//
// Тригер — pg_cron, що викликає цю функцію щохвилини (див.
// supabase/add-reminders-cron.sql). На відміну від send-push (реактивний,
// миттєвий на INSERT), ця функція — планувальник: сама сканує найближчі прийоми.
//
// Кому: відповідальному лікарю (appointments.doctor → doctors.name →
//       profiles.doctor_id → profiles.id = auth user → push_subscriptions).
//
// Час: appointments.date + start_time зберігаються в ЛОКАЛЬНОМУ часі клініки
//      (Київ). Порівнюємо з «зараз у Києві». Шлемо ті, що почнуться в межах
//      [0; REMIND_LEAD_MIN] хвилин і ще не нагадані (reminded_at IS NULL).
//      Після відправки ставимо reminded_at, щоб не слати двічі.
//
// Секрети (ті самі, що в send-push):
//   VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY, VAPID_SUBJECT
//   SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY (надаються середовищем).

import { createClient } from "jsr:@supabase/supabase-js@2"
import webpush from "npm:web-push@3.6.7"

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!
const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!

// За скільки хвилин до прийому слати нагадування.
const REMIND_LEAD_MIN = 5
// Таймзона клініки — у ній збережені date/start_time у БД.
const CLINIC_TZ = "Europe/Kyiv"

const admin = createClient(SUPABASE_URL, SERVICE_ROLE)

// ─── VAPID (як у send-push) ───────────────────────────────────────────────────

function normalizeKey(raw: string): string {
  return (raw ?? "")
    .replace(/\s+/g, "")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "")
}

let vapidReady = false
function ensureVapid() {
  if (vapidReady) return
  const pub = normalizeKey(Deno.env.get("VAPID_PUBLIC_KEY") ?? "")
  const priv = normalizeKey(Deno.env.get("VAPID_PRIVATE_KEY") ?? "")
  let subject = (Deno.env.get("VAPID_SUBJECT") ?? "").trim()
  if (!/^(mailto:|https:\/\/)/.test(subject) || subject.includes("...")) {
    subject = "mailto:admin@ultravet.app"
  }
  webpush.setVapidDetails(subject, pub, priv)
  vapidReady = true
}

// ─── Час у таймзоні клініки ───────────────────────────────────────────────────

// Поточний локальний час клініки як хвилини від півночі + ISO-дата (YYYY-MM-DD).
// Рахуємо через Intl, щоб коректно враховувати літній/зимовий час Києва.
function nowInClinic(): { date: string; minutes: number } {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: CLINIC_TZ,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(new Date())

  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? "00"
  const date = `${get("year")}-${get("month")}-${get("day")}`
  // "24" від Intl на опівночі нормалізуємо до 0.
  const hour = Number(get("hour")) % 24
  const minutes = hour * 60 + Number(get("minute"))
  return { date, minutes }
}

function toMinutes(time: string): number {
  const [h, m] = time.slice(0, 5).split(":").map(Number)
  return (h || 0) * 60 + (m || 0)
}

// ─── Типи ─────────────────────────────────────────────────────────────────────

type ApptRow = {
  id: string
  date: string
  start_time: string
  doctor: string
  client: string
  pet: string
  service: string
}

type PushRow = { endpoint: string; p256dh: string; auth: string }

// ─── Адресація: ім'я лікаря → user_id ────────────────────────────────────────

// doctors.name === appointments.doctor; profiles.doctor_id → profiles.id (= auth.uid).
async function userIdForDoctor(doctorName: string): Promise<string | null> {
  const { data: doc } = await admin
    .from("doctors")
    .select("id")
    .eq("name", doctorName)
    .maybeSingle()
  if (!doc?.id) return null

  const { data: prof } = await admin
    .from("profiles")
    .select("id")
    .eq("doctor_id", doc.id)
    .maybeSingle()
  return prof?.id ?? null
}

async function subscriptionsFor(userId: string): Promise<PushRow[]> {
  const { data } = await admin
    .from("push_subscriptions")
    .select("endpoint, p256dh, auth")
    .eq("user_id", userId)
  return (data as PushRow[]) ?? []
}

async function sendTo(rows: PushRow[], note: { title: string; body: string; url: string; tag: string }) {
  if (rows.length === 0) return
  ensureVapid()
  const payload = JSON.stringify(note)
  await Promise.all(
    rows.map(async (row) => {
      try {
        await webpush.sendNotification(
          { endpoint: row.endpoint, keys: { p256dh: row.p256dh, auth: row.auth } },
          payload
        )
      } catch (err) {
        const status = (err as { statusCode?: number }).statusCode
        if (status === 404 || status === 410) {
          await admin.from("push_subscriptions").delete().eq("endpoint", row.endpoint)
        } else {
          console.error("push error", status, (err as Error).message)
        }
      }
    })
  )
}

// ─── Основна логіка ───────────────────────────────────────────────────────────

async function run(): Promise<{ checked: number; sent: number }> {
  const { date, minutes: nowMin } = nowInClinic()

  // Кандидати на сьогодні: нагадування ввімкнене й ще не надіслане.
  const { data, error } = await admin
    .from("appointments")
    .select("id, date, start_time, doctor, client, pet, service")
    .eq("remind", true)
    .is("reminded_at", null)
    .eq("date", date)
  if (error) {
    console.error("query failed", error.message)
    return { checked: 0, sent: 0 }
  }

  const appts = (data as ApptRow[]) ?? []
  let sent = 0

  for (const a of appts) {
    const startMin = toMinutes(a.start_time)
    const diff = startMin - nowMin
    // Вікно: прийом починається через [0; REMIND_LEAD_MIN] хв. Минулі прийоми
    // того ж дня (diff < 0) пропускаємо — щоб не слати запізнілі нагадування.
    if (diff < 0 || diff > REMIND_LEAD_MIN) continue

    // Резервуємо рядок ОДРАЗУ (ставимо reminded_at) перед відправкою, щоб
    // паралельний запуск cron не надіслав дубль. Умова reminded_at IS NULL
    // робить це атомарним: лише один апдейт «виграє».
    const { data: claimed } = await admin
      .from("appointments")
      .update({ reminded_at: new Date().toISOString() })
      .eq("id", a.id)
      .is("reminded_at", null)
      .select("id")
    if (!claimed || claimed.length === 0) continue

    const userId = await userIdForDoctor(a.doctor)
    if (!userId) continue
    const rows = await subscriptionsFor(userId)
    if (rows.length === 0) continue

    await sendTo(rows, {
      title: `Через ${diff <= 0 ? REMIND_LEAD_MIN : diff} хв прийом`,
      body: `${a.start_time.slice(0, 5)} · ${a.client} (${a.pet}) — ${a.service}`,
      url: "/calendar",
      tag: "reminder-" + a.id,
    })
    sent++
  }

  return { checked: appts.length, sent }
}

// ─── Вхід ─────────────────────────────────────────────────────────────────────

Deno.serve(async (req) => {
  // Викликається cron'ом (POST). GET лишаємо для ручної перевірки/health.
  if (req.method !== "POST" && req.method !== "GET") {
    return new Response("Method not allowed", { status: 405 })
  }
  try {
    const result = await run()
    return new Response(JSON.stringify({ ok: true, ...result }), {
      headers: { "Content-Type": "application/json" },
    })
  } catch (err) {
    console.error("send-reminders failed", (err as Error).message)
    return new Response(JSON.stringify({ error: (err as Error).message }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    })
  }
})
