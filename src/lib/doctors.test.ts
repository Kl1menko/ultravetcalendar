import { describe, it, expect } from "vitest"
import {
  DOCTORS,
  doctorColor,
  doctorShortName,
  accountForEmail,
  roleForEmail,
  doctorForEmail,
  canSeePrices,
  canSeeAppointmentPrices,
  canSeeClients,
  canSeeAdmin,
  canManageUsers,
  canSeeDebug,
  roleLabel,
} from "./doctors"

describe("doctorShortName", () => {
  it("прибирає роль у дужках", () => {
    expect(doctorShortName("Остап (головний лікар)")).toBe("Остап")
    expect(doctorShortName("Устим (асистент)")).toBe("Устим")
  })
  it("лишає ім'я без дужок як є", () => {
    expect(doctorShortName("Остап")).toBe("Остап")
  })
})

describe("doctorColor", () => {
  it("дає унікальний колір за позицією лікаря", () => {
    expect(doctorColor(DOCTORS[0])).not.toEqual(doctorColor(DOCTORS[1]))
  })
  it("падає на перший колір для невідомого лікаря", () => {
    expect(doctorColor("Хтось")).toEqual(doctorColor(DOCTORS[0]))
  })
})

describe("accountForEmail / роль за email", () => {
  it("не залежить від регістру й пробілів", () => {
    expect(roleForEmail("  HEAD@CLINIC.COM ")).toBe("head")
  })
  it("невідомий email → assistant (найменші права)", () => {
    expect(roleForEmail("stranger@x.com")).toBe("assistant")
    expect(roleForEmail(null)).toBe("assistant")
    expect(accountForEmail(undefined)).toBeNull()
  })
  it("прив'язує лікаря до запису", () => {
    expect(doctorForEmail("yurii@clinic.com")).toBe("Юрій (лікар)")
    expect(doctorForEmail("unknown@x.com")).toBeNull()
  })
})

describe("права доступу за роллю", () => {
  const admin = "v.klimenko2014@gmail.com"
  const head = "head@clinic.com"
  const doctor = "yurii@clinic.com"
  const assistant = "ania@clinic.com"

  it("canSeePrices — лише admin та head", () => {
    expect(canSeePrices(admin)).toBe(true)
    expect(canSeePrices(head)).toBe(true)
    expect(canSeePrices(doctor)).toBe(false)
    expect(canSeePrices(assistant)).toBe(false)
  })

  it("canSeeAppointmentPrices — усі з ростера, включно з асистентами", () => {
    // Асистенти вписують ціну (canEditPrice) і мають бачити її назад —
    // інакше сума обнуляється на читанні й виглядає так, ніби «не зберігається».
    expect(canSeeAppointmentPrices(admin)).toBe(true)
    expect(canSeeAppointmentPrices(head)).toBe(true)
    expect(canSeeAppointmentPrices(doctor)).toBe(true)
    expect(canSeeAppointmentPrices(assistant)).toBe(true)
    expect(canSeeAppointmentPrices("stranger@example.com")).toBe(false)
    expect(canSeeAppointmentPrices(null)).toBe(false)
  })

  it("canSeeClients — усі, крім асистентів", () => {
    expect(canSeeClients(doctor)).toBe(true)
    expect(canSeeClients(assistant)).toBe(false)
  })

  it("адмінські права — лише admin", () => {
    for (const fn of [canSeeAdmin, canManageUsers, canSeeDebug]) {
      expect(fn(admin)).toBe(true)
      expect(fn(head)).toBe(false)
      expect(fn(doctor)).toBe(false)
      expect(fn(assistant)).toBe(false)
    }
  })
})

describe("roleLabel", () => {
  it("дає укр. підпис для кожної ролі", () => {
    expect(roleLabel("admin")).toBe("Адмін системи")
    expect(roleLabel("head")).toBe("Головний лікар")
    expect(roleLabel("doctor")).toBe("Лікар")
    expect(roleLabel("assistant")).toBe("Асистент")
  })
})
