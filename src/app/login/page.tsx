"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import Image from "next/image"
import { supabase } from "@/lib/supabase"

export default function LoginPage() {
  const router = useRouter()
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [error, setError] = useState("")
  const [loading, setLoading] = useState(false)
  const [checking, setChecking] = useState(true)
  const [showPassword, setShowPassword] = useState(false)

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) router.replace("/calendar")
      else setChecking(false)
    })
  }, [router])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError("")
    setLoading(true)

    const { error: authError } = await supabase.auth.signInWithPassword({
      email: email.trim(),
      password,
    })

    if (authError) {
      setError("Невірний email або пароль.")
      setLoading(false)
      return
    }

    router.replace("/calendar")
  }

  if (checking) {
    return (
      <div className="flex min-h-dvh items-center justify-center bg-white">
        <div
          className="grid h-14 w-14 place-items-center rounded-[16px] bg-white shadow-lg shadow-black/10 ring-1 ring-[var(--line)] animate-pulse-logo"
          aria-label="Завантаження"
        >
          <Image src="/logo.svg" alt="UltraVet" width={40} height={40} unoptimized />
        </div>
      </div>
    )
  }

  return (
    <div className="relative flex min-h-dvh items-center justify-center overflow-hidden bg-white p-4">
      <div className="w-full max-w-[380px]">
        {/* Лого + назва над формою */}
        <div className="mb-6 flex flex-col items-center">
          <div className="grid h-16 w-16 place-items-center">
            <Image src="/logo.svg" alt="UltraVet" width={48} height={48} unoptimized />
          </div>
          <h1 className="mt-4 text-[26px] font-black tracking-tight text-[var(--ink)]">
            UltraVet
          </h1>
          <p className="mt-0.5 text-[13px] font-medium text-[var(--muted-col)]">
            Ветеринарна клініка
          </p>
        </div>

        {/* Форма */}
        <div className="p-1">
          <div className="mb-6 text-center">
            <h2 className="text-[18px] font-black text-[var(--ink)]">Вхід в систему</h2>
            <p className="mt-0.5 text-[13px] text-[var(--muted-col)]">
              Увійдіть, щоб продовжити роботу
            </p>
          </div>

          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            <label className="flex flex-col gap-1.5">
              <span className="text-[11px] font-bold uppercase tracking-[0.5px] text-[var(--muted-col)]">
                Email
              </span>
              <div className="relative">
                <span className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-[var(--muted-col)]">
                  <svg viewBox="0 0 24 24" className="h-[18px] w-[18px]" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
                    <rect x="2" y="4" width="20" height="16" rx="2" />
                    <path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7" />
                  </svg>
                </span>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="doctor@clinic.com"
                  autoComplete="email"
                  required
                  className="h-12 w-full rounded-xl border border-[var(--line)] bg-white pl-11 pr-4 text-[15px] text-[var(--ink)] outline-none transition focus:border-[var(--teal)] focus:ring-2 focus:ring-[var(--teal)]/15"
                />
              </div>
            </label>

            <label className="flex flex-col gap-1.5">
              <span className="text-[11px] font-bold uppercase tracking-[0.5px] text-[var(--muted-col)]">
                Пароль
              </span>
              <div className="relative">
                <span className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-[var(--muted-col)]">
                  <svg viewBox="0 0 24 24" className="h-[18px] w-[18px]" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
                    <rect x="3" y="11" width="18" height="11" rx="2" />
                    <path d="M7 11V7a5 5 0 0 1 10 0v4" />
                  </svg>
                </span>
                <input
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Введіть пароль"
                  autoComplete="current-password"
                  required
                  className="h-12 w-full rounded-xl border border-[var(--line)] bg-white pl-11 pr-11 text-[15px] text-[var(--ink)] outline-none transition focus:border-[var(--teal)] focus:ring-2 focus:ring-[var(--teal)]/15"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((v) => !v)}
                  aria-label={showPassword ? "Сховати пароль" : "Показати пароль"}
                  className="absolute right-2 top-1/2 grid h-8 w-8 -translate-y-1/2 place-items-center rounded-lg text-[var(--muted-col)] transition-colors hover:bg-[var(--paper)] hover:text-[var(--ink-2)]"
                >
                  {showPassword ? (
                    <svg viewBox="0 0 24 24" className="h-[18px] w-[18px]" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
                      <path d="M9.88 9.88a3 3 0 1 0 4.24 4.24" />
                      <path d="M10.73 5.08A10.43 10.43 0 0 1 12 5c7 0 10 7 10 7a13.16 13.16 0 0 1-1.67 2.68" />
                      <path d="M6.61 6.61A13.526 13.526 0 0 0 2 12s3 7 10 7a9.74 9.74 0 0 0 5.39-1.61" />
                      <line x1="2" y1="2" x2="22" y2="22" />
                    </svg>
                  ) : (
                    <svg viewBox="0 0 24 24" className="h-[18px] w-[18px]" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
                      <path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z" />
                      <circle cx="12" cy="12" r="3" />
                    </svg>
                  )}
                </button>
              </div>
            </label>

            {error && (
              <div className="flex items-center gap-2 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-[13px] font-semibold text-red-600">
                <svg viewBox="0 0 24 24" className="h-4 w-4 shrink-0" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="12" cy="12" r="10" />
                  <line x1="12" y1="8" x2="12" y2="12" />
                  <line x1="12" y1="16" x2="12.01" y2="16" />
                </svg>
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="mt-2 flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-[var(--ink)] text-[15px] font-bold text-white shadow-lg shadow-black/15 transition-all hover:bg-black hover:shadow-black/20 active:scale-[0.98] disabled:opacity-60"
            >
              {loading && (
                <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/40 border-t-white" />
              )}
              {loading ? "Входжу…" : "Увійти"}
            </button>
          </form>
        </div>

        <p className="mt-5 text-center text-[12px] text-[var(--muted-col)]">
          Доступ лише для персоналу клініки
        </p>
      </div>
    </div>
  )
}
