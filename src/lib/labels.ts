import type { WeaponGrade, WeaponType } from "@/types/game";

const GRADE_KO: Record<WeaponGrade, string> = {
  D: "D",
  C: "C",
  B: "B",
  A: "A",
  S: "S",
  SS: "SS",
};

const TYPE_KO: Record<WeaponType, string> = {
  sword: "검",
  greatsword: "대검",
  dagger: "단검",
  spear: "창",
  axe: "도끼",
  hammer: "망치",
  bow: "활",
  staff: "지팡이",
};

export function gradeLabel(g: WeaponGrade): string {
  return GRADE_KO[g] ?? g;
}

export function weaponTypeLabel(t: WeaponType): string {
  return TYPE_KO[t] ?? t;
}
