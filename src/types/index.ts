// Статус запису — синхронно з enum public.appointment_status у
// supabase/add-appointment-status.sql та STATUSES у src/lib/status.ts.
export type AppointmentStatus =
  | "Заплановано"
  | "Очікує"
  | "В кабінеті"
  | "Завершено"
  | "Скасовано"

export type Appointment = {
  id: string
  date: string
  start: string  // "HH:MM"
  end: string    // "HH:MM"
  client: string
  phone: string
  pet: string
  animal: string
  age: string
  weight: string
  address: string
  service: string
  doctor: string
  comment: string
  price: number
  status: AppointmentStatus
}

export type Notice = {
  id: string
  text: string
  created_by: string
  created_at: string
}

// Зворотний зв'язок команда → admin (баги/покращення).
// Синхронно з enum public.feedback_type / feedback_status у supabase/add-feedback.sql.
export type FeedbackType = "bug" | "improvement"
export type FeedbackStatus = "new" | "in_progress" | "done"

export type Feedback = {
  id: string
  type: FeedbackType
  status: FeedbackStatus
  title: string
  body: string | null
  author_name: string | null
  created_by: string
  created_at: string
  updated_at: string
  reply_count?: number
}

// Відповідь у треді тікета. Пишуть admin та автор тікета (RLS).
export type FeedbackReply = {
  id: string
  feedback_id: string
  body: string
  author_name: string | null
  created_by: string
  created_at: string
}

export type AppointmentRow = {
  id: string
  date: string
  start_time: string
  end_time: string
  client: string
  phone: string
  pet: string
  animal: string | null
  age: string | null
  weight: string | null
  address: string | null
  service: string
  doctor: string
  comment: string | null
  price: number | null
  status: AppointmentStatus | null
  created_by: string | null
  created_at: string
  updated_at: string
}
