import "server-only";

import { randomInt } from "node:crypto";

const SCALE = 1_000_000;

export function serverRandomUnit(): number {
  return randomInt(0, SCALE) / SCALE;
}

export function rollServerChance(rate: number): boolean {
  const clamped = Math.max(0, Math.min(1, rate));
  return randomInt(0, SCALE) < Math.floor(clamped * SCALE);
}
