const baseUrl = process.env.PERF_TEST_BASE_URL ?? "http://localhost:3000";
const cookie = process.env.PERF_TEST_COOKIE ?? "";
const iterations = Number(process.env.PERF_TEST_ITERATIONS ?? 20);
const confirmMutations = process.env.PERF_TEST_CONFIRM_MUTATIONS === "true";

const seasonId = process.env.PERF_TEST_RANKING_SEASON_ID ?? "";
const weaponInstanceId = process.env.PERF_TEST_WEAPON_INSTANCE_ID ?? "";

function headers() {
  return {
    "content-type": "application/json",
    ...(cookie ? { cookie } : {}),
  };
}

function actionMeta(prefix) {
  return {
    actionId: `${prefix}-${crypto.randomUUID()}`,
    clientCreatedAt: new Date().toISOString(),
  };
}

async function timed(name, request) {
  const startedAt = performance.now();
  const response = await request();
  const elapsedMs = Math.round(performance.now() - startedAt);
  if (!response.ok) {
    const text = await response.text().catch(() => "");
    throw new Error(`${name} failed ${response.status}: ${text.slice(0, 240)}`);
  }
  await response.arrayBuffer();
  return elapsedMs;
}

async function runCase(name, requestFactory) {
  const samples = [];
  for (let i = 0; i < iterations; i += 1) {
    samples.push(await timed(name, requestFactory));
  }
  samples.sort((a, b) => a - b);
  const pick = (p) => samples[Math.min(samples.length - 1, Math.floor(samples.length * p))];
  console.log(
    `${name}: count=${samples.length} min=${samples[0]}ms p50=${pick(0.5)}ms p95=${pick(0.95)}ms max=${samples[samples.length - 1]}ms`,
  );
}

async function main() {
  if (!cookie) {
    console.warn("PERF_TEST_COOKIE is empty. Authenticated beta endpoints will likely return 401.");
  }

  if (seasonId) {
    await runCase("ranking weekly", () =>
      fetch(
        `${baseUrl}/api/ranking/weekly?seasonId=${encodeURIComponent(
          seasonId,
        )}&category=weeklyStrongestWeapon`,
        { headers: headers() },
      ),
    );
  } else {
    console.warn("Skip ranking weekly: set PERF_TEST_RANKING_SEASON_ID.");
  }

  await runCase("ranking world", () =>
    fetch(`${baseUrl}/api/ranking/world`, { headers: headers() }),
  );

  if (!confirmMutations) {
    console.warn(
      "Skip mutation tests. Set PERF_TEST_CONFIRM_MUTATIONS=true only against a disposable local/staging account.",
    );
    return;
  }

  if (weaponInstanceId) {
    await runCase("enhance", () =>
      fetch(`${baseUrl}/api/game/enhance`, {
        method: "POST",
        headers: headers(),
        body: JSON.stringify({
          ...actionMeta("perf-enhance"),
          weaponInstanceId,
        }),
      }),
    );
  } else {
    console.warn("Skip enhance: set PERF_TEST_WEAPON_INSTANCE_ID.");
  }

  await runCase("forge collect", () =>
    fetch(`${baseUrl}/api/game/forge/collect`, {
      method: "POST",
      headers: headers(),
      body: JSON.stringify({
        ...actionMeta("perf-forge-collect"),
        collectMode: "normal",
      }),
    }),
  );
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
