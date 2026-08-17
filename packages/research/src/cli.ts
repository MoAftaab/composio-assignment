import "dotenv/config";
import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import pLimit from "p-limit";
import {
  AppRecordSchema,
  DatasetSchema,
  appSeeds,
  assertSummaryInvariant,
  createPendingAudit,
  createUnresearchedRecord,
  summarize,
  type AppRecord
} from "@atlas/shared";
import { researchApp, researchModel } from "./agent";
import { CallBudget } from "./budget";
import { recordsToCsv } from "./csv";
import { acquireRunLock, loadRecord, publishDataset, readJson, runDirectory, saveRecord, workspaceRoot, writeJsonAtomic } from "./storage";
import { verifyRecord } from "./verifier";

const [, , command = "help", ...args] = process.argv;

function option(name: string): string | undefined {
  const index = args.indexOf(name);
  return index >= 0 ? args[index + 1] : undefined;
}

function defaultRunId(): string {
  return new Date().toISOString().replace(/[:.]/g, "-");
}

function validateSeed(): void {
  if (appSeeds.length !== 100) throw new Error(`Seed must contain exactly 100 apps; received ${appSeeds.length}.`);
  if (new Set(appSeeds.map((item) => item.id)).size !== 100) throw new Error("Seed contains duplicate IDs.");
  if (new Set(appSeeds.map((item) => item.slug)).size !== 100) throw new Error("Seed contains duplicate slugs.");
}

function failedRecord(seed: (typeof appSeeds)[number], error: unknown, model: string): AppRecord {
  const base = createUnresearchedRecord(seed);
  return AppRecordSchema.parse({
    ...base,
    researchModel: model,
    researchStatus: "failed",
    verification: { ...base.verification, issues: [error instanceof Error ? error.message : "Unknown research failure."] },
    researchedAt: new Date().toISOString()
  });
}

async function research(): Promise<void> {
  validateSeed();
  if (!process.env.OPENAI_API_KEY) throw new Error("OPENAI_API_KEY is required for research. Copy .env.example to .env and set the key; the static case study can build without it.");
  const runId = option("--run") ?? defaultRunId();
  const model = researchModel();
  const requestedApp = option("--app");
  const seeds = requestedApp
    ? appSeeds.filter((seed) => seed.slug === requestedApp.toLowerCase() || seed.name.toLowerCase() === requestedApp.toLowerCase())
    : appSeeds;
  if (!seeds.length) throw new Error(`No seed app matched “${requestedApp}”.`);

  const release = await acquireRunLock(runId);
  const previousManifest = await readJson<{ budget?: { used?: number } }>(path.join(runDirectory(runId), "manifest.json"));
  const previousCalls = previousManifest?.budget?.used ?? 0;
  const budget = new CallBudget(Number(process.env.ATLAS_MAX_MODEL_CALLS ?? 140), previousCalls);
  const limit = pLimit(Number(process.env.ATLAS_CONCURRENCY ?? 3));
  try {
    const records = await Promise.all(seeds.map((seed) => limit(async () => {
      const existing = await loadRecord(runId, "baseline", seed.id, seed.slug);
      // Successful checkpoints are immutable and resumable. Failed checkpoints
      // are deliberately retried after the operator fixes a transient issue.
      if (existing && existing.researchStatus !== "failed") return AppRecordSchema.parse(existing);
      try {
        const record = await researchApp(seed, { budget });
        await saveRecord(runId, "baseline", record);
        process.stdout.write(`researched ${seed.id}/100 ${seed.name}\n`);
        return record;
      } catch (error) {
        const record = failedRecord(seed, error, model);
        await saveRecord(runId, "baseline", record);
        process.stderr.write(`failed ${seed.id}/100 ${seed.name}: ${record.verification.issues[0]}\n`);
        return record;
      }
    })));

    await writeJsonAtomic(path.join(runDirectory(runId), "manifest.json"), {
      runId,
      model,
      createdAt: new Date().toISOString(),
      appCount: requestedApp ? Math.max(previousManifest && "appCount" in previousManifest ? Number((previousManifest as { appCount?: number }).appCount ?? 0) : 0, records.length) : records.length,
      budget: budget.usage,
      failures: requestedApp
        ? [...new Set([
            ...((previousManifest && "failures" in previousManifest ? (previousManifest as { failures?: number[] }).failures : []) ?? []).filter((id) => !records.some((record) => record.id === id)),
            ...records.filter((record) => record.researchStatus === "failed").map((record) => record.id)
          ])].sort((a, b) => a - b)
        : records.filter((record) => record.researchStatus === "failed").map((record) => record.id)
    });
    if (!requestedApp && records.length === 100) await publishDataset(runId, records);
    process.stdout.write(`run ${runId} complete — ${records.length} record(s), ${budget.usage.used} model call(s)\n`);
  } finally {
    await release();
  }
}

