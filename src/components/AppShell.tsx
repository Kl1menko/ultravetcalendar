"use client"

import { usePathname, useRouter } from "next/navigation"
import Link from "next/link"
import { User } from "@supabase/supabase-js"
import { supabase } from "@/lib/supabase"
import { HEAD_DOCTOR_EMAIL } from "@/lib/constants"

type Props = {
  user: User
  children: React.ReactNode
  alertsBadge?: number
  onNewAppointment: () => void
  onSearch: () => void
}

const CalendarIcon = () => (
  <svg viewBox="0 0 24 24" className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
    <path d="M8 2v4M16 2v4M4 9h16M5 5h14a1 1 0 0 1 1 1v14a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1Z"/>
  </svg>
)
const ClientsIcon = () => (
  <svg viewBox="0 0 24 24" className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
    <path d="M16 21v-2a4 4 0 0 0-4-4H7a4 4 0 0 0-4 4v2M9.5 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8ZM22 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75"/>
  </svg>
)
const AlertsIcon = () => (
  <svg viewBox="0 0 24 24" className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
    <path d="M18 8a6 6 0 1 0-12 0c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/>
  </svg>
)
const AnalyticsIcon = () => (
  <svg viewBox="0 0 24 24" className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
    <path d="M18 20V10M12 20V4M6 20v-6"/>
  </svg>
)
const ProfileIcon = () => (
  <svg viewBox="0 0 24 24" className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
    <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/>
  </svg>
)
const SearchIcon = () => (
  <svg viewBox="0 0 24 24" className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
    <circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/>
  </svg>
)
const LogoutIcon = () => (
  <svg viewBox="0 0 24 24" className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
    <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9"/>
  </svg>
)

