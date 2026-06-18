"use client"

import { motion } from "motion/react"
import { Appointment } from "@/types"
import { staggerContainer } from "@/lib/motion"
import { isoDate, minutesFromTime } from "@/lib/utils-app"
import { ApptCard } from "./ApptCard"
import { DayEmpty } from "./DayEmpty"

// Легка вертикальна стрічка записів обраного дня.
export function ListView({
  appointments,
  selectedDate,
  filtered,
  showPrice,
  onEventClick,
}: {
  appointments: Appointment[]
  selectedDate: Date
  filtered: (a: Appointment) => boolean
  showPrice: boolean
  onEventClick: (appt: Appointment) => void
}) {
  const dayAppts = appointments
    .filter((a) => a.date === isoDate(selectedDate) && filtered(a))
    .sort((a, b) => minutesFromTime(a.start) - minutesFromTime(b.start))

  if (dayAppts.length === 0) return <DayEmpty />

  return (
    <motion.div
      variants={staggerContainer}
      initial="hidden"
      animate="visible"
      className="flex h-full flex-col gap-2 overflow-y-auto px-1 py-2 md:px-2"
    >
      {dayAppts.map((appt) => (
        <ApptCard key={appt.id} appt={appt} showPrice={showPrice} onClick={() => onEventClick(appt)} />
      ))}
    </motion.div>
  )
}
