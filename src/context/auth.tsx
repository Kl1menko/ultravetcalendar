"use client"

import { createContext, useContext, useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { User } from "@supabase/supabase-js"
import { supabase } from "@/lib/supabase"
import {
  canSeeClients as canSeeClientsFn,
  canSeePrices as canSeePricesFn,
  type DoctorRole,
  type DoctorName,
} from "@/lib/doctors"
import SplashScreen from "@/components/SplashScreen"

// ЄДИНЕ джерело сесії та ролі. Раніше підписок на auth було три (інлайн у
// layout, useAuth.ts, profile) — тепер усе тут.
export type AuthContextType = {
  user: User
  role: DoctorRole
  currentDoctor: DoctorName | null
  canSeePrices: boolean
  canSeeClients: boolean
}

const AuthContext = createContext<AuthContextType | null>(null)

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error("useAuth must be used within AuthProvider")
  return ctx
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const router = useRouter()
  const [user, setUser] = useState<User | null>(null)
  const [authLoading, setAuthLoading] = useState(true)

  // Роль та прив'язаний лікар — з БД (profiles), резолвиться через RPC
  // current_user_profile() після логіну. Доки не завантажено — null.
  const [role, setRole] = useState<DoctorRole | null>(null)
  const [currentDoctor, setCurrentDoctor] = useState<DoctorName | null>(null)

  // Сесія + редірект на /login за її відсутності.
  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!session) {
        router.replace("/login")
      } else {
        setUser(session.user)
        setAuthLoading(false)
      }
    })

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!session) {
        router.replace("/login")
      } else {
        setUser(session.user)
        setAuthLoading(false)
      }
    })

    return () => subscription.unsubscribe()
  }, [router])

  // Резолв ролі та прив'язаного лікаря з БД (profiles). Якщо профілю немає
  // (не засіяний) — найвужчі права (assistant, currentDoctor=null).
  useEffect(() => {
    if (!user) return
    let cancelled = false
    supabase
      .rpc("current_user_profile")
      .then(({ data, error }) => {
        if (cancelled) return
        const row = (data as { role: DoctorRole; doctor_name: string | null }[] | null)?.[0]
        if (error || !row) {
          setRole("assistant")
          setCurrentDoctor(null)
          return
        }
        setRole(row.role)
        // doctors.name збігається з елементами DOCTORS — звужуємо тип на межі.
        setCurrentDoctor((row.doctor_name as DoctorName | null) ?? null)
      })
    return () => { cancelled = true }
  }, [user])

  // Чекаємо і на сесію, і на роль із БД — інакше діти рендеряться з тимчасовими
  // правами (assistant) і блимають, коли роль приходить.
  if (authLoading || !user || role === null) {
    return (
      <SplashScreen label="Перевіряємо сесію" sublabel="Завантажуємо календар клініки" />
    )
  }

  return (
    <AuthContext.Provider
      value={{
        user,
        role,
        currentDoctor,
        canSeePrices: canSeePricesFn(role),
        canSeeClients: canSeeClientsFn(role),
      }}
    >
      {children}
    </AuthContext.Provider>
  )
}
