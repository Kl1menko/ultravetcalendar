"use client"

import { useEffect, useState } from "react"
import { Bell, BellOff, BellRing } from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  isPushSupported,
  pushPermission,
  isSubscribed,
  subscribeToPush,
  unsubscribeFromPush,
} from "@/lib/push"

const REASON_TEXT: Record<string, string> = {
  denied: "Сповіщення заблоковано в налаштуваннях браузера. Дозвольте їх для цього сайту й спробуйте знову.",
  unsupported: "Цей пристрій або браузер не підтримує сповіщення.",
  "no-vapid": "Сервер сповіщень ще не налаштовано (немає VAPID-ключа).",
  error: "Не вдалося ввімкнути сповіщення. Спробуйте пізніше.",
}

export default function NotificationsCard({ authorName }: { authorName: string }) {
  // Лінива ініціалізація з клієнтських API (компонент "use client",
  // ініціалізатор виконується лише в браузері) — без зайвого setState в ефекті.
  const [supported] = useState<boolean | null>(() => isPushSupported())
  const [permission, setPermission] = useState<NotificationPermission | "unsupported">(
    () => pushPermission()
  )
  const [subscribed, setSubscribed] = useState(false)
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState("")

  useEffect(() => {
    if (!supported) return
    isSubscribed().then(setSubscribed)
  }, [supported])

  // iOS показує Web Push лише для PWA на головному екрані — підказуємо це.
  const isStandalone =
    typeof window !== "undefined" &&
    (window.matchMedia?.("(display-mode: standalone)").matches ||
      (window.navigator as Navigator & { standalone?: boolean }).standalone === true)

  const handleEnable = async () => {
    setBusy(true)
    setMessage("")
    const res = await subscribeToPush(authorName)
    setBusy(false)
    if (res.ok) {
      setSubscribed(true)
      setPermission("granted")
      setMessage("Сповіщення увімкнено для цього пристрою.")
    } else {
      setMessage(REASON_TEXT[res.reason ?? "error"] ?? REASON_TEXT.error)
    }
  }

  const handleDisable = async () => {
    setBusy(true)
    setMessage("")
    const ok = await unsubscribeFromPush()
    setBusy(false)
    if (ok) {
      setSubscribed(false)
      setMessage("Сповіщення вимкнено для цього пристрою.")
    } else {
      setMessage(REASON_TEXT.error)
    }
  }

  if (supported === null) return null

  return (
    <section className="glass rounded-xl p-4 md:rounded-[24px] md:p-6">
      <div className="flex items-center gap-2.5">
        <div className="grid size-9 place-items-center rounded-lg bg-[var(--paper)] text-[var(--ink-2)]">
          {subscribed ? <BellRing className="size-[18px]" /> : <Bell className="size-[18px]" />}
        </div>
        <div>
          <h2 className="text-[17px] font-bold text-[var(--ink)]">Сповіщення</h2>
          <p className="text-[13px] text-[var(--muted-col)]">
            {subscribed ? "Увімкнено на цьому пристрої" : "Push на цей пристрій"}
          </p>
        </div>
      </div>

      {!supported ? (
        <p className="mt-4 rounded-lg bg-[var(--paper)] px-3 py-2.5 text-[13px] text-[var(--muted-col)]">
          Цей браузер не підтримує push-сповіщення.
        </p>
      ) : (
        <>
          {!isStandalone && (
            <p className="mt-3 rounded-lg bg-[var(--teal-light)] px-3 py-2 text-[12px] leading-relaxed text-[var(--teal-dark)]">
              На iPhone сповіщення працюють лише якщо застосунок додано на головний
              екран (Поділитися → «На початковий екран»).
            </p>
          )}

          <div className="mt-4">
            {subscribed ? (
              <Button variant="outline" className="w-full" disabled={busy} onClick={handleDisable}>
                <BellOff />
                {busy ? "Вимкнення…" : "Вимкнути сповіщення"}
              </Button>
            ) : (
              <Button
                className="w-full"
                disabled={busy || permission === "denied"}
                onClick={handleEnable}
              >
                <Bell />
                {busy ? "Вмикання…" : "Увімкнути сповіщення"}
              </Button>
            )}
          </div>

          {message && (
            <p className="mt-3 text-[13px] text-[var(--muted-col)]">{message}</p>
          )}
        </>
      )}
    </section>
  )
}
