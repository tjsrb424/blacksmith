import { cn } from "@/lib/cn";

export function DurabilityIcons({
  value,
  max = 3,
  emphasizeCritical,
}: {
  value: number;
  max?: number;
  /** 내구도 1일 때 마지막 칸 위험 강조 */
  emphasizeCritical?: boolean;
}) {
  const filled = Math.max(0, Math.min(max, value));
  const critical = emphasizeCritical && filled === 1;
  return (
    <div className="flex gap-1" aria-label={`내구도 ${filled}`}>
      {Array.from({ length: max }).map((_, i) => (
        <span
          key={i}
          className={cn(
            "h-2.5 w-4 rounded-sm ring-1 transition-colors",
            i < filled
              ? critical && i === 0
                ? "animate-pulse bg-gradient-to-b from-red-400 to-red-900 ring-red-400/70 motion-reduce:animate-none"
                : "bg-gradient-to-b from-amber-400 to-orange-700 ring-amber-300/50"
              : "bg-zinc-800 ring-zinc-600/40",
          )}
        />
      ))}
    </div>
  );
}
