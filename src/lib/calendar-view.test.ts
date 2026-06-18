import { describe, it, expect } from "vitest"
import { fcTime, weekDays, appointmentsToEvents } from "./calendar-view"
import { Appointment } from "@/types"

function appt(over: Partial<Appointment>): Appointment {
  return {
    id: "x", date: "2026-06-15", start: "10:00", end: "10:30",
    client: "Клієнт", phone: "0123456789", pet: "Барсик", animal: "Кіт",
    age: "", weight: "", address: "", service: "Огляд",
    doctor: "Остап (головний лікар)", comment: "", price: 0, status: "Заплановано",
    ...over,
  }
}

describe("fcTime", () => {
  it("форматує локальний час події у HH:MM", () => {
    const d = new Date(2026, 5, 15, 9, 5)
    expect(fcTime(d)).toBe("09:05")
  })
})

describe("weekDays", () => {
  it("повертає 7 днів тижня, починаючи з неділі", () => {
    // 2026-06-15 — понеділок; тиждень має починатися з неділі 14-го.
    const days = weekDays(new Date(2026, 5, 15))
    expect(days).toHaveLength(7)
    expect(days[0].getDay()).toBe(0) // неділя
    expect(days[6].getDay()).toBe(6) // субота
  })
})

describe("appointmentsToEvents", () => {
  it("фільтрує за лікарем, «Всі лікарі» лишає всіх", () => {
    const list = [
      appt({ id: "1", doctor: "Остап (головний лікар)" }),
      appt({ id: "2", doctor: "Юрій (лікар)" }),
    ]
    expect(appointmentsToEvents(list, "Всі лікарі")).toHaveLength(2)
    const onlyYurii = appointmentsToEvents(list, "Юрій (лікар)")
    expect(onlyYurii).toHaveLength(1)
    expect(onlyYurii[0].id).toBe("2")
  })

  it("будує ISO start/end та прокидає запис у extendedProps", () => {
    const [ev] = appointmentsToEvents([appt({ date: "2026-06-15", start: "10:00", end: "10:30" })], "Всі лікарі")
    expect(ev.start).toBe("2026-06-15T10:00")
    expect(ev.end).toBe("2026-06-15T10:30")
    expect(ev.extendedProps.appointment.pet).toBe("Барсик")
  })
})
