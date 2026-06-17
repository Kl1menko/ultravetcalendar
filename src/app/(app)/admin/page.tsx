"use client"

import { useEffect, useMemo, useState } from "react"
import { Shield, RefreshCw, Trash2, Copy, Download, Check } from "lucide-react"
import { useCalendarContext } from "@/context/calendar"
import {
  canSeeAdmin,
  canSeeAppointmentPrices,
  canSeeClients,
  canSeeDebug,
  canSeePrices,
  doctorShortName,
  roleLabel,
} from "@/lib/doctors"
import { buildAppointmentsBackup, downloadJson } from "@/lib/backup"
import {
  AppError,
  appErrorsJson,
  clearAppErrors,
  downloadAppErrorsJson,
  getAppErrors,
} from "@/lib/error-log"
import { isoDate } from "@/lib/utils-app"

const APP_NAME = "UltraVet"

// ─── Дрібні презентаційні примітиви ──────────────────────────────────────────

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="rounded-2xl border border-[var(--line)] bg-white/80 p-4 shadow-sm md:p-5">
      <h2 className="mb-3 text-[13px] font-black uppercase tracking-[0.08em] text-[var(--muted-col)]">
        {title}
      </h2>
      {children}
    </section>
  )
}

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-3 border-b border-[var(--line)] py-2 last:border-0">
      <span className="text-[13px] font-semibold text-[var(--muted-col)]">{label}</span>
      <span className="max-w-[60%] break-words text-right text-[13px] font-bold text-[var(--ink)]">
        {value}
      </span>
    </div>
  )
}

function Bool({ value }: { value: boolean }) {
  return (
    <span
      className={`rounded-full px-2 py-0.5 text-[11px] font-black ${
        value ? "bg-emerald-50 text-emerald-700" : "bg-red-50 text-red-600"
      }`}
    >
      {value ? "так" : "ні"}
    </span>
  )
}

function ActionButton({
  onClick,
  icon,
  children,
}: {
  onClick: () => void
  icon: React.ReactNode
  children: React.ReactNode
}) {
  return (
    <button
      onClick={onClick}
      className="flex h-10 items-center justify-center gap-2 rounded-xl border border-[var(--line)] bg-white px-3 text-[13px] font-bold text-[var(--ink)] shadow-sm transition-colors hover:border-[var(--teal-mid)] hover:bg-[var(--teal-light)]"
    >
      {icon}
      {children}
    </button>
  )
}

// ─── Сторінка ─────────────────────────────────────────────────────────────────

