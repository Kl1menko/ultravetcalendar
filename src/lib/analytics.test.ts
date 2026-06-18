import { describe, it, expect } from "vitest"
import {
  pctChange,
  byService,
  byDoctor,
  shortDoctor,
  buildDoctorStats,
  formatMoney,
  peakHours,
  peakWeekdays,
  revenueTrend,
} from "./analytics"
import { Appointment } from "@/types"

// Мінімальний валідний запис; перевизначай лише потрібні поля в тестах.
function appt(over: Partial<Appointment>): Appointment {
  return {
    id: "x",
    date: "2026-06-15",
    start: "10:00",
    end: "10:30",
    client: "Клієнт",
    phone: "0123456789",
    pet: "Барсик",
    animal: "Кіт",
    age: "",
    weight: "",
    address: "",
    service: "Огляд",
    doctor: "Остап (головний лікар)",
    comment: "",
    price: 0,
    status: "Заплановано",
    ...over,
  }
}

describe("pctChange", () => {
  it("рахує відсоткову зміну", () => {
    expect(pctChange(150, 100)).toBe(50)
    expect(pctChange(50, 100)).toBe(-50)
    expect(pctChange(100, 100)).toBe(0)
  })
  it("база 0: 0→0 = 0, інакше null (нема з чим порівняти)", () => {
    expect(pctChange(0, 0)).toBe(0)
    expect(pctChange(10, 0)).toBeNull()
  })
})

describe("formatMoney", () => {
  it("округлює і додає символ гривні", () => {
    expect(formatMoney(1234.7)).toContain("₴")
    expect(formatMoney(1234.7)).toContain("1")
  })
})

describe("shortDoctor", () => {
  it("бере перше слово до пробілу/дужки", () => {
    expect(shortDoctor("Остап (головний лікар)")).toBe("Остап")
    expect(shortDoctor("Юрій")).toBe("Юрій")
  })
})

describe("byService — розподіл виручки між кількома послугами", () => {
  it("ділить ціну порівну, сума по послугах = виручці запису", () => {
    const res = byService([appt({ service: "Огляд, УЗД", price: 1000 })])
    const oglyad = res.find((r) => r.name === "Огляд")!
    const uzd = res.find((r) => r.name === "УЗД")!
    expect(oglyad.count).toBe(1)
    expect(oglyad.revenue + uzd.revenue).toBe(1000)
  })
  it("сортує за кількістю спадання", () => {
    const res = byService([
      appt({ service: "Огляд" }),
      appt({ service: "Огляд" }),
      appt({ service: "УЗД" }),
    ])
    expect(res[0].name).toBe("Огляд")
    expect(res[0].count).toBe(2)
  })
})

describe("byDoctor", () => {
  it("агрегує записи й виручку по лікарю", () => {
    const res = byDoctor([
      appt({ doctor: "Остап", price: 500 }),
      appt({ doctor: "Остап", price: 300 }),
      appt({ doctor: "Юрій", price: 0 }),
    ])
    const ostap = res.find((r) => r.name === "Остап")!
    expect(ostap.count).toBe(2)
    expect(ostap.revenue).toBe(800)
  })
})

describe("buildDoctorStats", () => {
  it("середній чек рахується лише по платних записах", () => {
    const stats = buildDoctorStats([
      appt({ doctor: "Остап", price: 1000 }),
      appt({ doctor: "Остап", price: 0 }), // безкоштовний — не входить у середній чек
    ])
    const ostap = stats.find((s) => s.name === "Остап")!
    expect(ostap.count).toBe(2)
    expect(ostap.avgCheck).toBe(1000)
  })
})

describe("peakHours / peakWeekdays", () => {
  it("peakHours рахує записи у годинному розрізі 8–19", () => {
    const res = peakHours([appt({ start: "10:15" }), appt({ start: "10:45" })])
    expect(res.find((h) => h.hour === 10)!.count).toBe(2)
  })
  it("peakWeekdays має 7 днів", () => {
    expect(peakWeekdays([]).length).toBe(7)
  })
})

describe("revenueTrend", () => {
  it("для тижня групує по днях і сумує виручку", () => {
    const res = revenueTrend(
      [
        appt({ date: "2026-06-15", price: 500 }),
        appt({ date: "2026-06-15", price: 300 }),
        appt({ date: "2026-06-16", price: 200 }),
      ],
      "week"
    )
    expect(res).toHaveLength(2)
    expect(res[0].revenue).toBe(800)
    expect(res[1].revenue).toBe(200)
  })
})
