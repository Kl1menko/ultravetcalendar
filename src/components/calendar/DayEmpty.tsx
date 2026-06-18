export function DayEmpty({ text = "Записів немає" }: { text?: string }) {
  return (
    <div className="flex h-full flex-col items-center justify-center gap-2 py-10 text-center text-[var(--muted-col)]">
      <svg viewBox="0 0 24 24" className="h-10 w-10 opacity-40" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <rect x="3" y="4" width="18" height="18" rx="2" /><path d="M16 2v4M8 2v4M3 10h18" />
      </svg>
      <span className="text-[14px] font-semibold">{text}</span>
      <span className="text-[12px]">Тапніть «+», щоб додати запис</span>
    </div>
  )
}
