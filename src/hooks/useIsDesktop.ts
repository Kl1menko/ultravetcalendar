import { useEffect, useState } from "react"

// ≥md — десктоп: там показуємо повну сітку FullCalendar. На мобільному
// тиждень/місяць рендеримо власними компактними виглядами (mobile-first).
export function useIsDesktop(): boolean {
  const [isDesktop, setIsDesktop] = useState(false)
  useEffect(() => {
    const mq = window.matchMedia("(min-width: 768px)")
    const update = () => setIsDesktop(mq.matches)
    update()
    mq.addEventListener("change", update)
    return () => mq.removeEventListener("change", update)
  }, [])
  return isDesktop
}
