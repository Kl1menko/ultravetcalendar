"use client"

import { useEffect, useRef, useState } from "react"
import { Notice } from "@/types"

type Props = {
  notice: Notice | null
  onDismiss: () => void
}

export default function NoticeBanner({ notice, onDismiss }: Props) {
  const [visible, setVisible] = useState(false)
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    if (!notice) {
      setVisible(false)
      return
    }

    setVisible(true)

    // iOS "tri-tone" notification sound через Web Audio API
    try {
      const ctx = new AudioContext()

      const playTone = (freq: number, startTime: number, duration: number, vol: number) => {
        const osc = ctx.createOscillator()
        const gain = ctx.createGain()
        const compressor = ctx.createDynamicsCompressor()

        osc.type = "sine"
        osc.connect(gain)
        gain.connect(compressor)
        compressor.connect(ctx.destination)

        osc.frequency.setValueAtTime(freq, startTime)

        // Attack
        gain.gain.setValueAtTime(0, startTime)
        gain.gain.linearRampToValueAtTime(vol, startTime + 0.015)
        // Sustain
        gain.gain.setValueAtTime(vol, startTime + duration - 0.06)
        // Release
        gain.gain.exponentialRampToValueAtTime(0.001, startTime + duration)

        osc.start(startTime)
        osc.stop(startTime + duration)
      }

      const t = ctx.currentTime + 0.05

      // iOS tri-tone: три тони E5 → G#5 → B5 (мі-соль#-сі)
      playTone(659.25, t,        0.18, 0.28)  // E5
      playTone(830.61, t + 0.20, 0.18, 0.28)  // G#5
      playTone(987.77, t + 0.40, 0.22, 0.28)  // B5
    } catch {
      // AudioContext недоступний — ігноруємо
    }

    // Автозакрити через 6 секунд
    timerRef.current = setTimeout(() => {
      setVisible(false)
      setTimeout(onDismiss, 350)
    }, 6000)

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current)
    }
  }, [notice, onDismiss])

  const dismiss = () => {
    if (timerRef.current) clearTimeout(timerRef.current)
    setVisible(false)
    setTimeout(onDismiss, 350)
  }

  if (!notice) return null

  return (
    <div
      className={`fixed top-0 left-0 right-0 z-50 flex justify-center px-3 transition-all duration-350 ease-out ${
        visible ? "translate-y-0 opacity-100" : "-translate-y-full opacity-0"
      }`}
      style={{ paddingTop: "max(env(safe-area-inset-top), 12px)" }}
    >
      <div
        className="w-full max-w-sm bg-[var(--ink)] text-white rounded-2xl shadow-2xl shadow-black/30 overflow-hidden"
        style={{ marginTop: 4 }}
      >
        {/* Прогрес-бар */}
        <div className="h-0.5 bg-white/20 overflow-hidden">
          <div
            className="h-full bg-[var(--teal)] origin-left"
            style={{
              animation: visible ? "notice-progress 6s linear forwards" : "none",
            }}
          />
        </div>

        <div className="flex items-start gap-3 px-4 py-3.5">
          {/* Іконка */}
          <div className="w-8 h-8 rounded-xl bg-[var(--teal)] flex items-center justify-center shrink-0 mt-0.5">
            <svg viewBox="0 0 24 24" className="w-4 h-4 text-white" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
              <path d="M18 8a6 6 0 1 0-12 0c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/>
            </svg>
          </div>

          {/* Текст */}
          <div className="flex-1 min-w-0">
            <p className="text-[12px] font-bold text-white/60 uppercase tracking-[0.4px] mb-0.5">
              UltraVet · Сповіщення
            </p>
            <p className="text-[14px] font-medium text-white leading-snug line-clamp-3">
              {notice.text}
            </p>
          </div>

          {/* Закрити */}
          <button
            type="button"
            onClick={dismiss}
            className="w-6 h-6 rounded-full bg-white/10 flex items-center justify-center shrink-0 mt-0.5 hover:bg-white/20 transition-colors"
            aria-label="Закрити"
          >
            <svg viewBox="0 0 24 24" className="w-3 h-3" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round">
              <path d="M18 6 6 18M6 6l12 12"/>
            </svg>
          </button>
        </div>
      </div>
    </div>
  )
}
