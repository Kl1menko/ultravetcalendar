"use client"

import { useEffect, useState } from "react"

// Виявляє нову версію service worker'а (нову збірку застосунку), що вже
// встановлена, але чекає активації (installed → waiting, бо sw.js не
// викликає skipWaiting() сам — див. public/sw.js). Повертає функцію applyUpdate,
// яка форсує активацію нового SW і перезавантажує сторінку.
export function useServiceWorkerUpdate() {
  const [waitingWorker, setWaitingWorker] = useState<ServiceWorker | null>(null)

  useEffect(() => {
    if (typeof window === "undefined" || !("serviceWorker" in navigator)) return

    let reg: ServiceWorkerRegistration | null = null

    const onUpdateFound = () => {
      const installing = reg?.installing
      if (!installing) return
      installing.addEventListener("statechange", () => {
        if (installing.state === "installed" && navigator.serviceWorker.controller) {
          setWaitingWorker(installing)
        }
      })
    }

    navigator.serviceWorker.getRegistration().then((existing) => {
      if (!existing) return
      reg = existing
      // Нова версія вже встигла встановитись і чекає, поки ми відкрили сторінку.
      if (existing.waiting && navigator.serviceWorker.controller) {
        setWaitingWorker(existing.waiting)
      }
      existing.addEventListener("updatefound", onUpdateFound)
    })

    // Браузер сам перевіряє sw.js на новий байт-контент нечасто (раз на добу
    // або при навігації). PWA-вкладка може лишатись відкритою довше — тож
    // додатково перевіряємо вручну, коли користувач повертається у застосунок.
    const onVisibilityChange = () => {
      if (document.visibilityState === "visible") reg?.update()
    }
    document.addEventListener("visibilitychange", onVisibilityChange)

    // Перезавантажуємось один раз, щойно новий SW реально перехопив контроль
    // (спрацьовує після applyUpdate → skipWaiting() у sw.js).
    let reloaded = false
    const onControllerChange = () => {
      if (reloaded) return
      reloaded = true
      window.location.reload()
    }
    navigator.serviceWorker.addEventListener("controllerchange", onControllerChange)

    return () => {
      reg?.removeEventListener("updatefound", onUpdateFound)
      navigator.serviceWorker.removeEventListener("controllerchange", onControllerChange)
      document.removeEventListener("visibilitychange", onVisibilityChange)
    }
  }, [])

  const applyUpdate = () => {
    waitingWorker?.postMessage("SKIP_WAITING")
  }

  return { updateAvailable: waitingWorker !== null, applyUpdate }
}
