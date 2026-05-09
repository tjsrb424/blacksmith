export function formatInt(n: number): string {
  return Math.round(n).toLocaleString("ko-KR");
}

export function formatGold(n: number): string {
  return `${formatInt(n)}G`;
}

export function formatPercent(rate: number): string {
  return `${Math.round(rate * 1000) / 10}%`;
}
