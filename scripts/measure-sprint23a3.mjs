import fs from "node:fs";
import path from "node:path";
import { createBrowserClient } from "@supabase/ssr";
import { createClient } from "@supabase/supabase-js";

const ROOT = process.cwd();
const DEFAULT_COUNTS = {
  bootstrap: 2,
  playerMe: 2,
  rankingWeekly: 2,
  rankingWorld: 2,
  enhance: 5,
  buy: 5,
  sell: 5,
  forgeCollect: 5,
  forgeUpgrade: 3,
};

function loadDotEnvLocal() {
  const file = path.join(ROOT, ".env.local");
  if (!fs.existsSync(file)) return;

  const text = fs.readFileSync(file, "utf8");
  for (const rawLine of text.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) continue;
    const index = line.indexOf("=");
    if (index <= 0) continue;
    const key = line.slice(0, index).trim();
    if (process.env[key] !== undefined) continue;
    let value = line.slice(index + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    process.env[key] = value;
  }
}

function requireEnv(name) {
  const value = process.env[name];
  if (!value) throw new Error(`${name} is required.`);
  return value;
}

function parseCount(name) {
  return Number(process.env[`PERF_TEST_${name.toUpperCase()}_COUNT`] ?? DEFAULT_COUNTS[name]);
}

function actionMeta(prefix) {
  return {
    actionId: `${prefix}-${crypto.randomUUID()}`,
    clientCreatedAt: new Date().toISOString(),
  };
}

function parseServerTiming(header) {
  if (!header) return { entries: {}, totalMs: null, summary: "" };

  const entries = {};
  for (const rawEntry of header.split(",")) {
    const parts = rawEntry.trim().split(";").map((part) => part.trim());
    const name = parts[0];
    const durPart = parts.find((part) => part.startsWith("dur="));
    if (!name || !durPart) continue;
    const dur = Number(durPart.slice(4));
    if (Number.isFinite(dur)) entries[name] = dur;
  }

  const pairs = Object.entries(entries);
  const totalPair =
    pairs.find(([name]) => name.toLowerCase().endsWith("total")) ??
    pairs[pairs.length - 1];

  return {
    entries,
    totalMs: totalPair ? totalPair[1] : null,
    summary: pairs.map(([name, dur]) => `${name}=${dur}ms`).join(" "),
  };
}

function percentile(sorted, ratio) {
  return sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * ratio))];
}

function summarize(samples) {
  const client = samples.map((sample) => sample.clientElapsedMs).sort((a, b) => a - b);
  const server = samples
    .map((sample) => sample.serverTimingTotalMs)
    .filter((value) => value != null)
    .sort((a, b) => a - b);
  const gap = samples
    .map((sample) => sample.unexplainedGapMs)
    .filter((value) => value != null)
    .sort((a, b) => a - b);

  return {
    count: samples.length,
    clientAvg: Math.round(client.reduce((sum, value) => sum + value, 0) / client.length),
    clientP50: percentile(client, 0.5),
    clientP95: percentile(client, 0.95),
    clientMax: client[client.length - 1],
    serverAvg:
      server.length > 0
        ? Math.round(server.reduce((sum, value) => sum + value, 0) / server.length)
        : null,
    serverP50: server.length > 0 ? percentile(server, 0.5) : null,
    serverP95: server.length > 0 ? percentile(server, 0.95) : null,
    serverMax: server.length > 0 ? server[server.length - 1] : null,
    gapAvg:
      gap.length > 0
        ? Math.round(gap.reduce((sum, value) => sum + value, 0) / gap.length)
        : null,
    gapP50: gap.length > 0 ? percentile(gap, 0.5) : null,
  };
}

function markdownTable(rows) {
  const header =
    "| action | n | client avg | client p50 | client p95 | client max | Server-Timing avg | Server-Timing p50 | Server-Timing p95 | Server-Timing max | gap avg | gap p50 |\n" +
    "| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |";
  const body = rows
    .map((row) => {
      const s = summarize(row.samples);
      return `| ${row.name} | ${s.count} | ${s.clientAvg}ms | ${s.clientP50}ms | ${s.clientP95}ms | ${s.clientMax}ms | ${s.serverAvg ?? "-"}ms | ${s.serverP50 ?? "-"}ms | ${s.serverP95 ?? "-"}ms | ${s.serverMax ?? "-"}ms | ${s.gapAvg ?? "-"}ms | ${s.gapP50 ?? "-"}ms |`;
    })
    .join("\n");
  return `${header}\n${body}`;
}

