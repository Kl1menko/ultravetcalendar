"use client"

import { motion } from "motion/react"
import { Appointment } from "@/types"
import { doctorColor } from "@/lib/doctors"
import { statusStyle } from "@/lib/status"
import { staggerItem } from "@/lib/motion"

// Картка запису для списку та мобільного тижня — єдиний вигляд.
export function ApptCard({
  appt,
  showPrice,
  onClick,
}: {
  appt: Appointment
  showPrice: boolean
  onClick: () => void
}) {
  const color = doctorColor(appt.doctor)
  const st = statusStyle(appt.status)
  const price = showPrice && appt.price ? Number(appt.price) : 0
  return (
    <motion.button
      variants={staggerItem}
      type="button"
      onClick={onClick}
      className="glass glass-hover flex w-full items-stretch gap-3 rounded-2xl p-3 text-left transition active:scale-[0.99]"
    >
      <span className="w-1 shrink-0 rounded-full" style={{ background: color.border }} />
      <span className="flex min-w-0 flex-1 flex-col gap-0.5">
        <span className="flex items-center gap-2">
          <span className="text-[13px] font-black text-[var(--ink)]">
            {appt.start}–{appt.end}
          </span>
          <span
            className="rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-[0.3px]"
            style={{ background: st.bg, color: st.text }}
          >
            {appt.status}
          </span>
        </span>
        <span className="truncate text-[14px] font-bold text-[var(--ink)]">
          {appt.pet}{appt.service ? ` · ${appt.service}` : ""}
        </span>
        <span className="truncate text-[12px] text-[var(--muted-col)]">
          {appt.client}
        </span>
      </span>
      {price > 0 && (
        <span className="ml-auto self-center text-[13px] font-black" style={{ color: color.border }}>
          {price.toLocaleString("uk-UA")} ₴
        </span>
      )}
    </motion.button>
  )
}
