# UltraVet — Agent Guide

Повний опис логіки додатку, архітектури та правил для AI-агентів.

---

## Що це

PWA-планер записів для ветеринарної клініки. Багатокористувацький — кілька лікарів логіняться одночасно, бачать спільний календар в реальному часі.

---

## Стек

| Шар | Технологія |
|-----|-----------|
| Фреймворк | **Next.js 16** (App Router, Turbopack за замовчуванням) |
| React | React 19.2 |
| Мова | TypeScript 5 |
| Стилі | Tailwind CSS **v4** (config-less, через `@import "tailwindcss"` у `globals.css`) |
| UI компоненти | shadcn/ui + `@base-ui/react` |
| Календар | FullCalendar (`@fullcalendar/timegrid` + `@fullcalendar/interaction`) |
| База даних | Supabase (PostgreSQL + Realtime + Auth) |
| Auth | Supabase Auth (email/password) |

> ⚠️ **Next.js 16 — це не той Next, що в тренувальних даних.** Перед написанням
> коду читай гайд у `node_modules/next/dist/docs/`. Ключове для цього проекту:
> - **Async Request APIs (breaking):** `cookies`, `headers`, `params`, `searchParams`
>   тепер ЛИШЕ async. Зараз додаток повністю клієнтський (Supabase у браузері),
>   тож це не зачіпає поточний код — але будь-який новий серверний компонент /
>   route handler має робити `await params` тощо.
> - **`middleware` → `proxy`:** файл `middleware.ts` deprecated. Якщо знадобиться
>   серверний рефреш сесії Supabase — створювати `proxy.ts` (runtime `nodejs`,
>   edge не підтримується), а не `middleware.ts`.
> - **Turbopack за замовчуванням:** флаг `--turbopack` більше не потрібен (скрипти
>   в `package.json` уже без нього). Кастомний `webpack`-конфіг ламає білд.
> - **`next lint` видалено:** лінт через `eslint` напряму (`npm run lint`),
>   `next build` більше не лінтить. ESLint — flat config (`eslint.config.mjs`).
> - **`next/image`:** `images.domains` deprecated → `remotePatterns`; нові дефолти
>   `qualities: [75]`, `minimumCacheTTL: 4h`, блокування local IP.

---

## Структура проекту

```
src/
  app/
    layout.tsx                — root layout, PWA meta, theme-color, шрифт Inter
    page.tsx                  — redirect / → /calendar
    globals.css               — Tailwind v4 entry + дизайн-токени (@theme)
    login/page.tsx            — сторінка логіну
    (app)/
      layout.tsx              — Auth guard + CalendarContext.Provider + глобальні модалки
      calendar/page.tsx       — головна: WeekStrip + FullCalendar (dynamic, no SSR)
      clients/page.tsx        — список клієнтів + inline пошук (head/doctor)
      analytics/page.tsx      — аналітика записів і коштів (доступ за роллю)
      price/page.tsx          — прайс-лист послуг
      alerts/page.tsx         — сповіщення (тільки head)
      profile/page.tsx        — профіль користувача (статистика, зміна пароля)
  components/
    AppShell.tsx              — sidebar (desktop) + bottom nav (mobile)
    CalendarView.tsx          — FullCalendar wrapper (рендериться лише через dynamic, no SSR)
    WeekStrip.tsx             — горизонтальний strip днів з % зайнятості
    AppointmentForm.tsx       — Sheet з формою створення/редагування запису
    AppointmentDetails.tsx    — Sheet з деталями запису
    SearchDialog.tsx          — глобальний пошук по клієнту/кличці/телефону
    DoctorFilterSheet.tsx     — фільтр по лікарю (mobile sheet)
    NoticeBanner.tsx          — in-app банер нового сповіщення (Realtime)
    ui/                       — shadcn/ui примітиви (button, dialog, sheet, input, label)
  context/
    calendar.tsx              — CalendarContext + useCalendarContext() hook
  lib/
    constants.ts              — SUPABASE_URL/ANON, HOUR_START/END, DURATIONS
    doctors.ts                — DOCTORS[], DOCTOR_COLORS[], doctorColor(), DOCTOR_ACCESS + ролі/доступ
    supabase.ts               — createClient singleton (@supabase/supabase-js)
    appointments.ts           — fetchAppointments, createAppointment, updateAppointment, deleteAppointment
    notices.ts                — fetchNotices, createNotice, deleteNotice
    services.ts, price-list.ts — послуги та прайс
    export-csv.ts, backup.ts  — експорт даних / бекап
    utils-app.ts              — isoDate, minutesFromTime, timeFromMinutes, formatMonthYear, etc.
    utils.ts                  — cn() (clsx + tailwind-merge)
  hooks/
    useAuth.ts                — слухає onAuthStateChange, повертає { user, loading }
    useAppointments.ts        — useAppointments(canSeePrices): appointments + Realtime subscription
  types/
    index.ts                  — Appointment, Notice, AppointmentRow типи
```

