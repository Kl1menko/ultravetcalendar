"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { supabase } from "@/lib/supabase"

export default function LoginPage() {
  const router = useRouter()
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [error, setError] = useState("")
  const [loading, setLoading] = useState(false)
  const [checking, setChecking] = useState(true)

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
      <div className="flex min-h-dvh items-center justify-center bg-[var(--teal-light)]">
        <div
          className="w-14 h-14 rounded-[16px] bg-[var(--teal)] text-white grid place-items-center text-lg font-black animate-pulse-logo"
          aria-label="Завантаження"
        >
          UV
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-dvh bg-[var(--teal-light)] flex items-center justify-center p-4">
      <div className="w-full max-w-[360px] bg-white rounded-[20px] shadow-2xl shadow-black/10 p-8">
        {/* Logo */}
        <div className="w-14 h-14 mx-auto rounded-[16px] bg-[var(--teal)] text-white text-lg font-black grid place-items-center mb-4 animate-pulse-logo">
          UV
        </div>
        <h1 className="text-[22px] font-black text-center text-[var(--ink)] mb-1">
          UltraVet
        </h1>
        <p className="text-[13px] text-[var(--muted-col)] text-center mb-7">
          Ветеринарна клініка
        </p>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <label className="flex flex-col gap-1.5">
            <span className="text-[11px] font-bold uppercase tracking-[0.5px] text-[var(--muted-col)]">
              Email
            </span>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="doctor@clinic.com"
              autoComplete="email"
              required
              className="h-12 rounded-xl border border-[var(--line)] px-4 text-[15px] text-[var(--ink)] outline-none focus:border-[var(--teal)] focus:ring-2 focus:ring-[var(--teal)]/10 transition"
            />
          </label>

          <label className="flex flex-col gap-1.5">
            <span className="text-[11px] font-bold uppercase tracking-[0.5px] text-[var(--muted-col)]">
              Пароль
            </span>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              autoComplete="current-password"
              required
              className="h-12 rounded-xl border border-[var(--line)] px-4 text-[15px] text-[var(--ink)] outline-none focus:border-[var(--teal)] focus:ring-2 focus:ring-[var(--teal)]/10 transition"
            />
          </label>

          {error && (
            <div className="rounded-xl bg-red-50 border border-red-200 text-red-600 text-[13px] font-semibold px-4 py-3">
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full h-12 rounded-xl bg-[var(--teal)] text-white font-bold text-[15px] mt-2 hover:bg-[var(--teal-dark)] transition active:scale-[0.98] disabled:opacity-60"
          >
            {loading ? "Входжу…" : "Увійти"}
          </button>
        </form>
      </div>
    </div>
  )
}
