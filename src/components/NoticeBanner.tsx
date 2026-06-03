"use client";

import { useEffect, useRef, useState } from "react";
import { Notice } from "@/types";

type Props = {
  notice: Notice | null;
  onDismiss: () => void;
};

let unlockedAudioContext: AudioContext | null = null;

function getAudioContext() {
  unlockedAudioContext ??= new AudioContext();
  return unlockedAudioContext;
}

async function unlockAudio() {
  try {
    const ctx = getAudioContext();

    if (ctx.state === "suspended") {
      await ctx.resume();
    }
  } catch {
    // Safari may still block audio until a real user gesture.
  }
}

function playNoticeSound() {
  try {
    const ctx = getAudioContext();

    if (ctx.state === "suspended") {
      void ctx.resume();
    }

    const playTone = (
      freq: number,
      startTime: number,
      duration: number,
      vol: number,
    ) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      const compressor = ctx.createDynamicsCompressor();

      osc.type = "sine";
      osc.connect(gain);
      gain.connect(compressor);
      compressor.connect(ctx.destination);
      osc.frequency.setValueAtTime(freq, startTime);

      gain.gain.setValueAtTime(0, startTime);
      gain.gain.linearRampToValueAtTime(vol, startTime + 0.015);
      gain.gain.setValueAtTime(vol, startTime + duration - 0.06);
      gain.gain.exponentialRampToValueAtTime(0.001, startTime + duration);

      osc.start(startTime);
      osc.stop(startTime + duration);
    };

    const t = ctx.currentTime + 0.05;
    playTone(659.25, t, 0.18, 0.28);
    playTone(830.61, t + 0.2, 0.18, 0.28);
    playTone(987.77, t + 0.4, 0.22, 0.28);
  } catch {
    // AudioContext недоступний — ігноруємо
  }
}

export default function NoticeBanner({ notice, onDismiss }: Props) {
  const [visible, setVisible] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const handler = () => void unlockAudio();

    window.addEventListener("click", handler, { once: true });
    window.addEventListener("touchstart", handler, { once: true });
    window.addEventListener("pointerdown", handler, { once: true });

    return () => {
      window.removeEventListener("click", handler);
      window.removeEventListener("touchstart", handler);
      window.removeEventListener("pointerdown", handler);
    };
  }, []);

  useEffect(() => {
    let showTimer: ReturnType<typeof setTimeout> | null = null;

    if (!notice) {
      showTimer = setTimeout(() => setVisible(false), 0);
      return () => {
        if (showTimer) clearTimeout(showTimer);
      };
    }

    showTimer = setTimeout(() => {
      setVisible(true);
      playNoticeSound();
    }, 0);

    // Автозакрити через 6 секунд
    timerRef.current = setTimeout(() => {
      setVisible(false);
      setTimeout(onDismiss, 350);
    }, 6000);

    return () => {
      if (showTimer) clearTimeout(showTimer);
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [notice, onDismiss]);

  const dismiss = () => {
    if (timerRef.current) clearTimeout(timerRef.current);
    setVisible(false);
    setTimeout(onDismiss, 350);
  };

  if (!notice) return null;

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
            className="h-full bg-[var(--teal-mid)] origin-left"
            style={{
              animation: visible
                ? "notice-progress 6s linear forwards"
                : "none",
            }}
          />
        </div>

        <div className="flex items-start gap-3 px-4 py-3">
          {/* Icon */}
          <div className="w-9 h-9 rounded-xl bg-[var(--teal)] flex items-center justify-center flex-shrink-0">
            <svg
              viewBox="0 0 24 24"
              className="w-5 h-5"
              fill="none"
              stroke="currentColor"
              strokeWidth={2}
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M18 8a6 6 0 1 0-12 0c0 7-3 9-3 9h18s-3-2-3-9" />
              <path d="M13.73 21a2 2 0 0 1-3.46 0" />
            </svg>
          </div>

          {/* Текст */}
          <div className="min-w-0 flex-1">
            <div className="text-[11px] font-bold text-[var(--teal-mid)] uppercase tracking-[0.5px] mb-0.5">
              UltraVet
            </div>
            <p className="text-[14px] leading-snug font-medium text-white/95">
              {notice.text}
            </p>
          </div>

          <button
            type="button"
            onClick={dismiss}
            className="w-7 h-7 rounded-lg hover:bg-white/10 flex items-center justify-center flex-shrink-0 transition-colors"
            aria-label="Закрити"
          >
            <svg
              viewBox="0 0 24 24"
              className="w-4 h-4"
              fill="none"
              stroke="currentColor"
              strokeWidth={2}
              strokeLinecap="round"
            >
              <path d="M18 6 6 18M6 6l12 12" />
            </svg>
          </button>
        </div>
      </div>

      <style jsx>{`
        @keyframes notice-progress {
          from {
            transform: scaleX(1);
          }
          to {
            transform: scaleX(0);
          }
        }
      `}</style>
    </div>
  );
}
