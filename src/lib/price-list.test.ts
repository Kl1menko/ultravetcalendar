import { describe, it, expect } from "vitest"
import { PRICE_LIST } from "./price-list"

// Прайс редагується вручну в коді — ці тести ловлять структурні помилки
// (порожні назви, категорія без позицій, позиція без ціни й без tiers).
describe("PRICE_LIST інваріанти", () => {
  it("має хоча б одну категорію", () => {
    expect(PRICE_LIST.length).toBeGreaterThan(0)
  })

  it("кожна категорія має непорожній заголовок і позиції", () => {
    for (const cat of PRICE_LIST) {
      expect(cat.title.trim()).toBeTruthy()
      expect(cat.items.length).toBeGreaterThan(0)
    }
  })

  it("кожна позиція має назву та ціну (фіксовану або за вагою)", () => {
    for (const cat of PRICE_LIST) {
      for (const item of cat.items) {
        expect(item.name.trim(), `категорія "${cat.title}"`).toBeTruthy()
        const hasPrice = Boolean(item.price?.trim())
        const hasTiers = Boolean(item.tiers && item.tiers.length > 0)
        expect(
          hasPrice || hasTiers,
          `"${item.name}" не має ні price, ні tiers`
        ).toBe(true)
      }
    }
  })

  it("у tiers кожен рівень має label і ціну", () => {
    for (const cat of PRICE_LIST) {
      for (const item of cat.items) {
        for (const tier of item.tiers ?? []) {
          expect(tier.label.trim()).toBeTruthy()
          expect(tier.price.trim()).toBeTruthy()
        }
      }
    }
  })

  it("назви послуг унікальні в межах категорії", () => {
    for (const cat of PRICE_LIST) {
      const names = cat.items.map((i) => i.name)
      expect(new Set(names).size, `дублі в "${cat.title}"`).toBe(names.length)
    }
  })
})
