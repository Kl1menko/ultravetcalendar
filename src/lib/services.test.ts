import { describe, it, expect } from "vitest"
import {
  isOperationType,
  parseServices,
  joinServices,
  OPERATION_TYPES,
} from "./services"

describe("isOperationType", () => {
  it("впізнає види операцій", () => {
    for (const op of OPERATION_TYPES) {
      expect(isOperationType(op)).toBe(true)
    }
  })
  it("звичайна послуга не є операцією", () => {
    expect(isOperationType("Огляд")).toBe(false)
  })
})

describe("parseServices", () => {
  it("розбиває кому-роздільний рядок і обрізає пробіли", () => {
    expect(parseServices("Огляд, УЗД ,Рентген")).toEqual(["Огляд", "УЗД", "Рентген"])
  })
  it("прибирає порожні елементи", () => {
    expect(parseServices("Огляд,,")).toEqual(["Огляд"])
    expect(parseServices("")).toEqual([])
  })
  it("мапить легасі-аліаси на актуальні назви", () => {
    expect(parseServices("Аналізи (загальний)")).toEqual(["ЗАК"])
    expect(parseServices("Аналізи (біохімічний)")).toEqual(["БАК"])
    expect(parseServices("Стерилізація")).toEqual(["ОГЕ"])
    expect(parseServices("Зуби")).toEqual(["УЗ-зубів"])
  })
})

describe("joinServices / parseServices round-trip", () => {
  it("зберігає й читає той самий набір послуг", () => {
    const list = ["Огляд", "УЗД", "Рентген"]
    expect(parseServices(joinServices(list))).toEqual(list)
  })
})
