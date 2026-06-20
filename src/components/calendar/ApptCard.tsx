"use client"

import { motion } from "motion/react"
import { Appointment } from "@/types"
import { statusStyle } from "@/lib/status"
import { staggerItem } from "@/lib/motion"
import { doctorColor, doctorShortName } from "@/lib/doctors"
import { durationLabel, minutesFromTime } from "@/lib/utils-app"

// Картка запису для списку та мобільного тижня — єдиний легкий вигляд:
// біла поверхня, м'яка тінь, кольорова смужка лікаря ліворуч.
export function ApptCard({
  appt,
  onClick,
}: {
  appt: Appointment
  onClick: () => void
}) {
  const st = statusStyle(appt.status)
  const price = appt.price ? Number(appt.price) : 0
  const durMins = minutesFromTime(appt.end) - minutesFromTime(appt.start)
  const accent = doctorColor(appt.doctor).border
  return (
    <motion.button
      variants={staggerItem}
      type="button"
      onClick={onClick}
      className="appt-card appt-card-light glass-hover relative flex w-full flex-col rounded-[16px] py-3 pl-4 pr-3 text-left transition active:scale-[0.99]"
    >
      <span
        className="absolute inset-y-2 left-2 w-[3px] rounded-full"
        style={{ background: accent }}
      />
      <span className="truncate text-[15px] font-extrabold leading-tight text-[var(--ink)]">
        {appt.pet}
      </span>
      <span className="mt-0.5 line-clamp-2 text-[13px] leading-snug text-[var(--ink-2)]">
        {appt.service || "Прийом"} · {appt.client}
      </span>

      <span className="mt-2.5 flex flex-wrap items-center gap-1.5">
        <span className="appt-chip appt-chip-neutral">
          {appt.start}–{appt.end}
        </span>
        <span className="appt-chip" style={{ background: st.bg, color: st.text }}>
          {appt.status}
        </span>
        <span className="appt-chip appt-chip-neutral">
          {doctorShortName(appt.doctor)}
        </span>
        <span className="appt-chip appt-chip-time">{durationLabel(durMins)}</span>
        {price > 0 && (
          <span className="appt-chip appt-chip-price">
            {price.toLocaleString("uk-UA")} ₴
          </span>
        )}
      </span>
    </motion.button>
  )
}
