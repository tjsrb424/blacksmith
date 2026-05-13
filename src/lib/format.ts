export function formatInt(n: number): string {
  return Math.round(n).toLocaleString("ko-KR");
}

export function formatCompactKoreanNumber(value: number): string {
  if (!Number.isFinite(value)) return "0";

  const safeValue = Math.max(0, Math.floor(value));
  if (safeValue < 1_000_000) {
    return safeValue.toLocaleString("ko-KR");
  }

  const man = safeValue / 10_000;
  if (man >= 1000) {
    return `${Math.round(man).toLocaleString("ko-KR")}만`;
  }

  const rounded = Math.round(man * 10) / 10;
  return `${Number.isInteger(rounded) ? rounded.toFixed(0) : rounded.toFixed(1)}만`;
}

export function formatGold(n: number): string {
  return `${formatInt(n)}G`;
}

export function formatPercent(rate: number): string {
  return `${Math.round(rate * 1000) / 10}%`;
}
