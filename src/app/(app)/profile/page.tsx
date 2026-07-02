"use client"

import { FormEvent, useMemo, useState } from "react"
import { BarChart3, ChevronRight, KeyRound, LogOut, Save, Shield } from "lucide-react"
import Link from "next/link"
import { useRouter } from "next/navigation"

import { useCalendarContext } from "@/context/calendar"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import NotificationsCard from "@/components/NotificationsCard"
import ThemeToggle from "@/components/ThemeToggle"
import { rabiesCounts } from "@/lib/analytics"
import { canSeeAdmin, roleLabel } from "@/lib/doctors"
import { parseServices } from "@/lib/services"
import { supabase } from "@/lib/supabase"

function initials(name: string) {
  return name
    .split(/[\s()]+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0])
    .join("")
    .toUpperCase()
}

function mostPopular(values: string[]) {
  if (!values.length) return "Немає даних"

  const counts = values.reduce<Record<string, number>>((acc, value) => {
    acc[value] = (acc[value] ?? 0) + 1
    return acc
  }, {})

  return Object.entries(counts).sort((a, b) => b[1] - a[1])[0]?.[0] ?? "Немає даних"
}

// Показники сказу за період (тиждень/місяць) з розбивкою на котів і собак.
// «other» — старі записи «Сказ» без виду тварини; показуємо лише якщо є.
function RabiesPeriod({
  label,
  data,
}: {
  label: string
  data: { cats: number; dogs: number; other: number; total: number }
}) {
  return (
    <div className="rounded-lg bg-[var(--teal-light)] px-3 py-2">
      <div className="flex items-baseline justify-between">
        <span className="text-[13px] text-[var(--teal-dark)]">{label}</span>
        <span className="text-[22px] font-bold text-[var(--ink)]">{data.total}</span>
      </div>
      <div className="mt-1.5 flex items-center gap-3 text-[12px] text-[var(--teal-dark)]">
        <span>
          🐱 Коти: <span className="font-semibold text-[var(--ink)]">{data.cats}</span>
        </span>
        <span>
          🐶 Собаки: <span className="font-semibold text-[var(--ink)]">{data.dogs}</span>
        </span>
        {data.other > 0 && (
          <span>
            Без виду: <span className="font-semibold text-[var(--ink)]">{data.other}</span>
          </span>
        )}
      </div>
    </div>
  )
}

