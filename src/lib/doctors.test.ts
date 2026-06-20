import { describe, it, expect } from "vitest"
import {
  DOCTORS,
  doctorColor,
  doctorShortName,
  canSeePrices,
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

describe("права доступу за роллю", () => {
  it("canSeePrices — лише admin та head", () => {
    expect(canSeePrices("admin")).toBe(true)
    expect(canSeePrices("head")).toBe(true)
    expect(canSeePrices("doctor")).toBe(false)
    expect(canSeePrices("assistant")).toBe(false)
  })

  it("canSeeClients — усі, крім асистентів", () => {
    expect(canSeeClients("admin")).toBe(true)
    expect(canSeeClients("head")).toBe(true)
    expect(canSeeClients("doctor")).toBe(true)
    expect(canSeeClients("assistant")).toBe(false)
  })

  it("адмінські права — лише admin", () => {
    for (const fn of [canSeeAdmin, canManageUsers, canSeeDebug]) {
      expect(fn("admin")).toBe(true)
      expect(fn("head")).toBe(false)
      expect(fn("doctor")).toBe(false)
      expect(fn("assistant")).toBe(false)
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
