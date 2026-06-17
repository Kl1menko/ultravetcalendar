import { supabase } from "./supabase"
import { Notice } from "@/types"
import { logAppError } from "./error-log"

export async function fetchNotices(): Promise<Notice[]> {
  const { data, error } = await supabase
    .from("notices")
    .select("*")
    .order("created_at", { ascending: false })

  if (error) {
    logAppError("fetchNotices", error)
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
  if (error) logAppError("createNotice", error)
  return { error: error ? new Error(error.message) : null }
}

export async function deleteNotice(id: string): Promise<{ error: Error | null }> {
  const { error } = await supabase.from("notices").delete().eq("id", id)
  if (error) logAppError("deleteNotice", error)
  return { error: error ? new Error(error.message) : null }
}
