import type { AppRecord } from "@atlas/shared";

function quote(value: unknown): string {
  const text = Array.isArray(value) ? value.join(" | ") : String(value ?? "");
  return `"${text.replace(/"/g, '""')}"`;
}

export function recordsToCsv(records: AppRecord[]): string {
  const header = ["id", "app", "category", "one_liner", "auth", "access", "api_styles", "api_breadth", "mcp", "verdict", "blocker", "confidence", "evidence_urls"];
  const rows = records.map((record) => [
    record.id,
    record.name,
    record.category,
    record.oneLiner,
    record.auth.methods,
    record.access.bestPath,
    record.api.styles,
    record.api.breadth,
    record.mcp.status,
    record.buildability.verdict,
    record.buildability.blocker,
    record.confidence.overall,
    record.evidence.map((item) => item.url)
  ].map(quote).join(","));
  return [header.map(quote).join(","), ...rows].join("\n");
}
