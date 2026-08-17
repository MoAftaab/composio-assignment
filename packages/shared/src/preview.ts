import type { AppRecord, Dataset } from "./schemas";
import { appSeeds } from "./seed";

export function createUnresearchedRecord(seed: (typeof appSeeds)[number]): AppRecord {
  return {
    ...seed,
    researchModel: "gpt-5.4-mini",
    researchStatus: "unresearched",
    identity: { officialName: seed.name, officialDomain: seed.websiteHint.split(/[ /]/)[0] ?? "", aliases: [], status: "unresolved", confidence: 0 },
    oneLiner: "Research pending — run the evidence pipeline to populate this record.",
    auth: { methods: ["unknown"], easiestPath: "unknown", notes: "Not researched." },
    access: { bestPath: "unknown", constraints: ["unknown"], notes: "Not researched." },
    api: { styles: ["unknown"], breadth: "unknown", readWrite: "unknown", notes: "Not researched." },
    mcp: { official: false, community: false, composioProvided: false, status: "unknown", searchedAt: "", notes: "Not researched." },
    composio: { status: "unavailable", toolkitSlug: null, toolCount: null, authSchemes: [], matchConfidence: 0 },
    buildability: { verdict: "unknown", blocker: "unknown", rationale: "Research has not run." },
    evidence: [],
    confidence: { overall: 0, auth: 0, access: 0, api: 0, mcp: 0 },
    verification: { verifierVersion: 0, status: "pending", issues: ["Research has not run."], corrections: [] },
    researchedAt: ""
  };
}

export const previewDataset: Dataset = {
  generatedAt: "",
  runId: "preview-unresearched",
  model: "gpt-5.4-mini",
  records: appSeeds.map(createUnresearchedRecord)
};
