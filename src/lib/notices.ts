import { supabase } from "./supabase"
import { Notice } from "@/types"

export async function fetchNotices(): Promise<Notice[]> {
  const { data, error } = await supabase
    .from("notices")
    .select("*")
    .order("created_at", { ascending: false })

  if (error) {
    console.error("fetchNotices error:", error)
    return []
  }
  return data as Notice[]
}

export async function createNotice(
  text: string,
  createdBy: string
): Promise<{ error: Error | null }> {
  const { error } = await supabase
    .from("notices")
    .insert({ text, created_by: createdBy })
  return { error: error ? new Error(error.message) : null }
}

export async function deleteNotice(id: string): Promise<{ error: Error | null }> {
  const { error } = await supabase.from("notices").delete().eq("id", id)
  return { error: error ? new Error(error.message) : null }
}
