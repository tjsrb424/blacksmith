export type Distribution = "web" | "crazygames";

export function getDistribution(): Distribution {
  const value = (
    process.env.NEXT_PUBLIC_DISTRIBUTION ??
    process.env.NEXT_PUBLIC_PLATFORM ??
    ""
  ).toLowerCase();

  return value === "crazygames" ? "crazygames" : "web";
}

export function isCrazyGamesBuild() {
  return getDistribution() === "crazygames";
}
