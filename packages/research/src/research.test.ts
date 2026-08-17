import { describe, expect, it } from "vitest";
import { appSeeds, createUnresearchedRecord } from "@atlas/shared";
import { CallBudget, withRetry } from "./budget";
import { evidenceCoverageIssues, isSafePublicUrl, verifyRecord } from "./verifier";

describe("call budget and retry", () => {
  it("stops before a call beyond the hard budget", () => {
    const budget = new CallBudget(2);
    budget.reserve("one");
    budget.reserve("two");
    expect(() => budget.reserve("three")).toThrow(/budget exhausted/i);
    expect(budget.usage).toEqual({ used: 2, maximum: 2, remaining: 0 });
  });

  it("resumes a persisted model-call budget", () => {
    const budget = new CallBudget(4, 3);
    expect(budget.usage).toEqual({ used: 3, maximum: 4, remaining: 1 });
    budget.reserve("last permitted call");
    expect(() => budget.reserve("too many")).toThrow(/budget exhausted/i);
  });

  it("retries transient operations but remains bounded", async () => {
    let attempts = 0;
    const value = await withRetry(async () => {
      attempts += 1;
      if (attempts < 3) throw new Error("transient");
      return "ok";
    }, { attempts: 3, baseDelayMs: 1 });
    expect(value).toBe("ok");
    expect(attempts).toBe(3);
  });

  it("does not retry errors rejected by policy", async () => {
    let attempts = 0;
    await expect(withRetry(async () => {
      attempts += 1;
      throw new Error("invalid schema");
    }, { attempts: 3, shouldRetry: () => false })).rejects.toThrow("invalid schema");
    expect(attempts).toBe(1);
  });
});

describe("safe evidence verification", () => {
  it.each(["http://localhost:3000", "http://127.0.0.1", "http://10.1.2.3", "file:///etc/passwd", "javascript:alert(1)"])("rejects unsafe URL %s", (url) => {
    expect(isSafePublicUrl(url)).toBe(false);
  });

  it.each(["https://docs.github.com/rest", "https://developer.example.com/reference"])("accepts public HTTP(S) URL %s", (url) => {
    expect(isSafePublicUrl(url)).toBe(true);
  });

  it("flags unsupported core claims separately from link reachability", () => {
    const record = { ...createUnresearchedRecord(appSeeds[0]!), researchStatus: "researched" as const, verification: { verifierVersion: 0, status: "pending" as const, issues: [], corrections: [] } };
    expect(evidenceCoverageIssues(record)).toEqual(expect.arrayContaining([
      "Missing evidence for identity.",
      "Missing evidence for auth.",
      "Missing evidence for access.",
      "Missing evidence for api."
    ]));
  });

  it("preserves a failed research state during verification", async () => {
    const record = { ...createUnresearchedRecord(appSeeds[0]!), researchStatus: "failed" as const };
    const verified = await verifyRecord(record);
    expect(verified.researchStatus).toBe("failed");
    expect(verified.verification.verifierVersion).toBe(2);
  });
});
