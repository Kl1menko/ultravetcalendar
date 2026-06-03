# UltraVet — Agent Guide

Повний опис логіки додатку, архітектури та правил для AI-агентів.

---

## Що це

PWA-планер записів для ветеринарної клініки. Багатокористувацький — кілька лікарів логіняться одночасно, бачать спільний календар в реальному часі.

---

## Стек

| Шар | Технологія |
|-----|-----------|
| Фреймворк | Next.js 15 (App Router) |
| Мова | TypeScript |
| Стилі | Tailwind CSS |
| UI компоненти | shadcn/ui |
| Календар | FullCalendar (`@fullcalendar/timegrid` + `@fullcalendar/interaction`) |
| База даних | Supabase (PostgreSQL + Realtime + Auth) |
| Auth | Supabase Auth (email/password) |

---

## Структура проекту

```
src/
  app/
    layout.tsx                — root layout, PWA meta, theme-color
    page.tsx                  — redirect / → /calendar
    login/page.tsx            — сторінка логіну
    (app)/
      layout.tsx              — AuthGuard + CalendarContext провайдер
      calendar/page.tsx       — головна: WeekStrip + FullCalendar
      clients/page.tsx        — список клієнтів + inline пошук
      alerts/page.tsx         — сповіщення (тільки head doctor)
      analytics/page.tsx      — заглушка
      profile/page.tsx        — заглушка
  components/
    AppShell.tsx              — sidebar (desktop) + bottom nav (mobile)
    CalendarView.tsx          — FullCalendar wrapper (no SSR)
    WeekStrip.tsx             — горизонтальний strip 14 днів з % зайнятості
    AppointmentForm.tsx       — Sheet з формою створення/редагування запису
    AppointmentDetails.tsx    — Sheet з деталями запису + швидка зміна статусу
    SearchDialog.tsx          — глобальний пошук по клієнту/кличці/телефону
    DoctorFilterSheet.tsx     — фільтр по лікарю (mobile sheet)
  lib/
    constants.ts              — SUPABASE_URL, SUPABASE_ANON, HEAD_DOCTOR_EMAIL, HOUR_START/END
    doctors.ts                — DOCTORS[], DOCTOR_COLORS[], doctorColor()
    supabase.ts               — createClient singleton
    appointments.ts           — fetchAppointments, createAppointment, updateAppointment, deleteAppointment
    notices.ts                — fetchNotices, createNotice, deleteNotice
    utils-app.ts              — isoDate, formatTitle, minutesFromTime, timeFromMinutes, durationLabel, etc.
  hooks/
    useAuth.ts                — слухає onAuthStateChange, повертає { user, loading }
    useAppointments.ts        — завантажує appointments + Realtime subscription
  types/
    index.ts                  — Appointment, Notice, AppointmentRow типи
```

---

## База даних (Supabase)

### Таблиця `appointments`
```sql
id          uuid primary key default gen_random_uuid()
date        date not null
start_time  time not null
end_time    time not null
client      text not null
phone       text not null
pet         text not null
animal      text                    -- вид/порода
service     text not null
price       numeric(10,2) default 0
doctor      text not null
status      text not null default 'Заплановано'
comment     text
created_by  uuid references auth.users(id)
created_at  timestamptz default now()
updated_at  timestamptz default now()
```

### Таблиця `notices`
```sql
id          uuid primary key default gen_random_uuid()
text        text not null
created_by  uuid references auth.users(id)
created_at  timestamptz default now()
```

### RLS
- Всі автентифіковані користувачі можуть читати/писати/оновлювати/видаляти `appointments`
- Всі автентифіковані можуть читати та вставляти `notices`
- Видаляти `notices` можуть всі автентифіковані (але UI показує кнопку тільки head doctor)

### Realtime
- `appointments` додана до `supabase_realtime` publication
- При будь-якій зміні — всі підключені клієнти отримують подію і перезавантажують дані

---

## Лікарі

```ts
// src/lib/doctors.ts
const DOCTORS = [
  "Остап (головний лікар)",   // index 0 — синій
  "Юрій (лікар)",             // index 1 — зелений
  "Устим (асистент)",         // index 2 — жовтий
  "Іван (асистент)",          // index 3 — рожевий
  "Ірина (асистент)",         // index 4 — фіолетовий
]
```

Колір лікаря визначається індексом у масиві через `doctorColor(name)`. Якщо лікаря не знайдено — використовується index 0 (синій).

---

## Ролі користувачів

