"use client"

import { useEffect, useMemo, useState } from "react"
import {
  Shield,
  RefreshCw,
  Trash2,
  Copy,
  Download,
  Check,
  AlertTriangle,
  CalendarDays,
  Users,
  Wifi,
  WifiOff,
} from "lucide-react"
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

// ─── Презентаційні примітиви ──────────────────────────────────────────────────

function Section({
  title,
  count,
  accent,
  children,
}: {
  title: string
  count?: number
  accent?: boolean
  children: React.ReactNode
}) {
  return (
    <section
      className={`rounded-2xl border p-4 shadow-sm md:p-5 ${
        accent ? "border-red-200 bg-red-50/40" : "border-[var(--line)] bg-white/80"
      }`}
    >
      <div className="mb-3 flex items-center gap-2">
        <h2 className="text-[13px] font-black uppercase tracking-[0.08em] text-[var(--muted-col)]">
          {title}
        </h2>
        {count !== undefined && count > 0 && (
          <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-red-500 px-1.5 text-[11px] font-black text-white">
            {count}
          </span>
        )}
      </div>
      {children}
    </section>
  )
}

// Велика метрична картка для KPI-сітки зверху.
function Stat({
  label,
  value,
  icon,
}: {
  label: string
  value: React.ReactNode
  icon?: React.ReactNode
}) {
  return (
    <div className="rounded-2xl border border-[var(--line)] bg-white/80 p-4 shadow-sm">
      <div className="flex items-center gap-1.5 text-[var(--muted-col)]">
        {icon}
        <span className="text-[11px] font-bold uppercase tracking-[0.06em]">{label}</span>
      </div>
      <div className="mt-1 text-[26px] font-black leading-none text-[var(--ink)]">{value}</div>
    </div>
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

// Чип доступу: компактна заміна рядкам так/ні.
function AccessChip({ label, value }: { label: string; value: boolean }) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-[12px] font-bold ${
        value
          ? "border-emerald-200 bg-emerald-50 text-emerald-700"
          : "border-[var(--line)] bg-[var(--paper)] text-[var(--muted-col)]"
      }`}
    >
      <span className={`h-1.5 w-1.5 rounded-full ${value ? "bg-emerald-500" : "bg-slate-300"}`} />
      {label}
    </span>
  )
}

function ActionButton({
  onClick,
  icon,
  children,
  danger,
}: {
  onClick: () => void
  icon: React.ReactNode
  children: React.ReactNode
  danger?: boolean
}) {
  return (
    <button
      onClick={onClick}
      className={`flex h-10 items-center justify-center gap-2 rounded-xl border bg-white px-3 text-[13px] font-bold shadow-sm transition-colors ${
        danger
          ? "border-[var(--line)] text-red-600 hover:border-red-300 hover:bg-red-50"
          : "border-[var(--line)] text-[var(--ink)] hover:border-[var(--teal-mid)] hover:bg-[var(--teal-light)]"
      }`}
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
  const [toast, setToast] = useState<string | null>(null)
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

  // Оновлюємо годинник раз на хвилину — щоб «Дата/час» не була застиглою.
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 60_000)
    return () => clearInterval(id)
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

  const flash = (msg: string) => {
    setToast(msg)
    setTimeout(() => setToast(null), 2000)
  }

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
  const handleReload = () => {
    reload()
    flash("Записи оновлено")
  }

  const handleClearNoticesLastSeen = () => {
    try {
      window.localStorage.removeItem("notices_last_seen")
      setClient((c) => (c ? { ...c, noticesLastSeen: null } : c))
      flash("Позначку прочитаних сповіщень скинуто")
    } catch {
      /* no-op */
    }
  }

  const handleBackup = () => {
    const backup = buildAppointmentsBackup(appointments, canSeePrices(user.email))
    downloadJson(`backup_appointments_${isoDate(new Date())}.json`, backup)
    flash("Бекап завантажується")
  }

  const handleClearErrors = () => {
    clearAppErrors()
    setErrors([])
    flash("Лог помилок очищено")
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

  const displayName = user.user_metadata?.display_name || user.email?.split("@")[0]

  return (
    <div className="flex flex-col gap-4 px-3.5 pt-3 pb-6 md:gap-5 md:px-0 md:pt-0">
      {/* Header */}
      <header className="flex items-center justify-between gap-3 pb-1 md:desktop-page-header md:px-6 md:py-5">
        <div className="flex items-center gap-2.5">
          <span className="grid h-9 w-9 place-items-center rounded-xl bg-[var(--teal-light)] text-[var(--teal-dark)]">
            <Shield className="h-5 w-5" strokeWidth={1.9} />
          </span>
          <div>
            <h1 className="text-[22px] font-black leading-none tracking-tight text-[var(--ink)] md:text-[28px]">
              Адмін
            </h1>
            <p className="mt-1 text-[12px] font-semibold text-[var(--muted-col)]">
              {displayName} · {roleLabel(role)}
            </p>
          </div>
        </div>
        <ActionButton onClick={handleReload} icon={<RefreshCw className="h-4 w-4" />}>
          Оновити
        </ActionButton>
      </header>

      {/* KPI — головні цифри без скролу */}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <Stat label="Усього записів" value={stats.total} icon={<CalendarDays className="h-3.5 w-3.5" />} />
        <Stat label="Сьогодні" value={stats.todayCount} icon={<CalendarDays className="h-3.5 w-3.5" />} />
        <Stat label="Майбутніх" value={stats.upcoming} icon={<CalendarDays className="h-3.5 w-3.5" />} />
        <Stat label="Клієнтів" value={stats.clients} icon={<Users className="h-3.5 w-3.5" />} />
      </div>

      {/* Помилки — нагорі, бо найважливіше для адміна */}
      <Section title="Помилки" count={errors.length} accent={errors.length > 0}>
        <div className="mb-3 flex flex-wrap gap-2">
          <ActionButton onClick={handleClearErrors} icon={<Trash2 className="h-4 w-4" />} danger>
            Очистити
          </ActionButton>
          <ActionButton
            onClick={handleCopyErrors}
            icon={copied ? <Check className="h-4 w-4 text-emerald-600" /> : <Copy className="h-4 w-4" />}
          >
            {copied ? "Скопійовано" : "Копіювати"}
          </ActionButton>
          {errors.length > 0 && (
            <ActionButton onClick={downloadAppErrorsJson} icon={<Download className="h-4 w-4" />}>
              Зберегти у файл
            </ActionButton>
          )}
        </div>

        {errors.length === 0 ? (
          <div className="flex items-center gap-3 rounded-xl border border-dashed border-emerald-200 bg-emerald-50/40 px-4 py-5">
            <Check className="h-5 w-5 shrink-0 text-emerald-600" />
            <div>
              <p className="text-[13px] font-bold text-[var(--ink)]">Помилок немає</p>
              <p className="text-[12px] text-[var(--muted-col)]">Лог порожній — усе працює.</p>
            </div>
          </div>
        ) : (
          <ul className="flex max-h-[320px] flex-col gap-2 overflow-y-auto">
            {errors.map((e) => (
              <li
                key={e.id}
                className="rounded-xl border border-[var(--line)] bg-white px-3 py-2 shadow-sm"
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="flex items-center gap-1 rounded-md bg-red-50 px-1.5 py-0.5 text-[11px] font-black text-red-600">
                    <AlertTriangle className="h-3 w-3" />
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

      {/* Двоколонкова сітка для решти — менше скролу на desktop */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 md:gap-5">
        {/* Система */}
        <Section title="Система">
          <Row label="Застосунок" value={APP_NAME} />
          <Row label="Email" value={user.email} />
          <Row label="Роль" value={roleLabel(role)} />
          <Row label="Лікар" value={currentDoctor ? doctorShortName(currentDoctor) : "—"} />
          <Row label="Дата/час" value={now ? now.toLocaleString("uk-UA") : "—"} />
          <Row
            label="Статуси"
            value={
              <span className="flex flex-wrap justify-end gap-1.5">
                <span className="rounded-md bg-emerald-50 px-1.5 py-0.5 text-[11px] font-black text-emerald-700">
                  ✓ {stats.completed}
                </span>
                <span className="rounded-md bg-red-50 px-1.5 py-0.5 text-[11px] font-black text-red-600">
                  ✕ {stats.cancelled}
                </span>
              </span>
            }
          />
          <Row
            label="Дублі клієнтів"
            value={
              stats.duplicates > 0 ? (
                <span className="text-amber-600">{stats.duplicates}</span>
              ) : (
                "0"
              )
            }
          />
        </Section>

        {/* Доступи */}
        <Section title="Доступи">
          <div className="flex flex-wrap gap-2">
            <AccessChip label="Аналітика цін" value={canSeePrices(user.email)} />
            <AccessChip label="Ціни записів" value={canSeeAppointmentPrices(user.email)} />
            <AccessChip label="Клієнти" value={canSeeClients(user.email)} />
            <AccessChip label="Адмінка" value={canSeeAdmin(user.email)} />
            <AccessChip label="Debug" value={canSeeDebug(user.email)} />
          </div>
        </Section>

        {/* Клієнт / PWA */}
        <Section title="Клієнт / PWA">
          <Row
            label="Статус мережі"
            value={
              client ? (
                client.online ? (
                  <span className="inline-flex items-center gap-1 text-emerald-600">
                    <Wifi className="h-3.5 w-3.5" /> online
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1 text-red-600">
                    <WifiOff className="h-3.5 w-3.5" /> offline
                  </span>
                )
              ) : (
                "—"
              )
            }
          />
          <Row
            label="localStorage"
            value={
              <AccessChip label={client?.localStorage ? "доступно" : "недоступно"} value={client?.localStorage ?? false} />
            }
          />
          <Row label="notices_last_seen" value={client?.noticesLastSeen ?? "—"} />
          <Row label="viewport" value={client ? `${client.width} × ${client.height}` : "—"} />
          <Row label="route" value={client?.route ?? "—"} />
          <Row label="userAgent" value={client?.userAgent ?? "—"} />
        </Section>

        {/* Службові дії */}
        <Section title="Службові дії">
          <div className="grid grid-cols-1 gap-2">
            <ActionButton onClick={handleReload} icon={<RefreshCw className="h-4 w-4" />}>
              Перезавантажити записи
            </ActionButton>
            <ActionButton onClick={handleBackup} icon={<Download className="h-4 w-4" />}>
              Зберегти копію записів
            </ActionButton>
            <ActionButton onClick={downloadAppErrorsJson} icon={<Download className="h-4 w-4" />}>
              Зберегти журнал помилок
            </ActionButton>
            <ActionButton onClick={handleClearNoticesLastSeen} icon={<Trash2 className="h-4 w-4" />} danger>
              Скинути позначку прочитаних сповіщень
            </ActionButton>
          </div>
        </Section>
      </div>

      {/* Toast-фідбек на дії */}
      {toast && (
        <div className="fixed bottom-[calc(var(--bottom-nav-total)+16px)] left-1/2 z-50 -translate-x-1/2 rounded-xl bg-[var(--ink)] px-4 py-2.5 text-[13px] font-bold text-white shadow-lg md:bottom-6">
          {toast}
        </div>
      )}
    </div>
  )
}
