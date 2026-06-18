"use client"

import Image from "next/image"

type Props = {
  label?: string
  sublabel?: string
}

export default function SplashScreen({
  label = "Завантаження",
  sublabel = "Готуємо робочий простір",
}: Props) {
  return (
    <div className="app-shell relative flex items-center justify-center overflow-hidden px-6">
      <div className="relative flex w-full max-w-[280px] flex-col items-center text-center">
        <div className="grid h-24 w-24 place-items-center">
          <Image
            src="/logo.svg"
            alt="UltraVet"
            width={58}
            height={61}
            style={{ width: "auto", height: "auto" }}
            priority
            unoptimized
          />
        </div>

        <h1 className="mt-6 text-[26px] font-semibold tracking-tight text-[var(--ink)]">
          UltraVet
        </h1>
        <p className="mt-1 text-[13px] font-medium text-[var(--muted-col)]">
          {label}
        </p>

        <div className="mt-7 h-1.5 w-full overflow-hidden rounded-full border border-[var(--line)] bg-white">
          <span className="block h-full w-1/2 rounded-full bg-[var(--teal)] animate-splash-progress" />
        </div>

        <p className="mt-4 text-[11px] font-medium text-[var(--muted-col)]">
          {sublabel}
        </p>
      </div>
    </div>
  )
}
