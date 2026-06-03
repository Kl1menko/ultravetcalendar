import { createClient } from "@supabase/supabase-js"
import { SUPABASE_URL, SUPABASE_ANON } from "./constants"

// Якщо env не задані (напр. на етапі prerender без рантайм-env) — підставляємо
// валідний плейсхолдер-URL, щоб createClient не кинув і збірка пройшла.
// Реальні запити в рантаймі без правильних env повернуть зрозумілу помилку.
const url = SUPABASE_URL || "https://placeholder.supabase.co"
const key = SUPABASE_ANON || "placeholder-anon-key"

export const supabase = createClient(url, key)
