"use client"

import { useState, useEffect } from "react"
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet"
import { Appointment } from "@/types"
import { DOCTORS, doctorShortName } from "@/lib/doctors"
import { SERVICES, parseServices, joinServices } from "@/lib/services"
import { DURATIONS } from "@/lib/constants"
import { isoDate, minutesFromTime, timeFromMinutes } from "@/lib/utils-app"
import { createAppointment, updateAppointment } from "@/lib/appointments"

type Props = {
  open: boolean
  onClose: () => void
  onSaved: () => void
  selectedDate: Date
  prefillTime?: string
  editing?: Appointment | null
  userId?: string
  /** Чи показувати/дозволяти вводити поле ціни. Усі ролі вписують ціну при записі. */
  canEditPrice?: boolean
}

export default function AppointmentForm({
  open,
  onClose,
  onSaved,
  selectedDate,
  prefillTime,
  editing,
  userId,
  canEditPrice = true,
}: Props) {
  const [date, setDate] = useState("")
  const [start, setStart] = useState("09:00")
  const [duration, setDuration] = useState("30")
  const [client, setClient] = useState("")
  const [phone, setPhone] = useState("")
  const [pet, setPet] = useState("")
  const [animal, setAnimal] = useState("")
  const [age, setAge] = useState("")
  const [weight, setWeight] = useState("")
  const [address, setAddress] = useState("")
  const [services, setServices] = useState<string[]>([])
  const [price, setPrice] = useState("")
  const [doctor, setDoctor] = useState<string>(DOCTORS[0])
  const [comment, setComment] = useState("")
  const [saving, setSaving] = useState(false)
  const [formError, setFormError] = useState("")

  // Reset form when opened
  useEffect(() => {
    if (!open) return

    const timer = window.setTimeout(() => {
      setFormError("")
      if (editing) {
        const durMins = String(
          minutesFromTime(editing.end) - minutesFromTime(editing.start)
        )
        setDate(editing.date)
        setStart(editing.start)
        setDuration(durMins)
        setClient(editing.client)
        setPhone(editing.phone)
        setPet(editing.pet)
        setAnimal(editing.animal)
        setAge(editing.age)
        setWeight(editing.weight)
        setAddress(editing.address)
        setServices(parseServices(editing.service))
        setPrice(editing.price ? String(editing.price) : "")
        setDoctor(editing.doctor)
        setComment(editing.comment)
      } else {
        setDate(isoDate(selectedDate))
        setStart(prefillTime || "09:00")
        setDuration("30")
        setClient("")
        setPhone("")
        setPet("")
        setAnimal("")
        setAge("")
        setWeight("")
        setAddress("")
        setServices([])
        setPrice("")
        setDoctor(DOCTORS[0])
        setComment("")
      }
    }, 0)

    return () => window.clearTimeout(timer)
  }, [open, editing, selectedDate, prefillTime])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setFormError("")

    if (services.length === 0) {
      setFormError("Оберіть хоча б одну послугу")
      return
    }

    setSaving(true)

    const endTime = timeFromMinutes(minutesFromTime(start) + Number(duration || 30))
    const payload = {
      date,
      start_time: start,
      end_time: endTime,
      client: client.trim(),
      phone: phone.trim(),
      pet: pet.trim(),
      animal: (animal || pet).trim(),
      age: age.trim(),
      weight: weight.trim(),
      address: address.trim(),
      service: joinServices(services),
      doctor,
      comment: comment.trim(),
      created_by: userId,
      // Ціну вписують усі ролі (асистенти записують клієнтів). Доступ до
      // загальної картини коштів (аналітика) лишається лише в head — це
      // контролюється окремо й цього payload не стосується.
      ...(canEditPrice ? { price: Number(price) || 0 } : {}),
    }

    let err: Error | null
    if (editing) {
      const res = await updateAppointment(editing.id, payload)
      err = res.error
    } else {
      const res = await createAppointment(payload)
      err = res.error
    }

    setSaving(false)

    if (err) {
      setFormError("Помилка: " + err.message)
      return
    }

    onSaved()
    onClose()
  }

  // appearance-none критично для iOS Safari: нативні <input type="date|time">
  // мають нестискувану intrinsic-ширину й розпирають контейнер за межі екрана.
  const fieldClass =
    "block w-full min-w-0 max-w-full appearance-none h-11 rounded-xl border border-[var(--line)] bg-white px-3 text-[15px] text-[var(--ink)] font-medium outline-none focus:border-[var(--teal)] focus:ring-2 focus:ring-[var(--teal)]/10 transition"
  // iOS Safari не центрує текст у <input type="date|time"> по вертикалі за
  // наявності фіксованої висоти — inline-flex + items-center це виправляє.
  const dateFieldClass = `${fieldClass} inline-flex items-center`
  const labelClass =
    "flex min-w-0 w-full flex-col gap-1.5 text-[11px] font-bold uppercase tracking-[0.4px] text-[var(--muted-col)]"

  return (
    <Sheet open={open} onOpenChange={(v) => !v && onClose()}>
      <SheetContent
        side="bottom"
        showCloseButton={false}
        className="inset-0 h-[100dvh] max-h-[100dvh] w-full max-w-full rounded-none px-0 py-0 md:inset-auto md:left-1/2 md:top-1/2 md:h-auto md:max-h-[86dvh] md:w-[min(920px,calc(100vw-3rem))] md:-translate-x-1/2 md:-translate-y-1/2 md:rounded-[28px] md:bg-white"
      >
        <SheetHeader className="shrink-0 border-b border-[var(--line)] px-4 pb-4 pt-[max(env(safe-area-inset-top),1rem)] text-left md:px-6 md:pt-5">
          <SheetTitle className="text-[20px] font-black text-[var(--ink)] md:text-[26px]">
            {editing ? "Редагувати запис" : "Новий запис"}
          </SheetTitle>
        </SheetHeader>

        <form
          id="appointment-form"
          onSubmit={handleSubmit}
          className="flex min-w-0 flex-1 flex-col gap-4 overflow-y-auto overflow-x-hidden px-4 py-5 md:grid md:grid-cols-2 md:gap-x-4 md:gap-y-5 md:px-6"
        >
          {formError && (
            <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-[13px] font-semibold text-red-600 md:col-span-2">
              {formError}
            </div>
          )}

          <label className={labelClass}>
            Дата
            <input type="date" required value={date} onChange={(e) => setDate(e.target.value)} className={dateFieldClass} />
          </label>

          <label className={labelClass}>
            Час початку
            <input type="time" required value={start} onChange={(e) => setStart(e.target.value)} className={dateFieldClass} />
          </label>

          <label className={labelClass}>
            Тривалість
            <select value={duration} onChange={(e) => setDuration(e.target.value)} required className={fieldClass}>
              {DURATIONS.map((d) => (
                <option key={d.value} value={d.value}>{d.label}</option>
              ))}
            </select>
          </label>

          <label className={labelClass}>
            Клієнт
            <input type="text" required value={client} onChange={(e) => setClient(e.target.value)} placeholder="Олена" className={fieldClass} />
          </label>

          <label className={labelClass}>
            Телефон
            <input type="tel" required value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="+380671112233" className={fieldClass} />
          </label>

          <label className={`${labelClass} md:col-span-2`}>
            Адреса <span className="normal-case text-[10px] font-normal text-[var(--muted-col)]">— необов&apos;язково</span>
            <input type="text" value={address} onChange={(e) => setAddress(e.target.value)} placeholder="вул. Шевченка, 12, кв. 5" className={fieldClass} />
          </label>

          <label className={labelClass}>
            Тварина
            <input type="text" required value={pet} onChange={(e) => setPet(e.target.value)} placeholder="Рекс" className={fieldClass} />
          </label>

          <label className={labelClass}>
            Вид/порода
            <input type="text" value={animal} onChange={(e) => setAnimal(e.target.value)} placeholder="собака, лабрадор" className={fieldClass} />
          </label>

          <label className={labelClass}>
            Вік
            <input type="text" required value={age} onChange={(e) => setAge(e.target.value)} placeholder="3 роки" className={fieldClass} />
          </label>

          <label className={labelClass}>
            Вага <span className="normal-case text-[10px] font-normal text-[var(--muted-col)]">— необов&apos;язково</span>
            <input type="text" value={weight} onChange={(e) => setWeight(e.target.value)} placeholder="4.2 кг" className={fieldClass} />
          </label>

          <div className={`${labelClass} md:col-span-2`}>
            Послуги <span className="normal-case text-[10px] font-normal text-[var(--muted-col)]">— можна обрати кілька</span>
            <div className="flex flex-wrap gap-2">
              {/* Стандартні послуги + нестандартні зі старих записів, що вже обрані. */}
              {[...SERVICES, ...services.filter((s) => !SERVICES.includes(s as never))].map((s) => {
                const active = services.includes(s)
                return (
                  <button
                    key={s}
                    type="button"
                    aria-pressed={active}
                    onClick={() =>
                      setServices((prev) =>
                        prev.includes(s) ? prev.filter((x) => x !== s) : [...prev, s]
                      )
                    }
                    className={[
                      "rounded-full border px-3 py-1.5 text-[13px] font-semibold transition active:scale-[0.97]",
                      active
                        ? "border-[var(--teal)] bg-[var(--teal)] text-white"
                        : "border-[var(--line)] bg-white text-[var(--ink-2)] hover:border-[var(--teal)]",
                    ].join(" ")}
                  >
                    {s}
                  </button>
                )
              })}
            </div>
          </div>

          {canEditPrice && (
            <label className={labelClass}>
              Ціна (₴) <span className="normal-case text-[10px] font-normal text-[var(--muted-col)]">— необов&apos;язково</span>
              <input type="number" min={0} step={1} value={price} onChange={(e) => setPrice(e.target.value)} placeholder="0" className={fieldClass} />
            </label>
          )}

          <label className={labelClass}>
            Відповідальний лікар
            <select value={doctor} onChange={(e) => setDoctor(e.target.value)} required className={fieldClass}>
              {DOCTORS.map((d) => <option key={d} value={d}>{doctorShortName(d)}</option>)}
            </select>
          </label>

          <label className={`${labelClass} md:col-span-2`}>
            Коментар
            <textarea
              rows={3}
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              placeholder="Коротка примітка"
              className="h-auto min-h-[80px] w-full resize-y rounded-xl border border-[var(--line)] bg-white px-3 py-3 text-[15px] font-medium text-[var(--ink)] outline-none transition focus:border-[var(--teal)] focus:ring-2 focus:ring-[var(--teal)]/10 md:min-h-[96px]"
            />
          </label>
        </form>

        {/* Actions — фіксований футер поза скрол-областю форми */}
        <div
          className="grid min-w-0 shrink-0 grid-cols-2 gap-3 border-t border-[var(--line)] bg-white px-4 pt-4 md:px-6 md:py-4"
          style={{ paddingBottom: "max(env(safe-area-inset-bottom), 1rem)" }}
        >
          <button
            type="button"
            onClick={onClose}
            className="h-11 rounded-xl border border-[var(--line)] bg-[var(--paper)] text-[14px] font-semibold text-[var(--ink-2)] transition-transform active:scale-[0.98] md:h-12 md:rounded-2xl"
          >
            Закрити
          </button>
          <button
            type="submit"
            form="appointment-form"
            disabled={saving}
            className="h-11 rounded-xl bg-[var(--teal)] text-[14px] font-semibold text-white transition-all hover:bg-[var(--teal-dark)] active:scale-[0.98] disabled:opacity-60 md:h-12 md:rounded-2xl md:shadow-lg md:shadow-teal-700/20"
          >
            {saving ? "Зберігаю…" : "Зберегти"}
          </button>
        </div>
      </SheetContent>
    </Sheet>
  )
}
