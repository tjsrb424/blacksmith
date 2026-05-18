"use client";

import {
  createContext,
  useContext,
  type ReactNode,
} from "react";
import { isCrazyGamesBuild } from "@/lib/distribution";

const DistributionContext = createContext(isCrazyGamesBuild());

export function DistributionProvider({
  children,
  isCrazyGamesMode,
}: {
  children: ReactNode;
  isCrazyGamesMode: boolean;
}) {
  return (
    <DistributionContext.Provider value={isCrazyGamesMode}>
      {children}
    </DistributionContext.Provider>
  );
}

export function useIsCrazyGamesMode() {
  return useContext(DistributionContext);
}
