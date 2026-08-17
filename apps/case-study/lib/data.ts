import { readFile } from "node:fs/promises";
import path from "node:path";
import { DatasetSchema, previewDataset, summarize, type AuditFile, AuditFileSchema, auditScore } from "@atlas/shared";

async function firstReadable(paths: string[]): Promise<string | null> {
  for (const candidate of paths) {
    try {
      return await readFile(candidate, "utf8");
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
    }
  }
  return null;
}

function dataCandidates(filename: string): string[] {
  return [
    path.resolve(process.cwd(), "data", "final", filename),
    path.resolve(process.cwd(), "..", "..", "data", "final", filename)
  ];
}

export async function loadCaseStudyData() {
  const datasetText = await firstReadable(dataCandidates("apps.json"));
  const dataset = datasetText ? DatasetSchema.parse(JSON.parse(datasetText)) : previewDataset;
  const auditText = await firstReadable(dataCandidates("audit.json"));
  const audit: AuditFile | null = auditText ? AuditFileSchema.parse(JSON.parse(auditText)) : null;
  const baselineAuditText = await firstReadable(dataCandidates("audit-baseline.json"));
  const baselineAudit: AuditFile | null = baselineAuditText ? AuditFileSchema.parse(JSON.parse(baselineAuditText)) : null;
  return {
    dataset,
    summary: summarize(dataset.records),
    audit,
    auditResult: audit ? auditScore(audit) : { complete: false, correct: 0, judged: 0, percent: null },
    baselineAuditResult: baselineAudit ? auditScore(baselineAudit) : { complete: false, correct: 0, judged: 0, percent: null }
  };
}
