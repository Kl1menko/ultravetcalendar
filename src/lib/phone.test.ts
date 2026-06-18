import { describe, it, expect } from "vitest"
import { digitsOnly, normalizePhone, phoneMatches, hasDigits } from "./phone"

describe("digitsOnly", () => {
  it("лишає тільки цифри", () => {
    expect(digitsOnly("+380 (12) 345-67-89")).toBe("380123456789")
    expect(digitsOnly("abc")).toBe("")
  })
})

describe("normalizePhone", () => {
  it("зводить різні формати укр. номера до 0XXXXXXXXX", () => {
    const canonical = "0123456789"
    expect(normalizePhone("0123456789")).toBe(canonical)
    expect(normalizePhone("0 (12) 345 67 89")).toBe(canonical)
    expect(normalizePhone("+380 12 345 67 89")).toBe(canonical)
    expect(normalizePhone("380123456789")).toBe(canonical)
    expect(normalizePhone("80123456789")).toBe(canonical)
  })

  it("частковий ввід лишає як самі цифри", () => {
    expect(normalizePhone("345 67")).toBe("34567")
  })
})

describe("phoneMatches", () => {
  const stored = "+380 12 345 67 89"

  it("збігається з повним номером у будь-якому форматі", () => {
    expect(phoneMatches(stored, "0123456789")).toBe(true)
    expect(phoneMatches(stored, "380123456789")).toBe(true)
  })

  it("збігається з фрагментом номера", () => {
    expect(phoneMatches(stored, "6789")).toBe(true)
  })

  it("не збігається з чужими цифрами", () => {
    expect(phoneMatches(stored, "9999")).toBe(false)
  })

  it("порожній запит не матчить", () => {
    expect(phoneMatches(stored, "")).toBe(false)
    expect(phoneMatches(stored, "абв")).toBe(false)
  })
})

describe("hasDigits", () => {
  it("true коли є хоч одна цифра", () => {
    expect(hasDigits("Іван 7")).toBe(true)
    expect(hasDigits("Іван")).toBe(false)
  })
})