export default function ProfilePage() {
  const router = useRouter()
  // user/role/currentDoctor — з єдиного джерела (AuthProvider через фасад).
  const { user, appointments, currentDoctor, role } = useCalendarContext()
  const metadata = user?.user_metadata ?? {}
  const metadataName =
    typeof metadata.display_name === "string"
      ? metadata.display_name
      : typeof metadata.full_name === "string"
        ? metadata.full_name
        : ""
  const fallbackName = user?.email?.split("@")[0] ?? "Користувач"
  const displayName = metadataName || fallbackName
  const currentDoctorName = currentDoctor

  const [nameDraft, setNameDraft] = useState<string | null>(null)
  const [newPassword, setNewPassword] = useState("")
  const [confirmPassword, setConfirmPassword] = useState("")
  const [nameMessage, setNameMessage] = useState("")
  const [passwordMessage, setPasswordMessage] = useState("")
  const [savingName, setSavingName] = useState(false)
  const [savingPassword, setSavingPassword] = useState(false)
  const [signingOut, setSigningOut] = useState(false)

  const stats = useMemo(() => {
    const now = new Date()
    const currentMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`
    const ownAppointments = currentDoctorName
      ? appointments.filter((appointment) => appointment.doctor === currentDoctorName)
      : []

    return {
      total: ownAppointments.length,
      thisMonth: ownAppointments.filter((appointment) => appointment.date.startsWith(currentMonth)).length,
      service: mostPopular(ownAppointments.flatMap((appointment) => parseServices(appointment.service))),
    }
  }, [appointments, currentDoctorName])

  // Послуги зі сказу по всій клініці (усі лікарі разом) за поточний тиждень і
  // місяць, з розбивкою на котів і собак.
  const rabies = useMemo(() => rabiesCounts(appointments), [appointments])

  async function handleNameSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const trimmedName = (nameDraft ?? displayName).trim()

    if (!trimmedName) {
      setNameMessage("Вкажіть ім'я для відображення.")
      return
    }

    setSavingName(true)
    setNameMessage("")

    const { error } = await supabase.auth.updateUser({
      data: { display_name: trimmedName },
    })

    setSavingName(false)
    if (error) {
      setNameMessage(error.message)
      return
    }

    setNameDraft(trimmedName)
    setNameMessage("Ім'я оновлено.")
  }

  async function handlePasswordSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()

    if (newPassword.length < 6) {
      setPasswordMessage("Пароль має містити щонайменше 6 символів.")
      return
    }

    if (newPassword !== confirmPassword) {
      setPasswordMessage("Паролі не збігаються.")
      return
    }

    setSavingPassword(true)
    setPasswordMessage("")

    const { error } = await supabase.auth.updateUser({ password: newPassword })

    setSavingPassword(false)
    setPasswordMessage(error ? error.message : "Пароль оновлено.")

    if (!error) {
      setNewPassword("")
      setConfirmPassword("")
    }
  }

  async function handleSignOut() {
    setSigningOut(true)
    await supabase.auth.signOut()
    router.replace("/login")
  }

  // Пункти керування, які раніше були в таб-меню. Цей блок — лише для адміна:
  // у нього аналітика й /admin прибрані з таб-бару (він ними як лікар не
  // користується) і живуть тут. Для head аналітика лишається тільки в таб-барі,
  // тож тут її не дублюємо.
  const isAdmin = canSeeAdmin(role)
  const managementLinks = isAdmin
    ? [
        { href: "/analytics", label: "Аналітика", desc: "Виручка, завантаженість, порівняння періодів", icon: BarChart3 },
        { href: "/admin", label: "Адміністрування", desc: "Користувачі, ролі, системні дані", icon: Shield },
      ]
    : []

  return (
    <div className="px-3.5 pt-3 md:flex md:flex-col md:gap-5 md:px-0 md:pt-0">
      <header className="pb-4 md:desktop-page-header md:px-6 md:py-5">
        <h1 className="text-xl font-bold tracking-tight text-[var(--ink)] md:text-[28px]">
          Профіль
        </h1>
      </header>

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_380px]">
        <div className="flex min-w-0 flex-col gap-4">
        <section className="glass rounded-xl p-4 md:rounded-[24px] md:p-6">
          <div className="flex items-center gap-4">
            <div className="flex size-16 shrink-0 items-center justify-center rounded-full bg-[var(--teal)] text-[22px] font-bold text-[var(--on-teal)]">
              {initials(displayName)}
            </div>
            <div className="min-w-0">
              <h2 className="truncate text-[20px] font-bold text-[var(--ink)]">{displayName}</h2>
              <p className="truncate text-[14px] text-[var(--muted-col)]">{user?.email}</p>
              <p className="mt-1 text-[13px] font-semibold text-[var(--teal-dark)]">
                {roleLabel(role)}
              </p>
            </div>
          </div>

          {/* Статистика записів — лише для лікарів/head. Для адміна акаунт не
              прив'язаний до лікаря, тож показники беззмістовні. */}
          {!isAdmin && (
            <div className="mt-5 grid gap-3 sm:grid-cols-3">
              <div className="desktop-card-hover rounded-lg border border-[var(--line)] p-3 md:rounded-2xl md:p-4">
                <div className="text-[12px] font-semibold text-[var(--muted-col)]">Всього записів</div>
                <div className="mt-2 text-[26px] font-bold text-[var(--ink)]">{stats.total}</div>
              </div>
              <div className="desktop-card-hover rounded-lg border border-[var(--line)] p-3 md:rounded-2xl md:p-4">
                <div className="text-[12px] font-semibold text-[var(--muted-col)]">Цього місяця</div>
                <div className="mt-2 text-[26px] font-bold text-[var(--ink)]">{stats.thisMonth}</div>
              </div>
              <div className="desktop-card-hover rounded-lg border border-[var(--line)] p-3 md:rounded-2xl md:p-4 min-w-0">
                <div className="text-[12px] font-semibold text-[var(--muted-col)]">Топ послуга</div>
                <div className="mt-2 truncate text-[15px] font-bold text-[var(--ink)]">{stats.service}</div>
              </div>
            </div>
          )}

          {/* Послуги зі сказу по всій клініці (усіма лікарями разом), розбиті на
              котів і собак. Для адміна ховаємо разом з рештою показників. */}
          {!isAdmin && (
            <div className="mt-4 rounded-lg border border-[var(--line)] p-3 md:rounded-2xl md:p-4">
              <div className="text-[12px] font-semibold text-[var(--muted-col)]">
                Зроблено послуг зі Сказу
              </div>
              <div className="mt-2 grid gap-3 sm:grid-cols-2">
                <RabiesPeriod label="За тиждень" data={rabies.week} />
                <RabiesPeriod label="За місяць" data={rabies.month} />
              </div>
            </div>
          )}

          {!currentDoctorName && (
            <p className="mt-3 rounded-lg bg-[var(--teal-light)] px-3 py-2 text-[13px] text-[var(--teal-dark)]">
              Цей акаунт не прив’язано до лікаря. Зверніться до головного лікаря, щоб додати ваш email у налаштування доступу.
            </p>
          )}
        </section>

          {managementLinks.length > 0 && (
            <section className="glass rounded-xl p-4 md:rounded-[24px] md:p-6">
              <h2 className="text-[17px] font-semibold text-[var(--ink)]">Керування</h2>
              <div className="mt-3 flex flex-col gap-2">
                {managementLinks.map((link) => (
                  <Link
                    key={link.href}
                    href={link.href}
                    className="desktop-card-hover flex items-center gap-3 rounded-lg border border-[var(--line)] px-3.5 py-3 transition-colors hover:border-[var(--lg-border-strong)] md:rounded-2xl"
                  >
                    <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-[var(--teal-light)] text-[var(--teal-dark)]">
                      <link.icon className="size-[18px]" strokeWidth={1.8} />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block text-[14px] font-medium text-[var(--ink)]">{link.label}</span>
                      <span className="block truncate text-[12px] text-[var(--muted-col)]">{link.desc}</span>
                    </span>
                    <ChevronRight className="size-4 shrink-0 text-[var(--muted-col)]" />
                  </Link>
                ))}
              </div>
            </section>
          )}

          <NotificationsCard authorName={displayName} />
        </div>

        <section className="glass rounded-xl p-4 md:rounded-[24px] md:p-6">
          <h2 className="text-[17px] font-bold text-[var(--ink)]">Акаунт</h2>

          <div className="mt-4 border-b border-[var(--line)] pb-5">
            <ThemeToggle />
          </div>

          <form className="mt-5 space-y-3" onSubmit={handleNameSubmit}>
            <div className="space-y-1.5">
              <Label htmlFor="display-name">Ім’я відображення</Label>
              <Input
                id="display-name"
                value={nameDraft ?? displayName}
                onChange={(event) => setNameDraft(event.target.value)}
                placeholder="Остап (головний лікар)"
              />
            </div>
            <Button className="w-full" disabled={savingName} type="submit">
              <Save />
              {savingName ? "Збереження..." : "Зберегти ім’я"}
            </Button>
            {nameMessage && <p className="text-[13px] text-[var(--muted-col)]">{nameMessage}</p>}
          </form>

          <form className="mt-5 space-y-3 border-t border-[var(--line)] pt-5" onSubmit={handlePasswordSubmit}>
            <div className="space-y-1.5">
              <Label htmlFor="new-password">Новий пароль</Label>
              <Input
                id="new-password"
                type="password"
                value={newPassword}
                onChange={(event) => setNewPassword(event.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="confirm-password">Підтвердження</Label>
              <Input
                id="confirm-password"
                type="password"
                value={confirmPassword}
                onChange={(event) => setConfirmPassword(event.target.value)}
              />
            </div>
            <Button className="w-full" disabled={savingPassword} type="submit" variant="outline">
              <KeyRound />
              {savingPassword ? "Оновлення..." : "Оновити пароль"}
            </Button>
            {passwordMessage && <p className="text-[13px] text-[var(--muted-col)]">{passwordMessage}</p>}
          </form>

          <Button
            className="mt-5 w-full"
            disabled={signingOut}
            onClick={handleSignOut}
            type="button"
            variant="destructive"
          >
            <LogOut />
            {signingOut ? "Вихід..." : "Вийти"}
          </Button>
        </section>
      </div>
    </div>
  )
}