function markdownBreakdowns(rows) {
  return rows
    .map((row) => {
      const sample = row.samples[0];
      if (!sample) return `### ${row.name}\n\nNo samples.`;
      const entries = Object.entries(sample.serverTimingEntries)
        .map(([name, dur]) => `- ${name}: ${dur}ms`)
        .join("\n");
      return `### ${row.name} #1\n\n- client elapsed: ${sample.clientElapsedMs}ms\n- network duration: ${sample.networkDurationMs}ms\n- Server-Timing total: ${sample.serverTimingTotalMs ?? "-"}ms\n- unexplained gap: ${sample.unexplainedGapMs ?? "-"}ms\n\n${entries || "- Server-Timing missing"}`;
    })
    .join("\n\n");
}

async function createSessionCookie({ url, anonKey, email, password }) {
  const jar = new Map();
  const client = createBrowserClient(url, anonKey, {
    isSingleton: false,
    cookies: {
      getAll() {
        return Array.from(jar.entries()).map(([name, value]) => ({ name, value }));
      },
      setAll(cookiesToSet) {
        for (const cookie of cookiesToSet) {
          if (cookie.options?.maxAge === 0 || cookie.value === "") {
            jar.delete(cookie.name);
          } else {
            jar.set(cookie.name, cookie.value);
          }
        }
      },
    },
  });

  const { error } = await client.auth.signInWithPassword({ email, password });
  if (error) throw error;

  const cookie = Array.from(jar.entries())
    .map(([name, value]) => `${name}=${value}`)
    .join("; ");
  if (!cookie) throw new Error("Supabase sign-in did not produce auth cookies.");
  return cookie;
}

async function createDisposableUser(admin) {
  const email = `codex-perf-${Date.now()}-${crypto.randomUUID().slice(0, 8)}@example.test`;
  const password = `CodexPerf-${crypto.randomUUID()}-aA1!`;
  const { data, error } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { nickname: "Codex Perf" },
  });
  if (error) throw error;
  if (!data.user) throw new Error("Supabase did not return a created user.");
  return { userId: data.user.id, email, password, disposable: true };
}

async function cleanupUser(admin, userId) {
  const tables = [
    "ad_reward_logs",
    "game_action_logs",
    "weekly_rankings",
    "world_records",
    "owned_weapons",
    "player_records",
    "player_states",
    "profiles",
  ];

  for (const table of tables) {
    const column = table === "profiles" ? "id" : "user_id";
    const { error } = await admin.from(table).delete().eq(column, userId);
    if (error) {
      console.warn(`cleanup ${table} failed: ${error.message}`);
    }
  }

  const { error } = await admin.auth.admin.deleteUser(userId);
  if (error) console.warn(`cleanup auth user failed: ${error.message}`);
}

async function setTestResources(admin, userId, patch = {}) {
  const old = new Date(Date.now() - 45 * 60 * 1000).toISOString();
  const { error } = await admin
    .from("player_states")
    .update({
      gold: 10_000_000,
      forge_ember: 10_000_000,
      transcend_stone: 1_000,
      forge_last_collected_at: old,
      ...patch,
    })
    .eq("user_id", userId);
  if (error) throw error;
}

async function resetWeapon(admin, weaponId) {
  const { error } = await admin
    .from("owned_weapons")
    .update({
      enhance_level: 0,
      transcend_level: 0,
      durability: 3,
      is_locked: false,
    })
    .eq("id", weaponId);
  if (error) throw error;
}

async function requestJson({ baseUrl, cookie, name, path: apiPath, init = {} }) {
  const startedAt = performance.now();
  const response = await fetch(`${baseUrl}${apiPath}`, {
    cache: "no-store",
    ...init,
    headers: {
      "content-type": "application/json",
      cookie,
      ...init.headers,
    },
  });
  const text = await response.text();
  const networkDurationMs = Math.round(performance.now() - startedAt);
  const serverTiming = parseServerTiming(response.headers.get("server-timing"));
  const serverTimingTotalMs = serverTiming.totalMs;
  const unexplainedGapMs =
    serverTimingTotalMs == null ? null : networkDurationMs - serverTimingTotalMs;

  let json = null;
  if (text) {
    try {
      json = JSON.parse(text);
    } catch {
      json = text;
    }
  }

  const sample = {
    name,
    status: response.status,
    ok: response.ok,
    clientElapsedMs: networkDurationMs,
    networkDurationMs,
    serverTimingTotalMs,
    serverTimingEntries: serverTiming.entries,
    unexplainedGapMs,
  };

  if (!response.ok) {
    throw new Error(
      `${name} failed ${response.status}: ${typeof json === "string" ? json.slice(0, 240) : JSON.stringify(json).slice(0, 240)}`,
    );
  }

  return { sample, json };
}

