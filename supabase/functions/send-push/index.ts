// Supabase Edge Function: розсилка Web Push на нову активність.
//
// Тригер — Database Webhook (INSERT) на таблицях notices / feedback /
// feedback_replies. Дивись supabase/PUSH_NOTIFICATIONS.md, як підключити.
//
// Адресація:
//   • notices          → усім підпискам, КРІМ автора оголошення.
//   • feedback (тікет)  → підпискам адмінів (нові баги/ідеї для розгляду).
//   • feedback_replies  → автору батьківського тікета (+ адмінам, якщо відповів
//                         не адмін), КРІМ автора самої відповіді.
//
// Секрети функції (supabase secrets set ...):
//   VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY, VAPID_SUBJECT (mailto:...)
//   SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY (надаються середовищем автоматично).

import { createClient } from "jsr:@supabase/supabase-js@2"
import webpush from "npm:web-push@3.6.7"

// ─── Конфіг ──────────────────────────────────────────────────────────────────

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!
const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!

// web-push вимагає VAPID-ключі як URL-safe Base64 БЕЗ padding "=".
// Якщо в секрет потрапив стандартний Base64 (з "=", "+", "/") або зайві пробіли/
// переноси — нормалізуємо, інакше setVapidDetails кидає "must be a URL safe Base 64".
function normalizeKey(raw: string): string {
  return (raw ?? "")
    .replace(/\s+/g, "")           // прибираємо пробіли/переноси рядка
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "")
}

const admin = createClient(SUPABASE_URL, SERVICE_ROLE)

// Ініціалізацію web-push робимо ЛІНИВО (в хендлері), а не на топ-рівні модуля —
// щоб помилка в ключах поверталась 500-кою з логом, а не валила завантаження
// модуля непрозоро. vapidReady кешує, що ключі провалідовані.
let vapidReady = false

function ensureVapid() {
  if (vapidReady) return
  const pub = normalizeKey(Deno.env.get("VAPID_PUBLIC_KEY") ?? "")
  const priv = normalizeKey(Deno.env.get("VAPID_PRIVATE_KEY") ?? "")
  let subject = (Deno.env.get("VAPID_SUBJECT") ?? "").trim()
  if (!/^(mailto:|https:\/\/)/.test(subject) || subject.includes("...")) {
    subject = "mailto:admin@ultravet.app"
  }
  console.log("VAPID lengths", { pub: pub.length, priv: priv.length, subject })
  webpush.setVapidDetails(subject, pub, priv)
  vapidReady = true
}

// Адмінські user_id визначаємо за email (синхронно з src/lib/doctors.ts).
const ADMIN_EMAILS = new Set([
  "v.klimenko2014@gmail.com",
  "head@clinic.com",
])

// ─── Типи вебхуку ─────────────────────────────────────────────────────────────

type WebhookPayload = {
  type: "INSERT" | "UPDATE" | "DELETE"
  table: string
  record: Record<string, unknown>
}

type PushRow = {
  endpoint: string
  p256dh: string
  auth: string
  user_id: string
}

type Notification = { title: string; body: string; url: string; tag?: string }

// ─── Helpers ──────────────────────────────────────────────────────────────────

async function adminUserIds(): Promise<Set<string>> {
  // service_role може читати auth.users через admin API.
  const ids = new Set<string>()
  const { data, error } = await admin.auth.admin.listUsers()
  if (error || !data) return ids
  for (const u of data.users) {
    if (u.email && ADMIN_EMAILS.has(u.email.toLowerCase())) ids.add(u.id)
  }
  return ids
}

async function subscriptionsFor(filter: {
  exclude?: Set<string>
  only?: Set<string>
}): Promise<PushRow[]> {
  const { data, error } = await admin
    .from("push_subscriptions")
    .select("endpoint, p256dh, auth, user_id")
  if (error || !data) return []

  return (data as PushRow[]).filter((s) => {
    if (filter.only && !filter.only.has(s.user_id)) return false
    if (filter.exclude && filter.exclude.has(s.user_id)) return false
    return true
  })
}

async function sendTo(rows: PushRow[], note: Notification) {
  if (rows.length === 0) return
  ensureVapid()
  const payload = JSON.stringify(note)

  await Promise.all(
    rows.map(async (row) => {
      const subscription = {
        endpoint: row.endpoint,
        keys: { p256dh: row.p256dh, auth: row.auth },
      }
      try {
        await webpush.sendNotification(subscription, payload)
      } catch (err) {
        const status = (err as { statusCode?: number }).statusCode
        // 404/410 — підписка протухла; прибираємо її з БД.
        if (status === 404 || status === 410) {
          await admin.from("push_subscriptions").delete().eq("endpoint", row.endpoint)
        } else {
          console.error("push error", status, (err as Error).message)
        }
      }
    })
  )
}

function truncate(text: string, max = 120): string {
  const t = text.trim()
  return t.length > max ? t.slice(0, max - 1) + "…" : t
}

// ─── Маршрутизація за таблицею ────────────────────────────────────────────────

async function handle(payload: WebhookPayload) {
  const { table, record } = payload

  if (table === "notices") {
    const author = String(record.created_by ?? "")
    const rows = await subscriptionsFor({ exclude: new Set([author]) })
    await sendTo(rows, {
      title: "Нове оголошення",
      body: truncate(String(record.text ?? "")),
      url: "/alerts",
      tag: "notice-" + String(record.id ?? ""),
    })
    return
  }

  if (table === "feedback") {
    const author = String(record.created_by ?? "")
    const admins = await adminUserIds()
    admins.delete(author) // автор-адмін сам собі не шле
    if (admins.size === 0) return
    const rows = await subscriptionsFor({ only: admins })
    const typeLabel = record.type === "improvement" ? "Покращення" : "Баг"
    await sendTo(rows, {
      title: `Новий тікет · ${typeLabel}`,
      body: truncate(String(record.title ?? "")),
      url: "/alerts",
      tag: "feedback-" + String(record.id ?? ""),
    })
    return
  }

  if (table === "feedback_replies") {
    const replyAuthor = String(record.created_by ?? "")
    const feedbackId = String(record.feedback_id ?? "")

    // Автор батьківського тікета.
    const { data: parent } = await admin
      .from("feedback")
      .select("created_by, title")
      .eq("id", feedbackId)
      .single()

    const recipients = new Set<string>()
    if (parent?.created_by) recipients.add(String(parent.created_by))

    // Адміни теж бачать тред — додаємо їх (щоб бачили відповіді один одного/команди).
    const admins = await adminUserIds()
    for (const id of admins) recipients.add(id)

    recipients.delete(replyAuthor) // автор відповіді собі не шле
    if (recipients.size === 0) return

    const rows = await subscriptionsFor({ only: recipients })
    await sendTo(rows, {
      title: "Нова відповідь у тікеті",
      body: truncate(String(record.body ?? "")),
      url: "/alerts",
      tag: "feedback-" + feedbackId,
    })
    return
  }
}

// ─── Вхід ─────────────────────────────────────────────────────────────────────

Deno.serve(async (req) => {
  if (req.method !== "POST") {
    return new Response("Method not allowed", { status: 405 })
  }
  try {
    const payload = (await req.json()) as WebhookPayload
    if (payload.type !== "INSERT") {
      return new Response(JSON.stringify({ skipped: payload.type }), { status: 200 })
    }
    await handle(payload)
    return new Response(JSON.stringify({ ok: true }), {
      headers: { "Content-Type": "application/json" },
    })
  } catch (err) {
    console.error("send-push failed", (err as Error).message)
    return new Response(JSON.stringify({ error: (err as Error).message }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    })
  }
})