async function loadRunRecords(runId: string, stage: "baseline" | "verified"): Promise<AppRecord[]> {
  const records: AppRecord[] = [];
  for (const seed of appSeeds) {
    const record = await loadRecord(runId, stage, seed.id, seed.slug);
    if (!record) throw new Error(`Missing ${stage} record for ${seed.name} in run ${runId}.`);
    records.push(AppRecordSchema.parse(record));
  }
  return records;
}

async function verify(): Promise<void> {
  const runId = option("--run");
  if (!runId) throw new Error("verify requires --run <run-id>.");
  const release = await acquireRunLock(runId);
  try {
    const baseline = await loadRunRecords(runId, "baseline");
    const limit = pLimit(Number(process.env.ATLAS_CONCURRENCY ?? 3));
    const verified = await Promise.all(baseline.map((record) => limit(async () => {
      const existing = await loadRecord(runId, "verified", record.id, record.slug);
      // Reuse verification only when it was derived from this exact baseline.
      // A retried failed record has a new researchedAt/model/status and must be rechecked.
      if (existing
        && existing.researchedAt === record.researchedAt
        && existing.researchModel === record.researchModel
        && existing.verification.verifierVersion === 2) return AppRecordSchema.parse(existing);
      const next = await verifyRecord(record);
      await saveRecord(runId, "verified", next);
      process.stdout.write(`verified ${record.id}/100 ${record.name}\n`);
      return next;
    })));
    await publishDataset(runId, verified);
  } finally {
    await release();
  }
}

async function analyze(): Promise<void> {
  const dataPath = path.join(workspaceRoot(), "data", "final", "apps.json");
  const dataset = DatasetSchema.parse(JSON.parse(await readFile(dataPath, "utf8")));
  const summary = summarize(dataset.records);
  assertSummaryInvariant(summary);
  await writeJsonAtomic(path.join(workspaceRoot(), "data", "final", "summary.json"), summary);
  await writeFile(path.join(workspaceRoot(), "data", "final", "apps.csv"), `${recordsToCsv(dataset.records)}\n`, "utf8");
  process.stdout.write(`analyzed ${summary.total} apps; ${summary.researched} researched\n`);
}

async function prepareAudit(): Promise<void> {
  const dataset = await readJson<unknown>(path.join(workspaceRoot(), "data", "final", "apps.json"));
  if (!dataset) throw new Error("Run research and verification before preparing the audit.");
  const parsed = DatasetSchema.parse(dataset);
  const seed = Number(option("--seed") ?? 391);
  const runId = option("--run") ?? parsed.runId;
  const baselineRecords = await loadRunRecords(runId, "baseline");
  const baselineAudit = createPendingAudit(baselineRecords, seed);
  const finalAudit = createPendingAudit(parsed.records, seed);
  await writeJsonAtomic(path.join(workspaceRoot(), "data", "final", "audit-baseline.json"), baselineAudit);
  await writeJsonAtomic(path.join(workspaceRoot(), "data", "final", "audit-final.json"), finalAudit);
  // Backward-compatible download name used by the case-study page.
  await writeJsonAtomic(path.join(workspaceRoot(), "data", "final", "audit.json"), finalAudit);
  process.stdout.write("prepared matched baseline/final 20-app audits (120 judgments each)\n");
}

function help(): void {
  process.stdout.write(`Integration Readiness Atlas\n\nCommands:\n  pnpm research -- --run <id> [--app github]\n  pnpm verify -- --run <id>\n  pnpm analyze\n  pnpm audit:prepare -- --run <id> --seed 391\n`);
}

const handlers: Record<string, () => Promise<void> | void> = { research, verify, analyze, "audit:prepare": prepareAudit, help };

try {
  const handler = handlers[command];
  if (!handler) throw new Error(`Unknown command: ${command}`);
  await handler();
} catch (error) {
  process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
  process.exitCode = 1;
}