| Email | Роль |
|-------|------|
| `head@clinic.com` | Головний лікар — бачить вкладку "Сповіщення", може публікувати та видаляти повідомлення |
| Будь-який інший | Звичайний лікар — 4 вкладки без сповіщень |

Перевірка ролі: `user.email === HEAD_DOCTOR_EMAIL` (константа в `lib/constants.ts`)

---

## Навігація

### Desktop (≥ 760px)
- Sidebar зліва: логотип, кнопка "Новий запис", nav-посилання, email юзера, кнопка logout

### Mobile (< 760px)
- Bottom nav з 4 або 5 вкладками залежно від ролі
- Header на кожній сторінці з назвою і кнопкою logout

### Вкладки
| Tab | Route | Видимість |
|-----|-------|-----------|
| Записи | `/calendar` | всі |
| Клієнти | `/clients` | всі |
| Аналітика | `/analytics` | всі (заглушка) |
| Профіль | `/profile` | всі (заглушка) |
| Сповіщення | `/alerts` | тільки `head@clinic.com` |

---

## Календар (FullCalendar)

### Конфігурація
```ts
plugins: [timeGridPlugin, interactionPlugin]
initialView: "timeGridDay"
slotMinTime: "08:00:00"
slotMaxTime: "20:00:00"
slotDuration: "00:15:00"
allDaySlot: false
locale: "uk"
headerToolbar: false  // власний header через WeekStrip
```

### Формат events
```ts
{
  id: appointment.id,
  title: appointment.client,
  start: `${appointment.date}T${appointment.start}`,
  end: `${appointment.date}T${appointment.end}`,
  backgroundColor: color.bg,
  borderColor: color.border,
  textColor: color.text,
  extendedProps: { appointment }
}
```

### Handlers
- `eventClick` → відкриває `AppointmentDetails` sheet
- `dateClick` → відкриває `AppointmentForm` з pre-filled датою і часом
- FullCalendar автоматично вирішує проблему перетинів подій (розміщує їх поруч колонками)

---

## WeekStrip

- Показує 14 днів: 3 до вибраної дати + вибрана + 10 після
- Для кожного дня рахує % зайнятості: `Math.round(count / MAX_APPOINTMENTS_PER_DAY * 100)`
- `MAX_APPOINTMENTS_PER_DAY = 8`
- Вибраний день — заповнений teal
- Сьогодні (якщо не вибраний) — обведений teal
- Горизонтальний скрол, вибраний день автоматично `scrollIntoView`

---

## Форма запису (AppointmentForm)

### Поля
| Поле | Тип | Обов'язкове |
|------|-----|-------------|
| date | date | ✓ |
| start | time | ✓ |
| duration | select (15/30/45/60/90/120 хв) | ✓ |
| client | text | ✓ |
| phone | tel | ✓ |
| pet | text | ✓ |
| animal | text (вид/порода) | — |
| service | text | ✓ |
| price | number | — |
| doctor | select з DOCTORS | ✓ |
| status | select | ✓ |
| comment | textarea | — |

`end_time` розраховується: `start + duration`

### Статуси
`"Заплановано" | "Очікує" | "В кабінеті" | "Завершено"`

---

## Клієнти

- Унікальні клієнти витягуються з `appointments` (групування по `client + phone`)
- Для кожного клієнта: ініціали-аватар, ім'я, список тварин, остання послуга
- Inline пошук по імені, кличці тварини, телефону (фільтрація без запиту до БД)
- Кнопка "Подзвонити" → `href="tel:..."`

---

## Сповіщення

- Доступні тільки `head@clinic.com`
- Форма публікації нового повідомлення (textarea + кнопка)
- Список опублікованих повідомлень з датою
- Кнопка "Видалити" для кожного повідомлення
- Badge з кількістю непрочитаних на іконці вкладки
- "Непрочитані" = `created_at > localStorage("notices_last_seen")`
- При відкритті вкладки — оновлює `notices_last_seen` і скидає badge

---

## Auth flow

```
Відкриття додатку
  → useAuth слухає onAuthStateChange
  → якщо немає сесії → redirect /login
  → якщо є сесія → показуємо app

Login
  → supabase.auth.signInWithPassword({ email, password })
  → при успіху onAuthStateChange спрацює → redirect /calendar

Logout
  → supabase.auth.signOut()
  → onAuthStateChange → redirect /login
```

---

## Кольорова схема

| Токен | Значення | Використання |
|-------|----------|-------------|
| `teal` | `#0d7377` | Primary — кнопки, активні елементи, border |
| `teal-dark` | `#085a5e` | Hover стани |
| `teal-light` | `#e6f5f5` | Backgrounds, активні картки |
| `teal-mid` | `#b2dede` | Borders другорядні |

