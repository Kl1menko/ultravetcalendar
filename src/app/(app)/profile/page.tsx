"use client"

import { FormEvent, useMemo, useState } from "react"
import { KeyRound, LogOut, Save } from "lucide-react"
import { useRouter } from "next/navigation"

import { useCalendarContext } from "@/context/calendar"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import NotificationsCard from "@/components/NotificationsCard"
import { roleLabel } from "@/lib/doctors"
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

  return (
    <div className="px-3.5 pt-3 md:flex md:flex-col md:gap-5 md:px-0 md:pt-0">
      <header className="pb-4 md:desktop-page-header md:px-6 md:py-5">
        <h1 className="text-xl font-bold tracking-tight text-[var(--ink)] md:text-[28px]">
          Профіль
        </h1>
      </header>

      <div className="grid gap-4 lg:grid-cols-[1fr_380px]">
        <div className="flex flex-col gap-4">
        <section className="glass rounded-xl p-4 md:rounded-[24px] md:p-6">
          <div className="flex items-center gap-4">
            <div className="flex size-16 shrink-0 items-center justify-center rounded-full bg-[var(--teal)] text-[22px] font-bold text-white">
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

          <div className="mt-5 grid gap-3 sm:grid-cols-3">
            <div className="desktop-card-hover rounded-lg border border-[var(--line)] p-3 md:rounded-2xl md:p-4">
              <div className="text-[12px] font-semibold text-[var(--muted-col)]">Всього записів</div>
              <div className="mt-2 text-[26px] font-bold text-[var(--ink)]">{stats.total}</div>
            </div>
            <div className="desktop-card-hover rounded-lg border border-[var(--line)] p-3 md:rounded-2xl md:p-4">
              <div className="text-[12px] font-semibold text-[var(--muted-col)]">Цього місяця</div>
              <div className="mt-2 text-[26px] font-bold text-[var(--ink)]">{stats.thisMonth}</div>
            </div>
            <div className="desktop-card-hover rounded-lg border border-[var(--line)] p-3 md:rounded-2xl md:p-4">
              <div className="text-[12px] font-semibold text-[var(--muted-col)]">Топ послуга</div>
              <div className="mt-2 text-[15px] font-bold text-[var(--ink)]">{stats.service}</div>
            </div>
          </div>

          {!currentDoctorName && (
            <p className="mt-3 rounded-lg bg-[var(--teal-light)] px-3 py-2 text-[13px] text-[var(--teal-dark)]">
              Цей акаунт не прив’язано до лікаря. Зверніться до головного лікаря, щоб додати ваш email у налаштування доступу.
            </p>
          )}
        </section>

          <NotificationsCard authorName={displayName} />
        </div>

        <section className="glass rounded-xl p-4 md:rounded-[24px] md:p-6">
          <h2 className="text-[17px] font-bold text-[var(--ink)]">Акаунт</h2>

          <form className="mt-4 space-y-3" onSubmit={handleNameSubmit}>
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
