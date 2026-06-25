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
  // К-сть майбутніх/активних візитів. Рахуємо тут (один прохід по history), щоб
  // бейдж на згорнутій картці не вимагав сортувати історію на кожному рендері.
  upcomingCount: number
  duplicateCount: number
  duplicateReason: string
}

/** Майбутній/активний візит — дата ≥ today і не скасований/завершений. */
function isUpcomingVisit(a: Appointment, today: string) {
  return a.date >= today && a.status !== "Скасовано" && a.status !== "Завершено"
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

export function buildClients(
  appointments: Appointment[],
  today: string = new Date().toISOString().slice(0, 10),
): ClientEntry[] {
  const map = new Map<string, ClientEntry>()
  // сортуємо по даті щоб last завжди був найновішим
  const sorted = [...appointments].sort((a, b) =>
    `${b.date} ${b.start}`.localeCompare(`${a.date} ${a.start}`)
  )
  sorted.forEach((a) => {
    const key = `${a.client}-${a.phone}`
    if (!map.has(key)) {
      map.set(key, { client: a.client, phone: a.phone, pets: new Map(), visits: 0, last: a, history: [], upcomingCount: 0, duplicateCount: 0, duplicateReason: "" })
    }
    const entry = map.get(key)!
    entry.pets.set(a.pet, a.animal || a.pet)
    entry.visits += 1
    entry.history.push(a)
    if (isUpcomingVisit(a, today)) entry.upcomingCount += 1
    // last — найновіший запис (sorted DESC)
    if (`${a.date} ${a.start}` > `${entry.last.date} ${entry.last.start}`) {
      entry.last = a
    }
  })
  const clients = [...map.values()]
  const duplicateGroups = new Map<string, ClientEntry[]>()

  // Дубль визначаємо ЛИШЕ за збігом телефону. Клієнти групуються по (ім'я +
  // телефон), тож той самий номер із різним написанням імені дає окремі картки —
  // саме їх і позначаємо як можливий дубль. Збіг лише за іменем (різні номери —
  // різні люди) дублем не вважаємо.
  clients.forEach((client) => {
    const phoneKey = normalizeClientPhone(client.phone)
    if (phoneKey.length < 9) return
    const key = `phone:${phoneKey}`
    const group = duplicateGroups.get(key) ?? []
    group.push(client)
    duplicateGroups.set(key, group)
  })

  clients.forEach((client) => {
    const phoneKey = normalizeClientPhone(client.phone)
    if (phoneKey.length < 9) return
    const group = duplicateGroups.get(`phone:${phoneKey}`) ?? []
    if (group.length > 1) {
      client.duplicateCount = group.length
      client.duplicateReason = "однаковий телефон"
    }
  })

  // сортуємо клієнтів по кількості візитів
  return clients.sort((a, b) => b.visits - a.visits)
}
