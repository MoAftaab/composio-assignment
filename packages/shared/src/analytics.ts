import type { AppRecord, AuditFile, Category, Verdict } from "./schemas";

export interface Summary {
  total: number;
  evidenceCollected: number;
  researched: number;
  needsReview: number;
  failed: number;
  unresearched: number;
  automaticallyChecked: number;
  byVerdict: Record<Verdict, number>;
  byAuth: Record<string, number>;
  byAccess: Record<string, number>;
  byCategory: Record<Category, { total: number; ready: number; gated: number }>;
  blockers: Array<{ blocker: string; count: number }>;
  officialMcp: number;
  communityMcp: number;
  composioChecked: number;
  composioMatched: number;
}

export function summarize(records: AppRecord[]): Summary {
  const byVerdict = { ready_now: 0, conditional: 0, outreach_required: 0, blocked: 0, unknown: 0 } satisfies Record<Verdict, number>;
  const byAuth: Record<string, number> = {};
  const byAccess: Record<string, number> = {};
  const byCategory = {} as Summary["byCategory"];
  const blockerMap: Record<string, number> = {};

  for (const record of records) {
    byVerdict[record.buildability.verdict] += 1;
    for (const auth of new Set(record.auth.methods)) byAuth[auth] = (byAuth[auth] ?? 0) + 1;
    byAccess[record.access.bestPath] = (byAccess[record.access.bestPath] ?? 0) + 1;
    const category = byCategory[record.category] ?? { total: 0, ready: 0, gated: 0 };
    category.total += 1;
    if (record.buildability.verdict === "ready_now") category.ready += 1;
    if (["outreach_required", "blocked"].includes(record.buildability.verdict)) category.gated += 1;
    byCategory[record.category] = category;
    blockerMap[record.buildability.blocker] = (blockerMap[record.buildability.blocker] ?? 0) + 1;
  }

  return {
    total: records.length,
    evidenceCollected: records.filter((record) => ["researched", "needs_review"].includes(record.researchStatus)).length,
    // Kept as the UI-compatible completion count: a needs_review record has
    // research evidence, but is not represented as fully verified.
    researched: records.filter((record) => ["researched", "needs_review"].includes(record.researchStatus)).length,
    needsReview: records.filter((record) => record.researchStatus === "needs_review").length,
    failed: records.filter((record) => record.researchStatus === "failed").length,
    unresearched: records.filter((record) => record.researchStatus === "unresearched").length,
    automaticallyChecked: records.filter((record) => ["automatic_checked", "disputed", "human_checked"].includes(record.verification.status)).length,
    byVerdict,
    byAuth,
    byAccess,
    byCategory,
    blockers: Object.entries(blockerMap).map(([blocker, count]) => ({ blocker, count })).sort((a, b) => b.count - a.count),
    officialMcp: records.filter((record) => record.mcp.official).length,
    communityMcp: records.filter((record) => record.mcp.community).length,
    composioChecked: records.filter((record) => record.composio.status !== "unavailable").length,
    composioMatched: records.filter((record) => record.composio.status === "matched").length
  };
}

export function auditScore(audit: AuditFile): { complete: boolean; correct: number; judged: number; percent: number | null } {
  const judgments = audit.entries.flatMap((entry) => Object.values(entry.judgments));
  const judged = judgments.filter((value) => value !== "pending").length;
  const correct = judgments.filter((value) => value === "correct" || value === "justified_unknown").length;
  return { complete: judged === 120, correct, judged, percent: judged ? Math.round((correct / judged) * 1000) / 10 : null };
}

export function assertSummaryInvariant(summary: Summary): void {
  const verdictTotal = Object.values(summary.byVerdict).reduce((sum, count) => sum + count, 0);
  if (verdictTotal !== summary.total) throw new Error(`Verdict totals (${verdictTotal}) do not reconcile to ${summary.total}.`);
  if (summary.total !== 100) throw new Error(`Expected exactly 100 records, received ${summary.total}.`);
}
