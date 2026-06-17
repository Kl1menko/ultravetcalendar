"use client"

import { usePathname, useRouter } from "next/navigation"
import Link from "next/link"
import Image from "next/image"
import { User } from "@supabase/supabase-js"
import { supabase } from "@/lib/supabase"
import { Shield } from "lucide-react"
import { canSeeAdmin, canSeeClients, canSeePrices, roleForEmail, roleLabel } from "@/lib/doctors"

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
const PriceIcon = () => (
  <svg viewBox="0 0 24 24" className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
    <path d="M20.59 13.41 13.42 20.58a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82Z"/><circle cx="7" cy="7" r="1.2"/>
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
  const role = roleForEmail(user.email)
  const showClients = canSeeClients(user.email)
  const showAnalytics = canSeePrices(user.email)
  const showAdmin = canSeeAdmin(user.email)
  const metadata = user.user_metadata ?? {}
  const displayName =
    (typeof metadata.display_name === "string" && metadata.display_name.trim()) ||
    (typeof metadata.full_name === "string" && metadata.full_name.trim()) ||
    (user.email || "").split("@")[0]

  const logout = async () => {
    await supabase.auth.signOut()
    router.push("/login")
  }

  const navItems = [
    { href: "/calendar",  label: "Записи",      icon: <CalendarIcon /> },
    { href: "/price", label: "Прайс", icon: <PriceIcon /> },
    ...(showClients ? [{ href: "/clients", label: "Клієнти", icon: <ClientsIcon /> }] : []),
    { href: "/alerts", label: "Сповіщення", icon: <AlertsIcon /> },
    ...(showAnalytics ? [{ href: "/analytics", label: "Аналітика", icon: <AnalyticsIcon /> }] : []),
    ...(showAdmin ? [{ href: "/admin", label: "Адмін", icon: <Shield className="w-5 h-5" strokeWidth={1.8} /> }] : []),
    { href: "/profile",   label: "Профіль",     icon: <ProfileIcon /> },
  ]

  const isCalendar = pathname === "/calendar"

  return (
    <div className="min-h-svh bg-[var(--paper)] md:grid md:grid-cols-[280px_minmax(0,1fr)] md:bg-[linear-gradient(135deg,#fafafa_0%,#f4f4f2_50%,#f1f1ef_100%)]">
      {/* ─── DESKTOP SIDEBAR ─────────────────────────────── */}
      <aside className="hidden md:flex md:flex-col sticky top-0 h-dvh w-[280px] border-r border-white/70 bg-white/78 px-5 py-5 shadow-[12px_0_40px_rgba(0,0,0,0.05)] backdrop-blur-2xl">
        {/* Brand */}
        <div className="mb-8 flex items-center gap-3 rounded-2xl border border-[var(--line)] bg-white p-2 shadow-sm">
          <div className="grid h-11 w-11 flex-shrink-0 place-items-center rounded-2xl bg-white shadow-lg shadow-black/10 ring-1 ring-[var(--teal-mid)]">
            <Image src="/logo.svg" alt="UltraVet" width={32} height={32} unoptimized />
          </div>
          <div className="min-w-0">
            <span className="block text-[17px] font-black tracking-tight text-[var(--ink)]">UltraVet</span>
          </div>
        </div>

        {/* New appt button */}
        <button
          onClick={onNewAppointment}
          className="mb-3 flex h-12 w-full items-center justify-center gap-2 rounded-2xl bg-[var(--teal)] text-[14px] font-black text-white shadow-lg shadow-black/15 transition-all hover:-translate-y-0.5 hover:bg-[var(--teal-dark)] active:scale-[0.98]"
        >
          <span className="text-lg font-light leading-none">+</span>
          Новий запис
        </button>

        {/* Search button */}
        <button
          onClick={onSearch}
          className="mb-7 flex h-11 w-full items-center gap-2 rounded-2xl border border-[var(--line)] bg-white px-3 text-[13px] font-semibold text-[var(--muted-col)] shadow-sm transition-colors hover:border-[var(--teal-mid)] hover:text-[var(--ink)]"
        >
          <SearchIcon />
          Пошук…
        </button>

        {/* Nav */}
        <nav className="flex flex-col gap-1.5">
          {navItems.map((item) => {
            const active = pathname === item.href
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`group relative flex h-11 items-center gap-3 rounded-2xl px-3 text-[13px] font-bold transition-all ${
                  active
                    ? "bg-[var(--teal-light)] text-[var(--teal-dark)] shadow-sm ring-1 ring-[var(--teal-mid)]"
                    : "text-[var(--muted-col)] hover:bg-white hover:text-[var(--ink)] hover:shadow-sm"
                }`}
              >
                <span className={`grid h-8 w-8 place-items-center rounded-xl transition-colors ${active ? "bg-white text-[var(--teal)]" : "bg-[var(--paper)] text-[var(--muted-col)] group-hover:bg-[var(--teal-light)] group-hover:text-[var(--teal)]"}`}>
                  {item.icon}
                </span>
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
        <div className="mt-auto rounded-2xl border border-[var(--line)] bg-white p-2 shadow-sm">
          <div className="mb-2 flex items-center gap-2 px-1">
            <div className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-[var(--teal-light)] text-[12px] font-black text-[var(--teal-dark)]">
              {displayName.slice(0, 2).toUpperCase()}
            </div>
            <div className="min-w-0">
              <div className="truncate text-[12px] font-black text-[var(--ink)]">{displayName}</div>
              <div className="text-[10px] font-bold uppercase tracking-[0.08em] text-[var(--muted-col)]">
                {roleLabel(role)}
              </div>
            </div>
          </div>
          <button
            onClick={logout}
            className="flex h-9 w-full items-center gap-2 rounded-xl px-2 text-[13px] font-bold text-[var(--muted-col)] transition-colors hover:bg-red-50 hover:text-red-500"
          >
            <LogoutIcon />
            Вийти
          </button>
        </div>
      </aside>

      {/* ─── MAIN CONTENT ────────────────────────────────── */}
      <main
        className="flex h-svh w-full flex-col overflow-y-auto px-0 pt-[env(safe-area-inset-top)] pb-[var(--bottom-nav-total)] md:mx-auto md:block md:h-auto md:overflow-visible md:max-w-[1440px] md:px-8 md:pb-10 md:pt-7 xl:px-10"
      >
        {children}
      </main>

      {/* ─── MOBILE BOTTOM NAV ───────────────────────────── */}
      <nav
        className="fixed bottom-0 left-0 right-0 z-30 grid border-t border-[var(--line)] bg-white/95 backdrop-blur-xl md:hidden"
        style={{
          paddingBottom: "var(--bottom-nav-safe)",
          gridTemplateColumns: `repeat(${navItems.length}, 1fr)`,
        }}
      >
        {navItems.map((item) => {
          const active = pathname === item.href
          return (
            <Link
              key={item.href}
              href={item.href}
              style={{ height: "var(--bottom-nav-h)" }}
              className={`flex flex-col items-center justify-center gap-1 text-[10px] font-semibold transition-colors relative ${
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
          className="md:hidden fixed right-4 z-20 w-14 h-14 rounded-full bg-[var(--teal)] text-white text-2xl font-light leading-none shadow-lg shadow-black/20 flex items-center justify-center active:scale-[0.92] transition-transform"
          style={{ bottom: "calc(var(--bottom-nav-total) + 12px)" }}
        >
          +
        </button>
      )}
    </div>
  )
}
