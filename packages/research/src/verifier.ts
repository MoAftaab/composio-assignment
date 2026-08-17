import { isIP } from "node:net";
import type { AppRecord } from "@atlas/shared";

const privateIpv4 = /^(10\.|127\.|169\.254\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.)/;

export function isSafePublicUrl(value: string): boolean {
  try {
    const url = new URL(value);
    if (!['http:', 'https:'].includes(url.protocol)) return false;
    const hostname = url.hostname.toLowerCase();
    if (hostname === "localhost" || hostname.endsWith(".local") || hostname === "0.0.0.0" || hostname === "::1") return false;
    if (isIP(hostname) === 4 && privateIpv4.test(hostname)) return false;
    return true;
  } catch {
    return false;
  }
}

async function checkUrl(value: string): Promise<Pick<AppRecord["evidence"][number], "linkStatus" | "resolvedUrl">> {
  if (!isSafePublicUrl(value)) return { linkStatus: "blocked", resolvedUrl: null };
  try {
    const response = await fetch(value, { method: "GET", redirect: "follow", signal: AbortSignal.timeout(12_000), headers: { "user-agent": "IntegrationReadinessAtlas/1.0 research-verifier" } });
    const resolvedUrl = response.url || value;
    if (!isSafePublicUrl(resolvedUrl)) return { linkStatus: "blocked", resolvedUrl: null };
    if (response.status === 401 || response.status === 403 || response.status === 429) return { linkStatus: "blocked", resolvedUrl };
    if (response.status >= 400) return { linkStatus: "missing", resolvedUrl };
    return { linkStatus: resolvedUrl === value ? "reachable" : "redirected", resolvedUrl };
  } catch {
    return { linkStatus: "blocked", resolvedUrl: null };
  }
}

export function evidenceCoverageIssues(record: AppRecord): string[] {
  if (record.researchStatus === "unresearched") return ["Research has not run."];
  const issues: string[] = [];
  for (const claim of ["identity", "auth", "access", "api"] as const) {
    if (!record.evidence.some((item) => item.supports.includes(claim))) issues.push(`Missing evidence for ${claim}.`);
  }
  if (record.mcp.status !== "unknown" && !record.evidence.some((item) => item.supports.includes("mcp"))) issues.push("Missing evidence for MCP status.");
  if (record.identity.status === "confirmed" && !record.identity.officialDomain) issues.push("Confirmed identity has no official domain.");
  if (record.composio.status === "matched" && !record.composio.toolkitSlug) issues.push("Matched Composio toolkit has no slug.");
  return issues;
}

export async function verifyRecord(record: AppRecord): Promise<AppRecord> {
  const evidence = await Promise.all(record.evidence.map(async (item) => ({ ...item, ...(await checkUrl(item.url)) })));
  const next = { ...record, evidence };
  const issues = [...new Set([...record.verification.issues.filter((issue) => issue !== "Research has not run."), ...evidenceCoverageIssues(next)])];
  const isIncomplete = record.researchStatus === "failed" || record.researchStatus === "unresearched";
  return {
    ...next,
    // Verification must never erase the fact that research itself failed.
    researchStatus: isIncomplete ? record.researchStatus : issues.length ? "needs_review" : record.researchStatus,
    verification: { ...record.verification, verifierVersion: 2, status: issues.length ? "disputed" : "automatic_checked", issues }
  };
}

export async function browserText(url: string): Promise<string | null> {
  if (!isSafePublicUrl(url)) return null;
  const { chromium } = await import("playwright");
  const browser = await chromium.launch({ headless: true });
  try {
    const page = await browser.newPage();
    await page.goto(url, { waitUntil: "domcontentloaded", timeout: 25_000 });
    return (await page.locator("body").innerText()).slice(0, 50_000);
  } catch {
    return null;
  } finally {
    await browser.close();
  }
}
