// Supabase Edge Function: Telegram-нагадування КЛІЄНТАМ за ~2 год до прийому.
//
// Тригер — pg_cron, що викликає цю функцію щохвилини (див.
// supabase/add-client-reminders-cron.sql). Аналог send-reminders, але:
//   • адресат — клієнт (не лікар);
//   • канал — Telegram Bot API (не Web Push);
//   • вікно — за ~2 години до прийому (не 5 хв);
//   • маркер дедуплікації — client_reminded_at (не reminded_at).
//
// Час: appointments.date + start_time у локальному часі клініки (Київ).
//      Шлемо ті, що почнуться в межах [REMIND_LEAD_MIN; REMIND_LEAD_MIN+WINDOW]
//      хвилин і ще не нагадані клієнту. Після відправки ставимо
//      client_reminded_at.
//
// Адресація: appointments.phone (нормалізований канон 0XXXXXXXXX) →
//            telegram_clients.phone → chat_id.
//
// Секрети:
//   TELEGRAM_BOT_TOKEN
//   SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY (надаються середовищем).

import { createClient } from "jsr:@supabase/supabase-js@2"

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!
const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
const BOT_TOKEN = Deno.env.get("TELEGRAM_BOT_TOKEN") ?? ""
const API = `https://api.telegram.org/bot${BOT_TOKEN}`

// За скільки хвилин до прийому слати нагадування клієнту (2 години).
const REMIND_LEAD_MIN = 120
// Ширина вікна: cron хвилинний, але беремо запас, щоб не загубити прийом,
// якщо запуск пропустили. Дедуплікація через client_reminded_at не дасть дубль.
const WINDOW_MIN = 5
const CLINIC_TZ = "Europe/Kyiv"

const admin = createClient(SUPABASE_URL, SERVICE_ROLE)

// ─── Час у таймзоні клініки (як у send-reminders) ────────────────────────────

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
  const hour = Number(get("hour")) % 24
  const minutes = hour * 60 + Number(get("minute"))
  return { date, minutes }
}

function toMinutes(time: string): number {
  const [h, m] = time.slice(0, 5).split(":").map(Number)
  return (h || 0) * 60 + (m || 0)
}

// Канон телефону — синхронно з src/lib/phone.ts та telegram-bot.
function normalizePhone(value: string): string {
  const d = (value ?? "").replace(/\D+/g, "")
  if (d.length === 12 && d.startsWith("380")) return "0" + d.slice(3)
  if (d.length === 11 && d.startsWith("80")) return "0" + d.slice(2)
  return d
}

// ─── Типи ─────────────────────────────────────────────────────────────────────

type ApptRow = {
  id: string
  date: string
  start_time: string
  client: string
  phone: string
  pet: string
  service: string
  doctor: string
}

// ─── Telegram ──────────────────────────────────────────────────────────────────

async function sendMessage(chatId: number, text: string): Promise<boolean> {
  const res = await fetch(`${API}/sendMessage`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ chat_id: chatId, text, parse_mode: "HTML" }),
  })
  if (!res.ok) {
    // 403 = користувач заблокував бота → прибираємо прив'язку, щоб не слати знову.
    if (res.status === 403) {
      await admin.from("telegram_clients").delete().eq("chat_id", chatId)
    } else {
      console.error("telegram send failed", res.status, await res.text())
    }
    return false
  }
  return true
}

// ─── Основна логіка ───────────────────────────────────────────────────────────

async function run(): Promise<{ checked: number; sent: number }> {
  const { date, minutes: nowMin } = nowInClinic()

  // Прийоми на сьогодні з увімкненим нагадуванням, клієнту ще не слали.
  // (Вікно 2 год не перетинає північ для робочих годин клініки, тож достатньо
  //  сканувати поточну дату.)
  const { data, error } = await admin
    .from("appointments")
    .select("id, date, start_time, client, phone, pet, service, doctor")
    .eq("remind", true)
    .is("client_reminded_at", null)
    .eq("date", date)
  if (error) {
    console.error("query failed", error.message)
    return { checked: 0, sent: 0 }
  }

  const appts = (data as ApptRow[]) ?? []
  let sent = 0

  for (const a of appts) {
    const diff = toMinutes(a.start_time) - nowMin
    // Вікно: прийом починається через [120; 125] хв.
    if (diff < REMIND_LEAD_MIN || diff > REMIND_LEAD_MIN + WINDOW_MIN) continue

    // Знаходимо chat_id клієнта за нормалізованим телефоном.
    const phone = normalizePhone(a.phone)
    if (phone.length < 10) continue
    const { data: tc } = await admin
      .from("telegram_clients")
      .select("chat_id")
      .eq("phone", phone)
      .maybeSingle()
    if (!tc?.chat_id) continue // клієнт не прив'язав Telegram — пропускаємо

    // Резервуємо рядок ДО відправки (атомарно через client_reminded_at IS NULL),
    // щоб паралельний cron не надіслав дубль.
    const { data: claimed } = await admin
      .from("appointments")
      .update({ client_reminded_at: new Date().toISOString() })
      .eq("id", a.id)
      .is("client_reminded_at", null)
      .select("id")
    if (!claimed || claimed.length === 0) continue

    const time = a.start_time.slice(0, 5)
    const ok = await sendMessage(
      tc.chat_id,
      `🐾 Нагадування про прийом\n\n` +
        `Сьогодні о <b>${time}</b> у вас запис${a.pet ? ` для <b>${a.pet}</b>` : ""}.\n` +
        `Послуга: ${a.service}\n` +
        `Лікар: ${a.doctor}\n\n` +
        `До зустрічі! 💛`
    )
    if (ok) sent++
  }

  return { checked: appts.length, sent }
}

// ─── Вхід ─────────────────────────────────────────────────────────────────────

Deno.serve(async (req) => {
  if (req.method !== "POST" && req.method !== "GET") {
    return new Response("Method not allowed", { status: 405 })
  }
  try {
    const result = await run()
    return new Response(JSON.stringify({ ok: true, ...result }), {
      headers: { "Content-Type": "application/json" },
    })
  } catch (err) {
    console.error("send-client-reminders failed", (err as Error).message)
    return new Response(JSON.stringify({ error: (err as Error).message }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    })
  }
})
