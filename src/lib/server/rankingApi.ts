import { requestJson } from "@/lib/server/http";
import type {
  PlayerRecordResponse,
  RankingCandidateSubmitPayload,
  RankingSubmissionResponse,
  WeeklyRankingRequest,
  WeeklyRankingResponse,
  WorldRecordsResponse,
} from "@/types/server";

export async function getWeeklyRanking(
  request: WeeklyRankingRequest,
): Promise<WeeklyRankingResponse> {
  const params = new URLSearchParams({
    category: request.category,
    seasonId: request.seasonId,
  });
  if (request.playerId) params.set("playerId", request.playerId);
  return requestJson<WeeklyRankingResponse>(`/api/ranking/weekly?${params}`);
}

export async function getWorldRecords(
  playerId?: string,
): Promise<WorldRecordsResponse> {
  const params = new URLSearchParams();
  if (playerId) params.set("playerId", playerId);
  const suffix = params.size > 0 ? `?${params}` : "";
  return requestJson<WorldRecordsResponse>(`/api/ranking/world${suffix}`);
}

export async function getPlayerRecord(
  playerId: string,
  seasonId: string,
): Promise<PlayerRecordResponse> {
  const params = new URLSearchParams({ playerId, seasonId });
  return requestJson<PlayerRecordResponse>(`/api/player/me?${params}`);
}

export async function submitRankingCandidate(
  payload: RankingCandidateSubmitPayload,
): Promise<RankingSubmissionResponse> {
  return requestJson<RankingSubmissionResponse>("/api/ranking/submit", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}