export default function AdminPage() {
  const { appointments, user, role, currentDoctor, reload } = useCalendarContext()

  const isAdmin = canSeeAdmin(user.email)

  const [now, setNow] = useState<Date | null>(null)
  const [errors, setErrors] = useState<AppError[]>([])
  const [copied, setCopied] = useState(false)
  const [client, setClient] = useState<{
    localStorage: boolean
    noticesLastSeen: string | null
    userAgent: string
    width: number
    height: number
    online: boolean
    route: string
  } | null>(null)

  // Усе нижче — браузерні значення, читаємо після mount, щоб уникнути hydration-mismatch.
  // Це разова синхронізація з браузером при монтуванні (не каскадний ре-рендер).
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setNow(new Date())
    setErrors(getAppErrors())

    let localStorageOk = false
    let noticesLastSeen: string | null = null
    try {
      noticesLastSeen = window.localStorage.getItem("notices_last_seen")
      localStorageOk = true
    } catch {
      localStorageOk = false
    }

    setClient({
      localStorage: localStorageOk,
      noticesLastSeen,
      userAgent: navigator.userAgent,
      width: window.innerWidth,
      height: window.innerHeight,
      online: navigator.onLine,
      route: window.location.pathname,
    })
  }, [])

  // Статистика записів.
  const stats = useMemo(() => {
    const today = isoDate(new Date())
    const total = appointments.length
    const todayCount = appointments.filter((a) => a.date === today).length
    const upcoming = appointments.filter((a) => a.date > today).length
    const completed = appointments.filter((a) => a.status === "Завершено").length
    const cancelled = appointments.filter((a) => a.status === "Скасовано").length

    // Клієнти рахуємо за унікальним ключем ім'я+телефон (як у базі клієнтів).
    const clientKeys = new Set(
      appointments.map((a) => `${a.client.trim().toLowerCase()}|${a.phone.replace(/\D/g, "")}`)
    )
    // Потенційні дублі: одне й те саме ім'я з різними телефонами.
    const byName = new Map<string, Set<string>>()
    for (const a of appointments) {
      const name = a.client.trim().toLowerCase()
      if (!name) continue
      const phone = a.phone.replace(/\D/g, "")
      const set = byName.get(name) ?? new Set<string>()
      set.add(phone)
      byName.set(name, set)
    }
    const duplicates = [...byName.values()].filter((s) => s.size > 1).length

    return {
      total,
      todayCount,
      upcoming,
      completed,
      cancelled,
      clients: clientKeys.size,
      duplicates,
    }
  }, [appointments])

  // ── Access denied ──
  if (!isAdmin) {
    return (
      <div className="px-4 pt-4 md:px-0 md:pt-0">
        <header className="pb-4 md:desktop-page-header md:px-6 md:py-5">
          <h1 className="text-[22px] font-black text-[var(--ink)] md:text-[28px]">Адмін</h1>
        </header>
        <div className="mx-auto mt-10 max-w-md rounded-2xl border border-dashed border-[var(--line)] bg-white/70 px-6 py-12 text-center">
          <div className="mx-auto mb-4 grid h-14 w-14 place-items-center rounded-2xl bg-[var(--teal-light)] text-[var(--teal-dark)]">
            <Shield className="h-7 w-7" strokeWidth={1.8} />
          </div>
          <p className="text-[16px] font-black text-[var(--ink)]">Доступ обмежено</p>
          <p className="mt-1.5 text-[13px] text-[var(--muted-col)]">
            Ця сторінка доступна лише адміністратору системи.
          </p>
        </div>
      </div>
    )
  }

  // ── Dev actions ──
  const handleReload = () => reload()

  const handleClearNoticesLastSeen = () => {
    try {
      window.localStorage.removeItem("notices_last_seen")
      setClient((c) => (c ? { ...c, noticesLastSeen: null } : c))
    } catch {
      /* no-op */
    }
  }

  const handleBackup = () => {
    const backup = buildAppointmentsBackup(appointments, canSeePrices(user.email))
    downloadJson(`backup_appointments_${isoDate(new Date())}.json`, backup)
  }

  const handleClearErrors = () => {
    clearAppErrors()
    setErrors([])
  }

  const handleCopyErrors = async () => {
    try {
      await navigator.clipboard.writeText(appErrorsJson())
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    } catch {
      /* clipboard може бути недоступний */
    }
  }

  return (
    <div className="flex flex-col gap-4 px-3.5 pt-3 pb-6 md:gap-5 md:px-0 md:pt-0">
      <header className="flex items-center justify-between gap-3 pb-1 md:desktop-page-header md:px-6 md:py-5">
        <div className="flex items-center gap-2.5">
          <span className="grid h-9 w-9 place-items-center rounded-xl bg-[var(--teal-light)] text-[var(--teal-dark)]">
            <Shield className="h-5 w-5" strokeWidth={1.9} />
          </span>
          <h1 className="text-[22px] font-black tracking-tight text-[var(--ink)] md:text-[28px]">
            Адмін
          </h1>
        </div>
        <ActionButton onClick={handleReload} icon={<RefreshCw className="h-4 w-4" />}>
          Оновити
        </ActionButton>
      </header>

      {/* A. System Overview */}
      <Section title="Система">
        <Row label="Застосунок" value={APP_NAME} />
        <Row label="Користувач" value={user.user_metadata?.display_name || user.email?.split("@")[0]} />
        <Row label="Email" value={user.email} />
        <Row label="Роль" value={roleLabel(role)} />
        <Row label="Лікар" value={currentDoctor ? doctorShortName(currentDoctor) : "—"} />
        <Row label="Дата/час" value={now ? now.toLocaleString("uk-UA") : "—"} />
        <Row label="Усього записів" value={stats.total} />
        <Row label="Записів сьогодні" value={stats.todayCount} />
        <Row label="Майбутніх записів" value={stats.upcoming} />
        <Row label="Завершено" value={stats.completed} />
        <Row label="Скасовано" value={stats.cancelled} />
        <Row label="Клієнтів (з записів)" value={stats.clients} />
        <Row label="Потенційних дублів" value={stats.duplicates} />
      </Section>

      {/* B. Access */}
      <Section title="Доступи">
        <Row label="canSeePrices" value={<Bool value={canSeePrices(user.email)} />} />
        <Row label="canSeeAppointmentPrices" value={<Bool value={canSeeAppointmentPrices(user.email)} />} />
        <Row label="canSeeClients" value={<Bool value={canSeeClients(user.email)} />} />
        <Row label="canSeeAdmin" value={<Bool value={canSeeAdmin(user.email)} />} />
        <Row label="canSeeDebug" value={<Bool value={canSeeDebug(user.email)} />} />
      </Section>

      {/* C. PWA / Client State */}
      <Section title="Клієнт / PWA">
        <Row label="localStorage" value={<Bool value={client?.localStorage ?? false} />} />
        <Row label="notices_last_seen" value={client?.noticesLastSeen ?? "—"} />
        <Row
          label="online"
          value={client ? <Bool value={client.online} /> : "—"}
        />
        <Row
          label="viewport"
          value={client ? `${client.width} × ${client.height}` : "—"}
        />
        <Row label="route" value={client?.route ?? "—"} />
        <Row label="userAgent" value={client?.userAgent ?? "—"} />
      </Section>

      {/* D. Errors */}
      <Section title="Помилки">
        <div className="mb-3 flex flex-wrap gap-2">
          <ActionButton onClick={handleClearErrors} icon={<Trash2 className="h-4 w-4" />}>
            Очистити
          </ActionButton>
          <ActionButton
            onClick={handleCopyErrors}
            icon={copied ? <Check className="h-4 w-4 text-emerald-600" /> : <Copy className="h-4 w-4" />}
          >
            {copied ? "Скопійовано" : "Копіювати JSON"}
          </ActionButton>
        </div>

        {errors.length === 0 ? (
          <div className="rounded-xl border border-dashed border-[var(--line)] bg-[var(--paper)] px-4 py-8 text-center">
            <p className="text-[13px] font-bold text-[var(--ink)]">Помилок немає</p>
            <p className="mt-1 text-[12px] text-[var(--muted-col)]">Лог порожній — усе працює.</p>
          </div>
        ) : (
          <ul className="flex flex-col gap-2">
            {errors.map((e) => (
              <li
                key={e.id}
                className="rounded-xl border border-[var(--line)] bg-white px-3 py-2 shadow-sm"
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="rounded-md bg-red-50 px-1.5 py-0.5 text-[11px] font-black text-red-600">
                    {e.source}
                  </span>
                  <span className="text-[11px] font-semibold text-[var(--muted-col)]">
                    {new Date(e.createdAt).toLocaleString("uk-UA")}
                  </span>
                </div>
                <p className="mt-1 break-words text-[13px] font-semibold text-[var(--ink)]">
                  {e.message}
                </p>
              </li>
            ))}
          </ul>
        )}
      </Section>

      {/* E. Dev actions */}
      <Section title="Dev-дії">
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
          <ActionButton onClick={handleReload} icon={<RefreshCw className="h-4 w-4" />}>
            Перезавантажити записи
          </ActionButton>
          <ActionButton onClick={handleClearNoticesLastSeen} icon={<Trash2 className="h-4 w-4" />}>
            Очистити notices_last_seen
          </ActionButton>
          <ActionButton onClick={handleBackup} icon={<Download className="h-4 w-4" />}>
            Бекап записів JSON
          </ActionButton>
          <ActionButton onClick={downloadAppErrorsJson} icon={<Download className="h-4 w-4" />}>
            Завантажити помилки JSON
          </ActionButton>
        </div>
      </Section>
    </div>
  )
}
