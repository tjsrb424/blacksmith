/** 로컬 시간 기준 — 시즌은 매주 월요일 00:00 시작, ISO 주차 ID (예: 2026-W19) */

export type SeasonInfo = {
  seasonId: string;
  startsAt: number;
  endsAt: number;
  now: number;
  remainingMs: number;
};

/** 해당 날짜가 속한 ISO 주의 월요일 00:00 (로컬) */
export function getSeasonStartAt(nowMs: number = Date.now()): number {
  const d = new Date(nowMs);
  d.setHours(0, 0, 0, 0);
  const day = d.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  d.setDate(d.getDate() + diff);
  return d.getTime();
}

export function getSeasonEndAt(nowMs: number = Date.now()): number {
  return getSeasonStartAt(nowMs) + 7 * 24 * 60 * 60 * 1000;
}

/**
 * ISO 8601 주차 문자열 (UTC 기준 ISO 년·주와 로컬 월요일 경계가 어긋날 수 있으나 MVP 표기용)
 */
export function getCurrentWeekSeasonId(nowMs: number = Date.now()): string {
  const d = new Date(nowMs);
  const copy = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  copy.setHours(0, 0, 0, 0);
  copy.setDate(copy.getDate() + 3 - ((copy.getDay() + 6) % 7));
  const isoYear = copy.getFullYear();
  const week1Jan4 = new Date(isoYear, 0, 4);
  const week =
    1 +
    Math.round(
      ((copy.getTime() - week1Jan4.getTime()) / 86400000 -
        3 +
        ((week1Jan4.getDay() + 6) % 7)) /
        7,
    );
  return `${isoYear}-W${String(Math.max(1, week)).padStart(2, "0")}`;
}

export function getTimeUntilSeasonEnd(nowMs: number = Date.now()): number {
  const end = getSeasonEndAt(nowMs);
  return Math.max(0, end - nowMs);
}

export function formatSeasonCountdown(remainingMs: number): string {
  const totalSec = Math.floor(remainingMs / 1000);
  const d = Math.floor(totalSec / 86400);
  const h = Math.floor((totalSec % 86400) / 3600);
  const m = Math.floor((totalSec % 3600) / 60);
  const parts: string[] = [];
  if (d > 0) parts.push(`${d}일`);
  parts.push(`${h}시간`);
  parts.push(`${m}분`);
  return parts.join(" ");
}

export function getCurrentSeasonInfo(nowMs: number = Date.now()): SeasonInfo {
  const startsAt = getSeasonStartAt(nowMs);
  const endsAt = getSeasonEndAt(nowMs);
  const seasonId = getCurrentWeekSeasonId(nowMs);
  return {
    seasonId,
    startsAt,
    endsAt,
    now: nowMs,
    remainingMs: getTimeUntilSeasonEnd(nowMs),
  };
}
