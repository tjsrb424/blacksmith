import "server-only";

import type { NextResponse } from "next/server";
import type { ServerGameActionResponse } from "@/types/server";

export function attachMutationDebugHeaders(
  response: NextResponse,
  result: ServerGameActionResponse,
) {
  const debug = result.debug;
  if (!debug) return response;
  response.headers.set("X-Blacksmith-Mutation-Path", debug.mutationPath);
  response.headers.set("X-Blacksmith-Rpc-Name", debug.rpcName);
  response.headers.set("X-Blacksmith-Rpc-Applied", String(debug.rpcApplied));
  response.headers.set(
    "X-Blacksmith-Rpc-Fallback-Allowed",
    String(debug.fallbackAllowed),
  );
  return response;
}
