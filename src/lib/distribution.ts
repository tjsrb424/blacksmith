import {
  PLATFORM,
  isCrazyGamesPlatform,
  isTossPlatform,
  isWebPlatform,
  type Platform,
} from "@/lib/platform";

export type Distribution = Platform;

export function getDistribution(): Distribution {
  return PLATFORM;
}

export function isCrazyGamesBuild() {
  return isCrazyGamesPlatform;
}

export function isTossBuild() {
  return isTossPlatform;
}

export function isWebBuild() {
  return isWebPlatform;
}
