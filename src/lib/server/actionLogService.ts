import "server-only";

import { getSupabaseAdminClient } from "@/lib/supabase/admin";
import type { ServerGameActionResponse } from "@/types/server";
import type { Json } from "@/types/supabase";

type BeginActionResult =
  | { status: "created" }
  | { status: "replayed"; response: ServerGameActionResponse }
  | { status: "conflict"; message: string };

function toJson(value: unknown): Json {
  return JSON.parse(JSON.stringify(value)) as Json;
}

function isServerActionResponse(value: unknown): value is ServerGameActionResponse {
  return Boolean(
      value &&
      typeof value === "object" &&
      "actionId" in value &&
      ("snapshot" in value || "patch" in value),
  );
}

export async function beginActionLog(args: {
  userId: string;
  actionType: string;
  actionId: string;
  payload: unknown;
}): Promise<BeginActionResult> {
  const actionId = args.actionId.trim();
  if (!actionId) return { status: "conflict", message: "Missing actionId" };

  const admin = getSupabaseAdminClient();
  const { data: existing, error: selectError } = await admin
    .from("game_action_logs")
    .select("user_id, result")
    .eq("action_id", actionId)
    .maybeSingle();

  if (selectError) throw selectError;

  if (existing) {
    if (existing.user_id !== args.userId) {
      return { status: "conflict", message: "actionId already belongs to another user" };
    }
    if (isServerActionResponse(existing.result)) {
      return {
        status: "replayed",
        response: {
          ...existing.result,
          status: "replayed",
        },
      };
    }
    return { status: "conflict", message: "actionId is already in progress" };
  }

  const { error: insertError } = await admin.from("game_action_logs").insert({
    user_id: args.userId,
    action_type: args.actionType,
    action_id: actionId,
    payload: toJson(args.payload),
    result: { status: "pending" },
  });

  if (insertError) {
    if (insertError.code === "23505") {
      return beginActionLog(args);
    }
    throw insertError;
  }

  return { status: "created" };
}

export async function finishActionLog(args: {
  actionId: string;
  response: ServerGameActionResponse;
}): Promise<void> {
  const admin = getSupabaseAdminClient();
  const { error } = await admin
    .from("game_action_logs")
    .update({ result: toJson(args.response) })
    .eq("action_id", args.actionId);

  if (error) throw error;
}
