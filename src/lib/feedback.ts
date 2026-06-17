import { supabase } from "./supabase"
import { Feedback, FeedbackStatus, FeedbackType } from "@/types"
import { logAppError } from "./error-log"

export async function fetchFeedback(): Promise<Feedback[]> {
  const { data, error } = await supabase
    .from("feedback")
    .select("*")
    .order("created_at", { ascending: false })

  if (error) {
    logAppError("fetchFeedback", error)
    return []
  }
  return data as Feedback[]
}

export async function createFeedback(input: {
  type: FeedbackType
  title: string
  body: string
  authorName: string
}): Promise<{ error: Error | null }> {
  const { error } = await supabase.from("feedback").insert({
    type: input.type,
    title: input.title,
    body: input.body || null,
    author_name: input.authorName || null,
  })
  if (error) logAppError("createFeedback", error)
  return { error: error ? new Error(error.message) : null }
}

// Зміна статусу — дозволено лише admin (контроль на рівні RLS).
export async function updateFeedbackStatus(
  id: string,
  status: FeedbackStatus
): Promise<{ error: Error | null }> {
  const { error } = await supabase.from("feedback").update({ status }).eq("id", id)
  if (error) logAppError("updateFeedbackStatus", error)
  return { error: error ? new Error(error.message) : null }
}

export async function deleteFeedback(id: string): Promise<{ error: Error | null }> {
  const { error } = await supabase.from("feedback").delete().eq("id", id)
  if (error) logAppError("deleteFeedback", error)
  return { error: error ? new Error(error.message) : null }
}
