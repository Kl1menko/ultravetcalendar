import { describe, it, expect } from "vitest"
import { STATUSES, statusStyle, normalizeStatus } from "./status"

describe("normalizeStatus", () => {
  it("повертає валідні укр. статуси без змін", () => {
    for (const s of STATUSES) {
      expect(normalizeStatus(s)).toBe(s)
    }
  })

  it("обрізає пробіли навколо валідного значення", () => {
    expect(normalizeStatus("  Очікує  ")).toBe("Очікує")
  })

  it("зводить англомовні легасі-статуси до укр. enum", () => {
    expect(normalizeStatus("scheduled")).toBe("Заплановано")
    expect(normalizeStatus("planned")).toBe("Заплановано")
    expect(normalizeStatus("waiting")).toBe("Очікує")
    expect(normalizeStatus("pending")).toBe("Очікує")
    expect(normalizeStatus("completed")).toBe("Завершено")
    expect(normalizeStatus("done")).toBe("Завершено")
    expect(normalizeStatus("finished")).toBe("Завершено")
    expect(normalizeStatus("cancelled")).toBe("Скасовано")
    expect(normalizeStatus("canceled")).toBe("Скасовано")
  })

  it("не залежить від регістру", () => {
    expect(normalizeStatus("SCHEDULED")).toBe("Заплановано")
    expect(normalizeStatus("Completed")).toBe("Завершено")
  })

  it("зводить «В кабінеті» та його варіанти до «Очікує»", () => {
    expect(normalizeStatus("in_progress")).toBe("Очікує")
    expect(normalizeStatus("in-progress")).toBe("Очікує")
    expect(normalizeStatus("in progress")).toBe("Очікує")
    expect(normalizeStatus("in_office")).toBe("Очікує")
    expect(normalizeStatus("В кабінеті")).toBe("Очікує")
  })

  it("повертає null для порожніх та невідомих значень", () => {
    expect(normalizeStatus(null)).toBeNull()
    expect(normalizeStatus(undefined)).toBeNull()
    expect(normalizeStatus("")).toBeNull()
    expect(normalizeStatus("хтозна-що")).toBeNull()
  })
})

describe("statusStyle", () => {
  it("повертає стиль для кожного валідного статусу", () => {
    for (const s of STATUSES) {
      const style = statusStyle(s)
      expect(style.bg).toBeTruthy()
      expect(style.text).toBeTruthy()
    }
  })

  it("падає назад на стиль «Заплановано» для невідомого статусу", () => {
    // @ts-expect-error — навмисно невалідне значення для перевірки фолбеку
    expect(statusStyle("xxx")).toEqual(statusStyle("Заплановано"))
  })
})
