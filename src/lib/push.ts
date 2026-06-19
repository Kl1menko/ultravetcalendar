// Web Push (PWA-сповіщення) — клієнтська частина.
//
// Потік:
//   1. registerServiceWorker() — реєструє /sw.js (він обробляє push-події).
//   2. subscribeToPush() — просить дозвіл, підписується через VAPID-ключ,
//      зберігає subscription у public.push_subscriptions.
//   3. unsubscribeFromPush() — відписує пристрій і прибирає рядок з БД.
//
// Розсилку робить окрема Supabase Edge Function (service_role) — див.
// supabase/functions/ (наступний крок). Тут лише підписка.
//
// Обмеження платформ:
//   • iOS/iPadOS — лише для PWA, доданої на головний екран, iOS 16.4+.
//   • Потрібен HTTPS (або localhost).

import { supabase } from "./supabase"
import { logAppError } from "./error-log"

const VAPID_PUBLIC_KEY = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY ?? ""

/** Чи підтримує середовище Web Push узагалі. */
export function isPushSupported(): boolean {
  return (
    typeof window !== "undefined" &&
    "serviceWorker" in navigator &&
    "PushManager" in window &&
    "Notification" in window
  )
}

/** Поточний стан дозволу ('default' | 'granted' | 'denied'). */
export function pushPermission(): NotificationPermission | "unsupported" {
  if (!isPushSupported()) return "unsupported"
  return Notification.permission
}

/** Реєструє service worker (ідемпотентно). Викликати при старті застосунку. */
export async function registerServiceWorker(): Promise<ServiceWorkerRegistration | null> {
  if (!isPushSupported()) return null
  try {
    return await navigator.serviceWorker.register("/sw.js")
  } catch (err) {
    logAppError("registerServiceWorker", err)
    return null
  }
}

/** Чи цей пристрій уже має активну push-підписку. */
export async function isSubscribed(): Promise<boolean> {
  if (!isPushSupported()) return false
  const reg = await navigator.serviceWorker.ready
  const sub = await reg.pushManager.getSubscription()
  return sub !== null
}

/**
 * Просить дозвіл і підписує пристрій. Зберігає subscription у БД.
 * Повертає { ok, reason } — reason для UI ('denied' | 'unsupported' | 'no-vapid' | 'error').
 */
export async function subscribeToPush(
  authorName: string
): Promise<{ ok: boolean; reason?: string }> {
  if (!isPushSupported()) return { ok: false, reason: "unsupported" }
  if (!VAPID_PUBLIC_KEY) return { ok: false, reason: "no-vapid" }

  const permission = await Notification.requestPermission()
  if (permission !== "granted") return { ok: false, reason: "denied" }

  try {
    const reg = await navigator.serviceWorker.ready
    const sub = await reg.pushManager.subscribe({
      userVisibleOnly: true,
      // .buffer — ArrayBuffer; задовольняє тип BufferSource в усіх версіях lib.dom.
      applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY).buffer,
    })

    const json = sub.toJSON()
    const keys = json.keys ?? {}
    const { error } = await supabase
      .from("push_subscriptions")
      .upsert(
        {
          endpoint: sub.endpoint,
          p256dh: keys.p256dh ?? "",
          auth: keys.auth ?? "",
          author_name: authorName || null,
        },
        { onConflict: "endpoint" }
      )

    if (error) {
      logAppError("subscribeToPush.save", error)
      return { ok: false, reason: "error" }
    }
    return { ok: true }
  } catch (err) {
    logAppError("subscribeToPush", err)
    return { ok: false, reason: "error" }
  }
}

/** Відписує пристрій і прибирає рядок з БД. */
export async function unsubscribeFromPush(): Promise<boolean> {
  if (!isPushSupported()) return false
  try {
    const reg = await navigator.serviceWorker.ready
    const sub = await reg.pushManager.getSubscription()
    if (!sub) return true

    await supabase.from("push_subscriptions").delete().eq("endpoint", sub.endpoint)
    await sub.unsubscribe()
    return true
  } catch (err) {
    logAppError("unsubscribeFromPush", err)
    return false
  }
}

// VAPID-ключ приходить як base64url-рядок; Push API хоче Uint8Array.
function urlBase64ToUint8Array(base64String: string): Uint8Array<ArrayBuffer> {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4)
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/")
  const raw = atob(base64)
  const buffer = new ArrayBuffer(raw.length)
  const output = new Uint8Array(buffer)
  for (let i = 0; i < raw.length; i++) output[i] = raw.charCodeAt(i)
  return output
}
