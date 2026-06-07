"use client"

import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet"
import { DOCTORS, doctorShortName } from "@/lib/doctors"

type Props = {
  open: boolean
  onClose: () => void
  selected: string
  onSelect: (doctor: string) => void
}

export default function DoctorFilterSheet({ open, onClose, selected, onSelect }: Props) {
  const options = ["Всі лікарі", ...DOCTORS]

  return (
    <Sheet open={open} onOpenChange={(v) => !v && onClose()}>
      <SheetContent side="bottom" className="px-3.5 pb-safe rounded-t-[18px]">
        <SheetHeader className="mb-3">
          <SheetTitle>Фільтр по лікарю</SheetTitle>
        </SheetHeader>
        <div className="grid gap-1.5 pb-4">
          {options.map((doc) => (
            <button
              key={doc}
              type="button"
              onClick={() => { onSelect(doc); onClose() }}
              className={[
                "min-h-12 px-3.5 rounded-xl border-[1.5px] text-sm font-semibold text-left transition-colors",
                doc === selected
                  ? "bg-[var(--teal-light)] border-[var(--teal-mid)] text-[var(--teal-dark)]"
                  : "bg-white border-[var(--line)] text-[var(--ink)] hover:bg-[var(--paper)]",
              ].join(" ")}
            >
              {doctorShortName(doc)}
            </button>
          ))}
        </div>
      </SheetContent>
    </Sheet>
  )
}
