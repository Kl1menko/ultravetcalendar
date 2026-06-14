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
}

export type Notice = {
  id: string
  text: string
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
  created_by: string | null
  created_at: string
  updated_at: string
}
