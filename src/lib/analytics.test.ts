import { describe, it, expect } from "vitest"
import {
  pctChange,
  byService,
  byDoctor,
  shortDoctor,
  buildDoctorStats,
  rabiesCounts,
  formatMoney,
  peakHours,
  peakWeekdays,
  revenueTrend,
  periodRange,
  filterByPeriod,
  filterByPreviousPeriod,
  isNavigablePeriod,
  shiftAnchor,
  isCurrentOrFuturePeriod,
  anchorLabel,
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
    created_by: null,
    remind: false,
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

describe("rabiesCounts — «Сказ» усіма лікарями за тиждень/місяць", () => {
  // Anchor — середа 2026-06-17; тиждень = Пн 15 .. Нд 21, місяць = червень.
  const anchor = new Date("2026-06-17T12:00:00")

  it("рахує «Сказ» у межах тижня й місяця, незалежно від лікаря", () => {
    const res = rabiesCounts(
      [
        appt({ date: "2026-06-16", service: "Сказ", doctor: "Остап" }), // у тижні
        appt({ date: "2026-06-18", service: "Огляд, Сказ", doctor: "Юрій" }), // у тижні, мультипослуга
        appt({ date: "2026-06-03", service: "Сказ", doctor: "Аня" }), // лише в місяці
        appt({ date: "2026-05-30", service: "Сказ" }), // поза місяцем
      ],
      anchor
    )
    expect(res.week).toBe(2)
    expect(res.month).toBe(3)
  })

  it("ігнорує інші послуги", () => {
    const res = rabiesCounts([appt({ date: "2026-06-16", service: "Огляд" })], anchor)
    expect(res.week).toBe(0)
    expect(res.month).toBe(0)
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

describe("anchor-aware periods (вибір конкретного місяця/року)", () => {
  it("periodRange для місяця прив'язується до anchor, а не до сьогодні", () => {
    const anchor = new Date(2025, 4, 15) // травень 2025
    const range = periodRange("month", anchor)!
    expect(range.start.getFullYear()).toBe(2025)
    expect(range.start.getMonth()).toBe(4)
    expect(range.start.getDate()).toBe(1)
    expect(range.end.getMonth()).toBe(4)
    expect(range.end.getDate()).toBe(31) // травень — 31 день
  })

  it("periodRange для року охоплює весь рік anchor", () => {
    const range = periodRange("year", new Date(2024, 6, 9))!
    expect(range.start.getFullYear()).toBe(2024)
    expect(range.start.getMonth()).toBe(0)
    expect(range.start.getDate()).toBe(1)
    expect(range.end.getMonth()).toBe(11)
    expect(range.end.getDate()).toBe(31)
  })

  it("filterByPeriod з anchor вибирає лише записи обраного місяця", () => {
    const data = [
      appt({ id: "a", date: "2025-05-10" }),
      appt({ id: "b", date: "2025-05-28" }),
      appt({ id: "c", date: "2025-06-01" }),
      appt({ id: "d", date: "2026-06-15" }),
    ]
    const res = filterByPeriod(data, "month", new Date(2025, 4, 15))
    expect(res.map((a) => a.id).sort()).toEqual(["a", "b"])
  })

  it("filterByPreviousPeriod з anchor бере попередній місяць відносно anchor", () => {
    const data = [
      appt({ id: "prev", date: "2025-04-12" }),
      appt({ id: "cur", date: "2025-05-12" }),
    ]
    const res = filterByPreviousPeriod(data, "month", new Date(2025, 4, 15))!
    expect(res.map((a) => a.id)).toEqual(["prev"])
  })

  it("isNavigablePeriod — лише month і year", () => {
    expect(isNavigablePeriod("month")).toBe(true)
    expect(isNavigablePeriod("year")).toBe(true)
    expect(isNavigablePeriod("week")).toBe(false)
    expect(isNavigablePeriod("day")).toBe(false)
    expect(isNavigablePeriod("all")).toBe(false)
  })

  it("shiftAnchor зсуває місяць/рік і нормалізує на 1-ше число", () => {
    const back = shiftAnchor(new Date(2025, 4, 31), "month", -1)
    expect(back.getMonth()).toBe(3) // квітень, без переповнення в травень
    expect(back.getDate()).toBe(1)
    const fwdYear = shiftAnchor(new Date(2024, 6, 9), "year", 1)
    expect(fwdYear.getFullYear()).toBe(2025)
    expect(fwdYear.getMonth()).toBe(0)
  })

  it("isCurrentOrFuturePeriod блокує листання вперед, минуле — дозволяє", () => {
    const now = new Date()
    expect(isCurrentOrFuturePeriod(now, "month")).toBe(true)
    expect(isCurrentOrFuturePeriod(new Date(2000, 0, 1), "month")).toBe(false)
    expect(isCurrentOrFuturePeriod(new Date(now.getFullYear() + 1, 0, 1), "year")).toBe(true)
  })

  it("anchorLabel дає людську мітку місяця і року", () => {
    expect(anchorLabel(new Date(2025, 4, 1), "month")).toBe("Травень 2025")
    expect(anchorLabel(new Date(2024, 0, 1), "year")).toBe("2024")
  })
})