> **Примітка:** `useAuth.ts` існує, але auth guard зараз реалізовано прямо в
> `(app)/layout.tsx` (getSession + onAuthStateChange). Контекст живе в
> `src/context/calendar.tsx`, а НЕ експортується з layout.

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
  "Ірина (лікар)",            // index 2 — блакитний (cyan)
  "Устим (асистент)",         // index 3 — жовтий
  "Іван (асистент)",          // index 4 — рожевий
  "Анна (асистент)",          // index 5 — фіолетовий
]
```

Колір лікаря визначається індексом у масиві через `doctorColor(name)`. Якщо лікаря не знайдено — використовується index 0 (синій).

`doctorShortName(name)` — обрізає роль у дужках для показу ("Остап (головний лікар)" → "Остап"). Значення `DOCTORS`/`appointment.doctor` НЕ змінювати — це ключ прив'язки записів.

---

## Ролі та доступ

Ролі визначаються через **email → `DOCTOR_ACCESS`** у `src/lib/doctors.ts`
(`HEAD_DOCTOR_EMAIL` більше не існує). Email порівнюється без урахування регістру.

| Роль | Хто | Доступ |
|------|-----|--------|
| `head` | Остап (`head@clinic.com`) | усе: записи з сумами, аналітика коштів, клієнти, сповіщення |
| `doctor` | Юрій, Ірина | записи (з сумами на тікетах), база клієнтів; без аналітики коштів і сповіщень |
| `assistant` | Устим, Іван, Анна | записи БЕЗ перегляду сум; без аналітики (клієнтів бачать) |

Helpers (приймають email, окрім `canSeeClients`):
- `roleForEmail(email)` → `"head" | "doctor" | "assistant"` (дефолт — `assistant`)
- `doctorForEmail(email)` → ім'я з `DOCTORS` для прив'язки записів/персональної статистики
- `canSeePrices(email)` → доступ до сторінки аналітики коштів (лише `head`)
- `canSeeAppointmentPrices(email)` → бачить суми на тікетах/у деталях (усі, крім `assistant`)
- `canSeeClients()` → доступ до бази клієнтів (усі ролі; дані й так читаються за RLS)

> ⚠️ Тримай `DOCTOR_ACCESS` у синхроні з RLS-політиками в `supabase/rls-policies.sql`.

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
| Клієнти | `/clients` | всі (`canSeeClients`) |
| Аналітика | `/analytics` | доступ за роллю (кошти — лише head) |
| Прайс | `/price` | всі |
| Профіль | `/profile` | всі |
| Сповіщення | `/alerts` | тільки `head` |

---

## Календар (FullCalendar)

### Конфігурація
```ts
plugins: [timeGridPlugin, interactionPlugin]
initialView: "timeGridDay"
initialDate: selectedDate
slotMinTime: "08:00:00"   // з HOUR_START
slotMaxTime: "20:00:00"   // з HOUR_END
slotDuration: "00:15:00"
allDaySlot: false
locale: "uk"
height: "100%"
nowIndicator: true
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

`eventContent` рендериться кастомно: короткі (<45 хв) і довгі записи мають різний
лейаут; сума (₴) показується лише якщо `canSeeAppointmentPrices`.

### Handlers
- `eventClick` → відкриває `AppointmentDetails` sheet
- `dateClick` → відкриває `AppointmentForm` з pre-filled датою і часом
- FullCalendar автоматично вирішує проблему перетинів подій (розміщує їх поруч колонками)

### Масштаб і навігація
- **Pinch-to-zoom** (як у Google Calendar): двопальцевий жест на сітці змінює
  висоту слота 15 хв (24–96px) через CSS-змінну `--fc-slot-height`. Реалізовано
  в `CalendarView.tsx` (touch-обробники, `passive:false` щоб блокувати скрол).
  Висота слота читається в `globals.css`: `var(--fc-slot-height, 40px)`.
- **Date picker:** іконка календаря в хедері відкриває нативний `<input type="date">`
  (`showPicker()`); значення парситься як локальна дата (без UTC-зсуву).
- **Сьогодні** і вибір дня у WeekStrip — через спільний `goToDate()`.

> Висота контейнера календаря на мобільному рахується від спільних змінних
> `--bottom-nav-h` / `--bottom-nav-total` (`globals.css`), щоб сітка доходила
> рівно до нижнього меню без зазору. Не дублюй «48px» вручну.

---

## WeekStrip

- Показує 14 днів: 3 до вибраної дати + вибрана + 10 після
- % зайнятості дня = зайняті хвилини ÷ повний робочий день (`HOUR_START`–`HOUR_END`,
  ті самі години, що й сітка). Час за межами дня обрізається; порожній день → 0%.
  (Логіка в `pctForDate`, `WeekStrip.tsx`.)
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
| comment | textarea | — |

