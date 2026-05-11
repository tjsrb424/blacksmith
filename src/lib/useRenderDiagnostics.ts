"use client";

import { useEffect } from "react";
import { recordRender } from "@/lib/performanceMetrics";

export function useRenderDiagnostics(component: string) {
  useEffect(() => {
    recordRender(component);
  });
}
