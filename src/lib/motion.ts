// Спільні варіанти Motion — єдине джерело правди для анімацій у застосунку.
// Імпорт: `import { staggerContainer, staggerItem } from "@/lib/motion"`.
//
// Філософія: короткі, м'які переходи (≤0.3s), spring для появи/«поп»-ефектів.
// Тримай тривалості/easing тут, а не розкидані по компонентах.

import type { Variants, Transition } from "motion/react"

// Базовий easing — м'який ease-out, як у решти transition-* у Tailwind-класах.
export const EASE_OUT: Transition["ease"] = [0.22, 0.61, 0.36, 1]

// Поява знизу з фейдом — для одиночних елементів (помилки форми, банери).
export const fadeInUp: Variants = {
  hidden: { opacity: 0, y: 8 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.22, ease: EASE_OUT } },
  exit: { opacity: 0, y: -6, transition: { duration: 0.15, ease: EASE_OUT } },
}

// Контейнер зі stagger — обгортка над списком елементів staggerItem.
export const staggerContainer: Variants = {
  hidden: {},
  visible: {
    transition: { staggerChildren: 0.04, delayChildren: 0.02 },
  },
}

// Елемент усередині staggerContainer — поява знизу з фейдом.
export const staggerItem: Variants = {
  hidden: { opacity: 0, y: 10 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.24, ease: EASE_OUT } },
}

// «Поп»-ефект для pill/бейджів при зміні (статус запису, лічильники).
export const springPop: Variants = {
  hidden: { opacity: 0, scale: 0.85 },
  visible: {
    opacity: 1,
    scale: 1,
    transition: { type: "spring", stiffness: 500, damping: 28 },
  },
}