`end_time` розраховується: `start + duration` (тривалості — у `DURATIONS`, `lib/constants.ts`).

> **Статусів більше немає.** Поле `status` прибрано з БД, типу `Appointment`,
> форми й деталей. Не повертай його без явного запиту.

Ціну (`price`) при створенні може вписати будь-хто (`canEditPrice`), але
переглядати суми згодом асистенти не можуть (`canSeeAppointmentPrices`).

---

## Клієнти

- Унікальні клієнти витягуються з `appointments` (групування по `client + phone`)
- Для кожного клієнта: ініціали-аватар, ім'я, список тварин, остання послуга
- Inline пошук по імені, кличці тварини, телефону (фільтрація без запиту до БД)
- Кнопка "Подзвонити" → `href="tel:..."`

---

## Сповіщення

- Публікувати/видаляти може тільки `head`
- Форма публікації нового повідомлення (textarea + кнопка)
- Список опублікованих повідомлень з датою
- Кнопка "Видалити" для кожного повідомлення
- Badge з кількістю непрочитаних на іконці вкладки
- "Непрочитані" = `created_at > localStorage("notices_last_seen")`
- При відкритті вкладки — оновлює `notices_last_seen` і скидає badge

---

## Auth flow

Guard реалізовано в `(app)/layout.tsx` (`getSession()` + `onAuthStateChange`);
поки сесія завантажується — показується анімований logo-splash.

```
Відкриття додатку
  → (app)/layout: getSession() + підписка onAuthStateChange
  → якщо немає сесії → router.replace("/login")
  → якщо є сесія → setUser + рендер app

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

Tailwind **v4** — JS-конфіга немає. Токени оголошуються як CSS-змінні в
`src/app/globals.css` (`@theme` / `:root`) і використовуються через
`var(--teal)`, `var(--line)`, `var(--paper)`, `var(--ink)`, `var(--muted-col)` тощо.
Щоб додати/змінити колір — редагуй `globals.css`, а не файл конфіга.

---

## Сторінка Профіль (`/profile`)

Реалізована (не заглушка). Показує:
- блок користувача — аватар з ініціалами, ім'я лікаря (`doctorForEmail`), email, роль (`roleLabel`);
- персональну статистику з `appointments` (фільтр по `currentDoctor`);
- зміну пароля через `supabase.auth.updateUser({ password })`;
- вихід — `supabase.auth.signOut()` → `router.replace("/login")`.

Дані беруться з `useCalendarContext()` (`src/context/calendar.tsx`), не з layout.

---

## Правила для агентів

1. **Не міняти DOCTORS масив** — порядок елементів визначає кольори. Якщо додати нового лікаря — додавати тільки в кінець і додавати відповідний колір у DOCTOR_COLORS.

2. **Supabase ANON ключ** — публічний anon ключ, не секрет. RLS захищає дані на рівні БД.

3. **Ролі — через `DOCTOR_ACCESS`** (email → роль/лікар) у `lib/doctors.ts`. Перевіряти доступ helper'ами (`roleForEmail`, `canSee*`), а не звіркою email вручну. `HEAD_DOCTOR_EMAIL` більше не існує. Тримати в синхроні з RLS.

4. **Realtime** — підписка в `useAppointments` hook. При будь-якій зміні просто перезавантажує всі appointments (не патчить масив). Це простіше і надійніше для малого обсягу даних.

5. **CalendarView** — рендериться лише через `dynamic(() => import(...), { ssr: false })` в `calendar/page.tsx`, бо FullCalendar не підтримує SSR. Не імпортувати напряму.

6. **Типи дат** — в БД `date` зберігається як `"YYYY-MM-DD"`, `start_time`/`end_time` як `"HH:MM:SS"`. В app використовуємо `"HH:MM"` (slice(0,5)).

7. **price** — показується на тікетах, у деталях і в аналітиці, але лише за доступом (`canSeeAppointmentPrices` / `canSeePrices`). Асистенти суми не бачать.

8. **Міграція БД** — якщо потрібно додати поле до `appointments`, виконати в Supabase SQL Editor:
   ```sql
   ALTER TABLE appointments ADD COLUMN IF NOT EXISTS <field> <type>;
   ```

9. **shadcn/ui компоненти** — додавати через `npx shadcn@latest add <component>`, не копіювати вручну.

10. **"use client"** — обов'язковий для компонентів що використовують hooks, event handlers, або browser API. Всі сторінки в `(app)/` є client components через CalendarContext.

11. **Next.js 16** — перед написанням серверного коду читай `node_modules/next/dist/docs/`. `params`/`searchParams`/`cookies`/`headers` лише async; middleware → `proxy.ts`; без кастомного webpack-конфіга (Turbopack за замовчуванням). Деталі — у блоці ⚠️ під «Стек».
