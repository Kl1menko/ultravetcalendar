// Клієнти не зберігаються окремою таблицею — їх виводимо з історії записів.
// buildClients групує записи по (ім'я + телефон), збирає тварин, історію візитів
// та позначає можливі дублі (однаковий телефон / ім'я). Використовується і
// сторінкою «Клієнти», і підтягуванням клієнта у форму нового запису.
import { Appointment } from "@/types"

export type ClientEntry = {
  client: string
  phone: string
  pets: Map<string, string>   // pet name → animal (вид/порода)
  visits: number
  last: Appointment
  history: Appointment[]
  duplicateCount: number
  duplicateReason: string
}

export function normalizeClientName(value: string) {
  return value.trim().toLowerCase().replace(/\s+/g, " ")
}

// Локальна нормалізація для групування клієнтів: зводимо до останніх 9 цифр,
// щоб збіглись 0XXXXXXXXX / +380XXXXXXXXX. Відрізняється від phone.ts тим, що
// тут потрібен саме ключ групи, а не канонічний 10-значний вигляд.
export function normalizeClientPhone(value: string) {
  const digits = value.replace(/\D/g, "")

  if (digits.length >= 9) {
    return digits.slice(-9)
  }

  return digits
}

export function buildClients(appointments: Appointment[]): ClientEntry[] {
  const map = new Map<string, ClientEntry>()
  // сортуємо по даті щоб last завжди був найновішим
  const sorted = [...appointments].sort((a, b) =>
    `${b.date} ${b.start}`.localeCompare(`${a.date} ${a.start}`)
  )
  sorted.forEach((a) => {
    const key = `${a.client}-${a.phone}`
    if (!map.has(key)) {
      map.set(key, { client: a.client, phone: a.phone, pets: new Map(), visits: 0, last: a, history: [], duplicateCount: 0, duplicateReason: "" })
    }
    const entry = map.get(key)!
    entry.pets.set(a.pet, a.animal || a.pet)
    entry.visits += 1
    entry.history.push(a)
    // last — найновіший запис (sorted DESC)
    if (`${a.date} ${a.start}` > `${entry.last.date} ${entry.last.start}`) {
      entry.last = a
    }
  })
  const clients = [...map.values()]
  const duplicateGroups = new Map<string, ClientEntry[]>()

  clients.forEach((client) => {
    const phoneKey = normalizeClientPhone(client.phone)
    const nameKey = normalizeClientName(client.client)
    const keys = [
      phoneKey.length >= 9 ? `phone:${phoneKey}` : "",
      nameKey ? `name:${nameKey}` : "",
    ].filter(Boolean)

    keys.forEach((key) => {
      const group = duplicateGroups.get(key) ?? []
      group.push(client)
      duplicateGroups.set(key, group)
    })
  })

  clients.forEach((client) => {
    const phoneKey = normalizeClientPhone(client.phone)
    const nameKey = normalizeClientName(client.client)
    const groups = [
      phoneKey.length >= 9 ? { reason: "однаковий телефон", group: duplicateGroups.get(`phone:${phoneKey}`) ?? [] } : null,
      nameKey ? { reason: "однакове ім'я клієнта", group: duplicateGroups.get(`name:${nameKey}`) ?? [] } : null,
    ].filter((item): item is { reason: string; group: ClientEntry[] } => Boolean(item))
    const duplicate = groups.find((item) => item.group.length > 1)

    if (duplicate) {
      client.duplicateCount = duplicate.group.length
      client.duplicateReason = duplicate.reason
    }
  })

  // сортуємо клієнтів по кількості візитів
  return clients.sort((a, b) => b.visits - a.visits)
}