Tailwind config:
```js
theme: {
  extend: {
    colors: {
      teal: { DEFAULT: "#0d7377", dark: "#085a5e", light: "#e6f5f5", mid: "#b2dede" }
    }
  }
}
```

---

## Сторінка Профіль (`/profile`) — план реалізації

Поточний стан: заглушка `"Скоро буде"` в `src/app/(app)/profile/page.tsx`.

### Що показувати

**1. Блок користувача (зверху)**
- Аватар-коло з ініціалами (як у AppShell мобільному), але більший — 64px
- Ім'я лікаря: брати з `DOCTORS` масиву по `user.email` або з `user.user_metadata.full_name` якщо є
- Email користувача
- Роль: "Головний лікар" якщо `user.email === HEAD_DOCTOR_EMAIL`, інакше "Лікар"

**2. Статистика лікаря**
Фільтрувати `appointments` з CalendarContext по `a.doctor === currentDoctorName`:
- Всього записів
- Записів за поточний місяць
- Найпопулярніша послуга

**3. Зміна імені відображення** (опційно)
- Поле `user.user_metadata.display_name` через `supabase.auth.updateUser({ data: { display_name } })`

**4. Зміна пароля**
```ts
supabase.auth.updateUser({ password: newPassword })
```
- Форма: поточний пароль (тільки для валідації на клієнті або пропустити), новий пароль, підтвердження
- При успіху — toast/повідомлення

**5. Вихід з акаунту**
- Кнопка "Вийти" (вже є в AppShell desktop, але на мобільному профіль — правильне місце)
- `supabase.auth.signOut()` → `router.replace("/login")`

### Як отримати ім'я лікаря по email

Зараз в БД немає прямого зв'язку email → ім'я лікаря з `DOCTORS`. Варіанти:
- **Простий**: зберігати `display_name` в `user.user_metadata` при першому логіні або через форму в профілі
- **Складніший**: додати таблицю `doctor_profiles(user_id, doctor_name)` і joinити

Рекомендується простий варіант через `user_metadata`.

### Структура компонента

```tsx
"use client"
// profile/page.tsx — "use client" бо використовує CalendarContext і useState
import { useCalendarContext } from "../layout"
import { supabase } from "@/lib/supabase"

// Дані: user з CalendarContext, appointments для статистики
// Форма зміни пароля: локальний useState, виклик supabase.auth.updateUser
```

### UI-патерн (відповідно до стилю проекту)
- Аватар + ім'я/email — такий самий `rounded-2xl border border-[var(--line)]` блок як в AppointmentDetails
- Статистика — `grid grid-cols-3` як на сторінці Analytics (summary картки)
- Форма пароля — такий самий стиль як AppointmentForm (fieldClass, labelClass)
- Кнопка виходу — червона, в самому низу

---

## Правила для агентів

1. **Не міняти DOCTORS масив** — порядок елементів визначає кольори. Якщо додати нового лікаря — додавати тільки в кінець і додавати відповідний колір у DOCTOR_COLORS.

2. **Supabase ANON ключ** — публічний anon ключ, не секрет. RLS захищає дані на рівні БД.

3. **HEAD_DOCTOR_EMAIL** — єдиний спосіб перевірки ролі. Не додавати окремої таблиці ролей без необхідності.

4. **Realtime** — підписка в `useAppointments` hook. При будь-якій зміні просто перезавантажує всі appointments (не патчить масив). Це простіше і надійніше для малого обсягу даних.

5. **CalendarView** — має `dynamic import` з `{ ssr: false }` бо FullCalendar не підтримує SSR.

6. **Типи дат** — в БД `date` зберігається як `"YYYY-MM-DD"`, `start_time`/`end_time` як `"HH:MM:SS"`. В app використовуємо `"HH:MM"` (slice(0,5)).

7. **price поле** — є в БД і формі але не показується в summary. Зберігається для майбутньої аналітики.

8. **Міграція БД** — якщо потрібно додати поле до `appointments`, виконати в Supabase SQL Editor:
   ```sql
   ALTER TABLE appointments ADD COLUMN IF NOT EXISTS <field> <type>;
   ```

9. **shadcn/ui компоненти** — додавати через `npx shadcn@latest add <component>`, не копіювати вручну.

10. **"use client"** — обов'язковий для компонентів що використовують hooks, event handlers, або browser API. Всі сторінки в `(app)/` є client components через CalendarContext.
