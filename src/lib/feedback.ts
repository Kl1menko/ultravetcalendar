import { supabase } from "./supabase"
import { Feedback, FeedbackReply, FeedbackStatus, FeedbackType } from "@/types"
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
  const items = data as Feedback[]

  // Доливаємо кількість відповідей одним запитом (id всіх реплаїв), а не
  // count-на-кожен-тікет — список зазвичай короткий, тож це дешевше за N запитів.
  const { data: replyRows, error: replyErr } = await supabase
    .from("feedback_replies")
    .select("feedback_id")

  if (replyErr) {
    logAppError("fetchFeedback.replyCounts", replyErr)
    return items
  }

  const counts = new Map<string, number>()
  for (const r of (replyRows as { feedback_id: string }[]) ?? []) {
    counts.set(r.feedback_id, (counts.get(r.feedback_id) ?? 0) + 1)
  }
  return items.map((f) => ({ ...f, reply_count: counts.get(f.id) ?? 0 }))
}

export async function fetchReplies(feedbackId: string): Promise<FeedbackReply[]> {
  const { data, error } = await supabase
    .from("feedback_replies")
    .select("*")
    .eq("feedback_id", feedbackId)
    .order("created_at", { ascending: true })

  if (error) {
    logAppError("fetchReplies", error)
    return []
  }
  return data as FeedbackReply[]
}

export async function createReply(input: {
  feedbackId: string
  body: string
  authorName: string
}): Promise<{ error: Error | null }> {
  const { error } = await supabase.from("feedback_replies").insert({
    feedback_id: input.feedbackId,
    body: input.body,
    author_name: input.authorName || null,
  })
  if (error) logAppError("createReply", error)
  return { error: error ? new Error(error.message) : null }
}

export async function deleteReply(id: string): Promise<{ error: Error | null }> {
  const { error } = await supabase.from("feedback_replies").delete().eq("id", id)
  if (error) logAppError("deleteReply", error)
  return { error: error ? new Error(error.message) : null }
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