export default function AppShell({ user, children, alertsBadge = 0, onNewAppointment, onSearch }: Props) {
  const pathname = usePathname()
  const router = useRouter()
  const isHead = user.email === HEAD_DOCTOR_EMAIL
  const username = (user.email || "").split("@")[0]

  const logout = async () => {
    await supabase.auth.signOut()
    router.push("/login")
  }

  const navItems = [
    { href: "/calendar",  label: "Записи",      icon: <CalendarIcon /> },
    { href: "/clients",   label: "Клієнти",     icon: <ClientsIcon /> },
    ...(isHead ? [{ href: "/alerts", label: "Сповіщення", icon: <AlertsIcon /> }] : []),
    { href: "/analytics", label: "Аналітика",   icon: <AnalyticsIcon /> },
    { href: "/profile",   label: "Профіль",     icon: <ProfileIcon /> },
  ]

  const isCalendar = pathname === "/calendar"

  return (
    <div className="min-h-svh md:grid md:grid-cols-[240px_minmax(0,1fr)]">
      {/* ─── DESKTOP SIDEBAR ─────────────────────────────── */}
      <aside className="hidden md:flex md:flex-col sticky top-0 h-dvh w-[240px] px-4 py-5 border-r border-[var(--line)] bg-white">
        {/* Brand */}
        <div className="flex items-center gap-3 px-2 mb-8">
          <div className="w-9 h-9 rounded-xl bg-[var(--teal)] text-white text-xs font-black grid place-items-center flex-shrink-0">
            UV
          </div>
          <span className="text-[15px] font-bold tracking-tight text-[var(--ink)]">UltraVet</span>
        </div>

        {/* New appt button */}
        <button
          onClick={onNewAppointment}
          className="w-full h-11 flex items-center justify-center gap-2 mb-4 rounded-xl bg-[var(--teal)] text-white text-[13px] font-semibold hover:bg-[var(--teal-dark)] transition-colors active:scale-[0.97]"
        >
          <span className="text-lg font-light leading-none">+</span>
          Новий запис
        </button>

        {/* Search button */}
        <button
          onClick={onSearch}
          className="w-full h-10 flex items-center gap-2 px-3 mb-6 rounded-xl border border-[var(--line)] bg-[var(--paper)] text-[13px] text-[var(--muted-col)] font-medium hover:border-[var(--teal-mid)] transition-colors"
        >
          <SearchIcon />
          Пошук…
        </button>

        {/* Nav */}
        <nav className="flex flex-col gap-1">
          {navItems.map((item) => {
            const active = pathname === item.href
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`flex items-center gap-3 px-3 h-10 rounded-xl text-[13px] font-medium transition-colors relative ${
                  active
                    ? "bg-[var(--teal-light)] text-[var(--teal)] font-semibold"
                    : "text-[var(--muted-col)] hover:bg-[var(--paper)] hover:text-[var(--ink)]"
                }`}
              >
                {item.icon}
                {item.label}
                {item.href === "/alerts" && alertsBadge > 0 && (
                  <span className="ml-auto flex h-5 min-w-5 items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-black text-white">
                    {alertsBadge > 9 ? "9+" : alertsBadge}
                  </span>
                )}
              </Link>
            )
          })}
        </nav>

        {/* Bottom user + logout */}
        <div className="mt-auto pt-3 border-t border-[var(--line)]">
          <div className="px-2 mb-2 text-[12px] font-medium text-[var(--muted-col)] truncate">{username}</div>
          <button
            onClick={logout}
            className="flex items-center gap-2 w-full px-2 py-1 rounded-xl text-[13px] text-[var(--muted-col)] hover:text-red-500 transition-colors"
          >
            <LogoutIcon />
            Вийти
          </button>
        </div>
      </aside>

      {/* ─── MAIN CONTENT ────────────────────────────────── */}
      <main
        className="w-full max-w-[1200px] mx-auto px-0 md:pb-12 md:px-8 md:pt-6"
        style={{
          paddingTop: "env(safe-area-inset-top)",
          paddingBottom: "calc(48px + max(env(safe-area-inset-bottom), 8px) + 8px)",
        }}
      >
        {children}
      </main>

      {/* ─── MOBILE BOTTOM NAV ───────────────────────────── */}
      <nav
        className="md:hidden fixed bottom-0 left-0 right-0 z-30 bg-white/95 backdrop-blur-xl border-t border-[var(--line)]"
        style={{
          paddingBottom: "max(env(safe-area-inset-bottom), 8px)",
          display: "grid",
          gridTemplateColumns: `repeat(${navItems.length}, 1fr)`,
        }}
      >
        {navItems.map((item) => {
          const active = pathname === item.href
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex flex-col items-center justify-center gap-1 py-2.5 min-h-[48px] text-[10px] font-semibold transition-colors relative ${
                active ? "text-[var(--teal)]" : "text-[var(--muted-col)]"
              }`}
            >
              <span className={`relative ${active ? "[&_svg]:stroke-[2.2]" : ""}`}>
                <span className="w-5 h-5 block">{item.icon}</span>
                {item.href === "/alerts" && alertsBadge > 0 && (
                  <span className="absolute -top-1 -right-1.5 flex h-[15px] min-w-[15px] items-center justify-center rounded-full bg-red-500 border-[1.5px] border-white px-0.5 text-[8px] font-black text-white leading-none">
                    {alertsBadge > 9 ? "9+" : alertsBadge}
                  </span>
                )}
              </span>
              {item.label}
            </Link>
          )
        })}
      </nav>

      {/* ─── MOBILE CALENDAR FAB ─────────────────────────── */}
      {isCalendar && (
        <button
          onClick={onNewAppointment}
          aria-label="Новий запис"
          className="md:hidden fixed right-4 z-20 w-14 h-14 rounded-full bg-[var(--teal)] text-white text-2xl font-light leading-none shadow-lg shadow-teal-500/30 flex items-center justify-center active:scale-[0.92] transition-transform"
          style={{ bottom: "calc(48px + max(env(safe-area-inset-bottom), 8px) + 12px)" }}
        >
          +
        </button>
      )}
    </div>
  )
}
