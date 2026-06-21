// Supabase Edge Function: webhook Telegram-бота для прив'язки клієнтів.
//
// Потік прив'язки (клієнт шле боту телефон):
//   1. /start          → бот вітає й показує кнопку «📱 Поділитися номером»
//                        (KeyboardButton з request_contact).
//   2. contact         → беремо phone_number, нормалізуємо до канону
//                        (0XXXXXXXXX) і зберігаємо (phone → chat_id) у
//                        public.telegram_clients. Підтверджуємо клієнту.
//   3. /stop           → прибираємо прив'язку (клієнт відписався).
//
// Telegram викликає цю функцію як webhook (POST з update). Налаштування
// webhook — див. supabase/functions/telegram-bot/SETUP.md.
//
// Секрети:
//   TELEGRAM_BOT_TOKEN        — токен бота від @BotFather.
//   TELEGRAM_WEBHOOK_SECRET   — (опц.) секрет із setWebhook?secret_token=…;
//                               Telegram шле його в заголовку
//                               X-Telegram-Bot-Api-Secret-Token. Якщо заданий —
//                               відкидаємо запити без збігу.
//   SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY (надаються середовищем).

import { createClient } from "jsr:@supabase/supabase-js@2"

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!
const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
const BOT_TOKEN = Deno.env.get("TELEGRAM_BOT_TOKEN") ?? ""
const WEBHOOK_SECRET = Deno.env.get("TELEGRAM_WEBHOOK_SECRET") ?? ""

const admin = createClient(SUPABASE_URL, SERVICE_ROLE)
const API = `https://api.telegram.org/bot${BOT_TOKEN}`

// ─── Нормалізація телефону (синхронно з src/lib/phone.ts) ─────────────────────
//
// Telegram дає номер як +380XXXXXXXXX (іноді без «+»). Зводимо до канону
// 0XXXXXXXXX, щоб точно матчити appointments.phone, який зберігає той самий
// канон через normalizePhone на фронті.
function normalizePhone(value: string): string {
  const d = (value ?? "").replace(/\D+/g, "")
  if (d.length === 12 && d.startsWith("380")) return "0" + d.slice(3)
  if (d.length === 11 && d.startsWith("80")) return "0" + d.slice(2)
  return d
}

// ─── Telegram API helpers ─────────────────────────────────────────────────────

async function sendMessage(
  chatId: number,
  text: string,
  replyMarkup?: unknown
): Promise<void> {
  await fetch(`${API}/sendMessage`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      chat_id: chatId,
      text,
      parse_mode: "HTML",
      reply_markup: replyMarkup,
    }),
  })
}

// Клавіатура з єдиною кнопкою запиту контакту.
const CONTACT_KEYBOARD = {
  keyboard: [[{ text: "📱 Поділитися номером", request_contact: true }]],
  resize_keyboard: true,
  one_time_keyboard: true,
}

const REMOVE_KEYBOARD = { remove_keyboard: true }

// ─── Типи update (тільки потрібні поля) ──────────────────────────────────────

type TgContact = { phone_number: string; first_name?: string; user_id?: number }
type TgChat = { id: number }
type TgUser = { first_name?: string }
type TgMessage = {
  chat: TgChat
  from?: TgUser
  text?: string
  contact?: TgContact
}
type TgUpdate = { message?: TgMessage }

// ─── Обробники ────────────────────────────────────────────────────────────────

async function handleStart(msg: TgMessage): Promise<void> {
  const name = msg.from?.first_name ?? "вітаємо"
  await sendMessage(
    msg.chat.id,
    `Привіт, ${name}! 👋\n\nЦе бот ветеринарної клініки. Щоб отримувати ` +
      `нагадування про прийоми, поділіться, будь ласка, своїм номером — ` +
      `натисніть кнопку нижче.`,
    CONTACT_KEYBOARD
  )
}

async function handleContact(msg: TgMessage): Promise<void> {
  const contact = msg.contact!
  const chatId = msg.chat.id

  // Захист: приймаємо лише ВЛАСНИЙ контакт користувача, а не переслану візитку.
  // (user_id у контакті має збігатись із відправником — тобто з chat.id у
  //  приватному чаті.)
  if (contact.user_id && contact.user_id !== chatId) {
    await sendMessage(
      chatId,
      "Будь ласка, поділіться <b>власним</b> номером через кнопку нижче 🙏",
      CONTACT_KEYBOARD
    )
    return
  }

  const phone = normalizePhone(contact.phone_number)
  if (phone.length < 10) {
    await sendMessage(
      chatId,
      "Не вдалося розпізнати номер. Спробуйте ще раз через кнопку нижче.",
      CONTACT_KEYBOARD
    )
    return
  }

  const name = contact.first_name ?? msg.from?.first_name ?? null
  const { error } = await admin.from("telegram_clients").upsert(
    {
      phone,
      chat_id: chatId,
      name,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "phone" }
  )

  if (error) {
    console.error("upsert telegram_client failed", error.message)
    await sendMessage(
      chatId,
      "Сталася помилка при збереженні 😔 Спробуйте, будь ласка, пізніше."
    )
    return
  }

  await sendMessage(
    chatId,
    "Готово! ✅ Тепер ви отримуватимете нагадування про прийоми за 2 години " +
      "до візиту.\n\nЩоб відписатися — надішліть /stop.",
    REMOVE_KEYBOARD
  )
}

async function handleStop(msg: TgMessage): Promise<void> {
  await admin.from("telegram_clients").delete().eq("chat_id", msg.chat.id)
  await sendMessage(
    msg.chat.id,
    "Ви відписалися від нагадувань. Щоб увімкнути знову — надішліть /start.",
    REMOVE_KEYBOARD
  )
}

async function handleUpdate(update: TgUpdate): Promise<void> {
  const msg = update.message
  if (!msg) return

  if (msg.contact) {
    await handleContact(msg)
    return
  }

  const text = (msg.text ?? "").trim()
  if (text.startsWith("/start")) {
    await handleStart(msg)
  } else if (text.startsWith("/stop")) {
    await handleStop(msg)
  } else {
    await sendMessage(
      msg.chat.id,
      "Щоб отримувати нагадування про прийоми, надішліть /start і поділіться номером."
    )
  }
}

// ─── Вхід ─────────────────────────────────────────────────────────────────────

Deno.serve(async (req) => {
  if (req.method !== "POST") {
    return new Response("ok", { status: 200 })
  }

  // Перевірка секрету webhook (якщо налаштований).
  if (WEBHOOK_SECRET) {
    const got = req.headers.get("X-Telegram-Bot-Api-Secret-Token")
    if (got !== WEBHOOK_SECRET) {
      return new Response("forbidden", { status: 403 })
    }
  }

  try {
    const update = (await req.json()) as TgUpdate
    await handleUpdate(update)
  } catch (err) {
    // Telegram повторить update при не-2xx; логуємо, але відповідаємо 200,
    // щоб не зациклити ретраї на «отруйних» апдейтах.
    console.error("telegram-bot update failed", (err as Error).message)
  }

  return new Response(JSON.stringify({ ok: true }), {
    headers: { "Content-Type": "application/json" },
  })
})