async function runCase(rows, name, count, fn) {
  const samples = [];
  for (let index = 0; index < count; index += 1) {
    const { sample } = await fn(index);
    samples.push(sample);
    console.log(
      `${name} #${index + 1}: client=${sample.clientElapsedMs}ms server=${sample.serverTimingTotalMs ?? "-"}ms gap=${sample.unexplainedGapMs ?? "-"}ms`,
    );
  }
  rows.push({ name, samples });
  return samples;
}

async function main() {
  loadDotEnvLocal();

  const baseUrl = process.env.PERF_TEST_BASE_URL ?? "http://localhost:3000";
  const label = process.env.PERF_TEST_LABEL ?? (new URL(baseUrl).port || "local");
  const cleanup = process.env.PERF_TEST_CLEANUP !== "false";
  const url = requireEnv("NEXT_PUBLIC_SUPABASE_URL");
  const anonKey =
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ??
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.SUPABASE_SECRET_KEY;
  if (!anonKey) throw new Error("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY is required.");
  if (!serviceKey) throw new Error("SUPABASE_SERVICE_ROLE_KEY is required.");

  const admin = createClient(url, serviceKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });

  const account = process.env.PERF_TEST_EMAIL && process.env.PERF_TEST_PASSWORD
    ? {
        email: process.env.PERF_TEST_EMAIL,
        password: process.env.PERF_TEST_PASSWORD,
        userId: process.env.PERF_TEST_USER_ID,
        disposable: false,
      }
    : await createDisposableUser(admin);

  let userId = account.userId;
  const rows = [];

  try {
    const cookie = await createSessionCookie({
      url,
      anonKey,
      email: account.email,
      password: account.password,
    });

    const warmup = await requestJson({
      baseUrl,
      cookie,
      name: "bootstrap warmup",
      path: "/api/player/bootstrap",
      init: { method: "POST" },
    });
    userId = warmup.json.userId ?? userId;
    await setTestResources(admin, userId);

    await runCase(rows, "player_bootstrap", parseCount("bootstrap"), () =>
      requestJson({
        baseUrl,
        cookie,
        name: "player_bootstrap",
        path: "/api/player/bootstrap",
        init: { method: "POST" },
      }),
    );

    let snapshot = (
      await requestJson({
        baseUrl,
        cookie,
        name: "player_me setup",
        path: "/api/player/me",
      })
    ).json;
    const seasonId = snapshot.currentSeason.seasonId;

    await runCase(rows, "player_me", parseCount("playerMe"), () =>
      requestJson({
        baseUrl,
        cookie,
        name: "player_me",
        path: "/api/player/me",
      }),
    );

    const enhanceWeaponId = snapshot.ownedWeapons[0]?.id;
    if (!enhanceWeaponId) throw new Error("No owned weapon for enhance test.");
    await resetWeapon(admin, enhanceWeaponId);
    await setTestResources(admin, userId);
    await runCase(rows, "enhance", parseCount("enhance"), () =>
      requestJson({
        baseUrl,
        cookie,
        name: "enhance",
        path: "/api/game/enhance",
        init: {
          method: "POST",
          body: JSON.stringify({
            ...actionMeta("perf-enhance"),
            weaponInstanceId: enhanceWeaponId,
          }),
        },
      }),
    );

    await setTestResources(admin, userId);
    const boughtIds = [];
    await runCase(rows, "buy", parseCount("buy"), async () => {
      const result = await requestJson({
        baseUrl,
        cookie,
        name: "buy",
        path: "/api/game/buy",
        init: {
          method: "POST",
          body: JSON.stringify({
            ...actionMeta("perf-buy"),
            weaponId: "w_trainee_blade",
          }),
        },
      });
      const boughtId = result.json.patch?.changedWeapon?.id;
      if (boughtId) boughtIds.push(boughtId);
      return result;
    });

    while (boughtIds.length < parseCount("sell")) {
      const setupBuy = await requestJson({
        baseUrl,
        cookie,
        name: "sell setup buy",
        path: "/api/game/buy",
        init: {
          method: "POST",
          body: JSON.stringify({
            ...actionMeta("perf-sell-setup-buy"),
            weaponId: "w_trainee_blade",
          }),
        },
      });
      const boughtId = setupBuy.json.patch?.changedWeapon?.id;
      if (!boughtId) throw new Error("Sell setup buy did not return changedWeapon.");
      boughtIds.push(boughtId);
    }

    await runCase(rows, "sell", parseCount("sell"), (index) =>
      requestJson({
        baseUrl,
        cookie,
        name: "sell",
        path: "/api/game/sell",
        init: {
          method: "POST",
          body: JSON.stringify({
            ...actionMeta("perf-sell"),
            weaponInstanceId: boughtIds[index],
            sellMode: "normal",
          }),
        },
      }),
    );

    await runCase(rows, "forge_collect", parseCount("forgeCollect"), async () => {
      await setTestResources(admin, userId, {
        forge_last_collected_at: new Date(Date.now() - 45 * 60 * 1000).toISOString(),
      });
      return requestJson({
        baseUrl,
        cookie,
        name: "forge_collect",
        path: "/api/game/forge/collect",
        init: {
          method: "POST",
          body: JSON.stringify({
            ...actionMeta("perf-forge-collect"),
            collectMode: "normal",
          }),
        },
      });
    });

    await setTestResources(admin, userId, { forge_level: 1 });
    await runCase(rows, "forge_upgrade", parseCount("forgeUpgrade"), () =>
      requestJson({
        baseUrl,
        cookie,
        name: "forge_upgrade",
        path: "/api/game/forge/upgrade",
        init: {
          method: "POST",
          body: JSON.stringify({
            ...actionMeta("perf-forge-upgrade"),
          }),
        },
      }),
    );

    await runCase(rows, "ranking_weekly", parseCount("rankingWeekly"), () =>
      requestJson({
        baseUrl,
        cookie,
        name: "ranking_weekly",
        path: `/api/ranking/weekly?seasonId=${encodeURIComponent(seasonId)}&category=weeklyStrongestWeapon`,
      }),
    );

    await runCase(rows, "ranking_world", parseCount("rankingWorld"), () =>
      requestJson({
        baseUrl,
        cookie,
        name: "ranking_world",
        path: "/api/ranking/world",
      }),
    );

    const sprintLabel =
      process.env.PERF_TEST_SPRINT_LABEL ??
      (process.env.npm_lifecycle_event === "perf:sprint23a3"
        ? "Sprint 23-A-3"
        : "Sprint 23-A-5");
    const report = [
      `# ${sprintLabel} Perf Measurement (${label})`,
      "",
      `- baseUrl: ${baseUrl}`,
      `- createdAt: ${new Date().toISOString()}`,
      `- ad provider env: ${process.env.NEXT_PUBLIC_AD_PROVIDER ?? "-"}`,
      `- display ad provider env: ${process.env.NEXT_PUBLIC_DISPLAY_AD_PROVIDER ?? "-"}`,
      `- side banner env: ${process.env.NEXT_PUBLIC_SIDE_BANNER_ADS_ENABLED ?? "-"}`,
      `- perf debug env: ${process.env.PERF_DEBUG_SERVER ?? "-"}`,
      "",
      "## Summary",
      "",
      markdownTable(rows),
      "",
      "## First Sample Breakdowns",
      "",
      markdownBreakdowns(rows),
      "",
    ].join("\n");

    fs.mkdirSync(path.join(ROOT, "logs"), { recursive: true });
    const stamp = new Date().toISOString().replace(/[:.]/g, "-");
    const slug = sprintLabel.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
    const baseName = `${slug || "sprint-perf"}-${label}-${stamp}`;
    const mdPath = path.join(ROOT, "logs", `${baseName}.md`);
    const jsonPath = path.join(ROOT, "logs", `${baseName}.json`);
    fs.writeFileSync(mdPath, report, "utf8");
    fs.writeFileSync(jsonPath, JSON.stringify({ label, baseUrl, rows }, null, 2), "utf8");

    console.log("");
    console.log(report);
    console.log(`Report written: ${mdPath}`);
    console.log(`JSON written: ${jsonPath}`);
  } finally {
    if (cleanup && account.disposable && userId) {
      await cleanupUser(admin, userId);
      console.log(`Cleaned up disposable user ${userId}`);
    }
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
