import type { AppRecord, AppSeed, AuditFile } from "./schemas";

function seededRank(seed: number, appId: number): number {
  let value = (seed ^ (appId * 0x45d9f3b)) >>> 0;
  value = Math.imul(value ^ (value >>> 16), 0x45d9f3b) >>> 0;
  return value ^ (value >>> 16);
}

export function selectAuditSample(records: Array<AppRecord | AppSeed>, seed = 391): Array<AppRecord | AppSeed> {
  const categories = new Map<string, Array<AppRecord | AppSeed>>();
  for (const record of records) categories.set(record.category, [...(categories.get(record.category) ?? []), record]);
  return [...categories.values()].flatMap((group) => [...group].sort((a, b) => seededRank(seed, a.id) - seededRank(seed, b.id)).slice(0, 2));
}

export function createPendingAudit(records: AppRecord[], seed = 391): AuditFile {
  const selected = selectAuditSample(records, seed);
  return {
    seed,
    generatedAt: new Date().toISOString(),
    entries: selected.map((record) => ({
      appId: record.id,
      judgments: { identity: "pending", auth: "pending", access: "pending", api: "pending", mcpBuildability: "pending", evidenceSupport: "pending" },
      correction: "",
      notes: "",
      checkedAt: "",
      reviewer: ""
    }))
  };
}
