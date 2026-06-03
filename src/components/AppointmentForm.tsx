"use client"

import { useState, useEffect } from "react"
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet"
import { Appointment } from "@/types"
import { DOCTORS } from "@/lib/doctors"
import { STATUSES, DURATIONS } from "@/lib/constants"
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
}

export default function AppointmentForm({
  open,
  onClose,
  onSaved,
  selectedDate,
  prefillTime,
  editing,
  userId,
}: Props) {
  const [date, setDate] = useState("")
  const [start, setStart] = useState("09:00")
  const [duration, setDuration] = useState("30")
  const [client, setClient] = useState("")
  const [phone, setPhone] = useState("")
  const [pet, setPet] = useState("")
  const [animal, setAnimal] = useState("")
  const [service, setService] = useState("")
  const [price, setPrice] = useState("")
  const [doctor, setDoctor] = useState<string>(DOCTORS[0])
  const [status, setStatus] = useState<string>("Заплановано")
  const [comment, setComment] = useState("")
  const [saving, setSaving] = useState(false)
  const [formError, setFormError] = useState("")

  // Reset form when opened
  useEffect(() => {
    if (!open) return
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
      setService(editing.service)
      setPrice(editing.price ? String(editing.price) : "")
      setDoctor(editing.doctor)
      setStatus(editing.status)
      setComment(editing.comment)
    } else {
      setDate(isoDate(selectedDate))
      setStart(prefillTime || "09:00")
      setDuration("30")
      setClient("")
      setPhone("")
      setPet("")
      setAnimal("")
      setService("")
      setPrice("")
      setDoctor(DOCTORS[0])
      setStatus("Заплановано")
      setComment("")
    }
  }, [open, editing, selectedDate, prefillTime])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setFormError("")
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
      service: service.trim(),
      price: Number(price) || 0,
      doctor,
      status,
      comment: comment.trim(),
      created_by: userId,
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

  const fieldClass =
    "w-full h-11 rounded-xl border border-[var(--line)] bg-white px-3 text-[15px] text-[var(--ink)] font-medium outline-none focus:border-[var(--teal)] focus:ring-2 focus:ring-[var(--teal)]/10 transition"
  const labelClass =
    "flex flex-col gap-1.5 text-[11px] font-bold uppercase tracking-[0.4px] text-[var(--muted-col)]"

  return (
    <Sheet open={open} onOpenChange={(v) => !v && onClose()}>
      <SheetContent
        side="bottom"
        className="max-h-[94svh] overflow-y-auto px-4 pb-6 rounded-t-[18px]"
      >
        {/* Handle bar */}
        <div className="w-10 h-1 rounded-full bg-[var(--line)] mx-auto mb-5 mt-1" />

        <SheetHeader className="mb-5 text-left">
          <SheetTitle className="text-[20px] font-black text-[var(--ink)]">
            {editing ? "Редагувати запис" : "Новий запис"}
          </SheetTitle>
        </SheetHeader>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          {formError && (
            <div className="rounded-xl bg-red-50 border border-red-200 text-red-600 text-[13px] font-semibold px-4 py-3">
              {formError}
            </div>
          )}

          <label className={labelClass}>
            Дата
            <input type="date" required value={date} onChange={(e) => setDate(e.target.value)} className={fieldClass} />
          </label>

          <label className={labelClass}>
            Час початку
            <input type="time" required value={start} onChange={(e) => setStart(e.target.value)} className={fieldClass} />
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

          <label className={labelClass}>
            Тварина
            <input type="text" required value={pet} onChange={(e) => setPet(e.target.value)} placeholder="Рекс" className={fieldClass} />
          </label>

          <label className={labelClass}>
            Вид/порода
            <input type="text" value={animal} onChange={(e) => setAnimal(e.target.value)} placeholder="собака, лабрадор" className={fieldClass} />
          </label>

          <label className={labelClass}>
            Послуга
            <input type="text" required value={service} onChange={(e) => setService(e.target.value)} placeholder="Вакцинація" className={fieldClass} />
          </label>

          <label className={labelClass}>
            Ціна (₴) <span className="normal-case text-[10px] font-normal text-[var(--muted-col)]">— необов&apos;язково</span>
            <input type="number" min={0} step={10} value={price} onChange={(e) => setPrice(e.target.value)} placeholder="0" className={fieldClass} />
          </label>

          <label className={labelClass}>
            Відповідальний лікар
            <select value={doctor} onChange={(e) => setDoctor(e.target.value)} required className={fieldClass}>
              {DOCTORS.map((d) => <option key={d}>{d}</option>)}
            </select>
          </label>

          <label className={labelClass}>
            Статус
            <select value={status} onChange={(e) => setStatus(e.target.value)} required className={fieldClass}>
              {STATUSES.map((s) => <option key={s}>{s}</option>)}
            </select>
          </label>

          <label className={labelClass}>
            Коментар
            <textarea
              rows={3}
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              placeholder="Коротка примітка"
              className="w-full rounded-xl border border-[var(--line)] bg-white px-3 py-3 text-[15px] text-[var(--ink)] font-medium outline-none focus:border-[var(--teal)] focus:ring-2 focus:ring-[var(--teal)]/10 transition resize-y min-h-[80px] h-auto"
            />
          </label>

          {/* Sticky actions */}
          <div className="sticky bottom-0 bg-white pt-4 pb-2 grid grid-cols-2 gap-3">
            <button
              type="button"
              onClick={onClose}
              className="rounded-xl border border-[var(--line)] bg-[var(--paper)] h-11 text-[14px] font-semibold text-[var(--ink-2)] active:scale-[0.98] transition-transform"
            >
              Закрити
            </button>
            <button
              type="submit"
              disabled={saving}
              className="rounded-xl bg-[var(--teal)] text-white h-11 text-[14px] font-semibold hover:bg-[var(--teal-dark)] active:scale-[0.98] transition-all disabled:opacity-60"
            >
              {saving ? "Зберігаю…" : "Зберегти"}
            </button>
          </div>
        </form>
      </SheetContent>
    </Sheet>
  )
}
