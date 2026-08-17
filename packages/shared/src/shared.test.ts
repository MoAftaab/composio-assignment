import { describe, expect, it } from "vitest";
import {
  AppRecordSchema,
  appSeeds,
  assertSummaryInvariant,
  auditScore,
  classifyBuildability,
  createPendingAudit,
  createUnresearchedRecord,
  selectAuditSample,
  summarize,
  type AppRecord
} from "./index";

function fixture(overrides: Partial<AppRecord> = {}): AppRecord {
  return AppRecordSchema.parse({ ...createUnresearchedRecord(appSeeds[0]!), ...overrides });
}

describe("100-app seed", () => {
  it("contains exactly ten unique apps in each of ten categories", () => {
    expect(appSeeds).toHaveLength(100);
    expect(new Set(appSeeds.map((item) => item.id)).size).toBe(100);
    expect(new Set(appSeeds.map((item) => item.slug)).size).toBe(100);
    const categoryCounts = [...new Set(appSeeds.map((item) => item.category))].map((category) => appSeeds.filter((item) => item.category === category).length);
    expect(categoryCounts).toHaveLength(10);
    expect(categoryCounts.every((count) => count === 10)).toBe(true);
  });
});

describe("deterministic buildability", () => {
  const confirmedIdentity: AppRecord["identity"] = { officialName: "Example", officialDomain: "example.com", aliases: [], status: "confirmed", confidence: 1 };
  const broadApi: AppRecord["api"] = { styles: ["rest"], breadth: "broad", readWrite: "read_write", notes: "" };

  it("blocks ambiguous identities before considering API availability", () => {
    const result = classifyBuildability({ identity: { ...confirmedIdentity, status: "ambiguous" }, access: { bestPath: "self_serve_free", constraints: [], notes: "" }, api: broadApi });
    expect(result).toMatchObject({ verdict: "blocked", blocker: "identity_ambiguity" });
  });

  it("marks self-serve useful APIs ready now", () => {
    const result = classifyBuildability({ identity: confirmedIdentity, access: { bestPath: "self_serve_free", constraints: [], notes: "" }, api: broadApi });
    expect(result).toMatchObject({ verdict: "ready_now", blocker: "none" });
  });

  it.each([
    ["self_serve_paid", "conditional", "paid_access"],
    ["admin_approval", "conditional", "admin_approval"],
    ["partner_approval", "outreach_required", "partner_gate"],
    ["contact_sales", "outreach_required", "partner_gate"]
  ] as const)("classifies %s without conflating it with another gate", (bestPath, verdict, blocker) => {
    const result = classifyBuildability({ identity: confirmedIdentity, access: { bestPath, constraints: [bestPath], notes: "" }, api: broadApi });
    expect(result).toMatchObject({ verdict, blocker });
  });

  it("treats narrow read-only APIs as conditional", () => {
    const result = classifyBuildability({ identity: confirmedIdentity, access: { bestPath: "self_serve_free", constraints: [], notes: "" }, api: { styles: ["rest"], breadth: "narrow", readWrite: "read_only", notes: "" } });
    expect(result).toMatchObject({ verdict: "conditional", blocker: "read_only" });
  });
});

describe("analytics and audit", () => {
  it("reconciles every preview record without inventing research", () => {
    const records = appSeeds.map(createUnresearchedRecord);
    const summary = summarize(records);
    expect(summary.total).toBe(100);
    expect(summary.researched).toBe(0);
    expect(summary.byVerdict.unknown).toBe(100);
    expect(() => assertSummaryInvariant(summary)).not.toThrow();
  });

  it("selects two deterministic apps per category", () => {
    const first = selectAuditSample(appSeeds, 391);
    const second = selectAuditSample(appSeeds, 391);
    expect(first.map((item) => item.id)).toEqual(second.map((item) => item.id));
    expect(first).toHaveLength(20);
    const counts = [...new Set(first.map((item) => item.category))].map((category) => first.filter((item) => item.category === category).length);
    expect(counts.every((count) => count === 2)).toBe(true);
  });

  it("never reports a percentage for an untouched human audit", () => {
    const audit = createPendingAudit(appSeeds.map(createUnresearchedRecord));
    expect(auditScore(audit)).toEqual({ complete: false, correct: 0, judged: 0, percent: null });
  });

  it("counts review-routed evidence separately from failures", () => {
    const records = appSeeds.map(createUnresearchedRecord);
    records[0] = fixture({ researchStatus: "needs_review" });
    records[1] = AppRecordSchema.parse({ ...records[1], researchStatus: "failed" });
    const summary = summarize(records);
    expect(summary).toMatchObject({ evidenceCollected: 1, researched: 1, needsReview: 1, failed: 1, unresearched: 98 });
  });

  it("accepts unknown as an explicit record state", () => {
    expect(() => fixture()).not.toThrow();
  });
});
