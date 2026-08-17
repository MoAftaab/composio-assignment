import { z } from "zod";

export const CategorySchema = z.enum([
  "CRM and Sales",
  "Support and Helpdesk",
  "Communications and Messaging",
  "Marketing, Ads, Email and Social",
  "Ecommerce",
  "Data, SEO and Scraping",
  "Developer, Infra and Data platforms",
  "Productivity and Project Management",
  "Finance and Fintech",
  "AI, Research and Media-native"
]);

export const AuthMethodSchema = z.enum([
  "oauth2",
  "api_key",
  "basic",
  "bearer_token",
  "personal_token",
  "service_account",
  "custom",
  "none",
  "unknown"
]);

export const AccessLevelSchema = z.enum([
  "self_serve_free",
  "self_serve_trial",
  "self_serve_paid",
  "admin_approval",
  "partner_approval",
  "contact_sales",
  "no_credentials",
  "unknown"
]);

export const ApiStyleSchema = z.enum([
  "rest",
  "graphql",
  "soap",
  "sdk",
  "cli",
  "webhook",
  "mcp",
  "none",
  "unknown"
]);

export const ApiBreadthSchema = z.enum(["broad", "moderate", "narrow", "none", "unknown"]);
export const VerdictSchema = z.enum(["ready_now", "conditional", "outreach_required", "blocked", "unknown"]);
export const BlockerSchema = z.enum([
  "none",
  "paid_access",
  "admin_approval",
  "partner_gate",
  "no_public_api",
  "read_only",
  "restricted_scope",
  "policy_risk",
  "identity_ambiguity",
  "unknown"
]);

export const AppSeedSchema = z.object({
  id: z.number().int().min(1).max(100),
  slug: z.string().min(1),
  name: z.string().min(1),
  category: CategorySchema,
  websiteHint: z.string().min(1)
});

export const EvidenceSchema = z.object({
  id: z.string().min(1),
  url: z.string().url(),
  title: z.string(),
  publisher: z.string(),
  sourceType: z.enum(["official_docs", "official_help", "official_pricing", "official_github", "community_github", "secondary"]),
  supports: z.array(z.enum(["identity", "description", "auth", "access", "api", "mcp", "buildability"])),
  supportNote: z.string(),
  retrievedAt: z.string(),
  linkStatus: z.enum(["unchecked", "reachable", "redirected", "blocked", "missing"]),
  resolvedUrl: z.string().nullable()
});

export const AppRecordSchema = z.object({
  id: z.number().int().min(1).max(100),
  slug: z.string().min(1),
  name: z.string().min(1),
  category: CategorySchema,
  websiteHint: z.string().min(1),
  researchModel: z.string().min(1).default("gpt-5.4-mini"),
  researchStatus: z.enum(["unresearched", "researched", "needs_review", "failed"]),
  identity: z.object({
    officialName: z.string(),
    officialDomain: z.string(),
    aliases: z.array(z.string()),
    status: z.enum(["confirmed", "ambiguous", "unresolved"]),
    confidence: z.number().min(0).max(1)
  }),
  oneLiner: z.string(),
  auth: z.object({
    methods: z.array(AuthMethodSchema).min(1),
    easiestPath: AuthMethodSchema,
    notes: z.string()
  }),
  access: z.object({
    bestPath: AccessLevelSchema,
    constraints: z.array(AccessLevelSchema),
    notes: z.string()
  }),
  api: z.object({
    styles: z.array(ApiStyleSchema).min(1),
    breadth: ApiBreadthSchema,
    readWrite: z.enum(["read_write", "read_only", "write_only", "not_applicable", "unknown"]),
    notes: z.string()
  }),
  mcp: z.object({
    official: z.boolean(),
    community: z.boolean(),
    composioProvided: z.boolean(),
    status: z.enum(["official", "community", "composio_only", "multiple", "none_found", "unknown"]),
    searchedAt: z.string(),
    notes: z.string()
  }),
  composio: z.object({
    status: z.enum(["matched", "not_found", "unavailable", "ambiguous"]),
    toolkitSlug: z.string().nullable(),
    toolCount: z.number().int().nonnegative().nullable(),
    authSchemes: z.array(z.string()),
    matchConfidence: z.number().min(0).max(1)
  }),
  buildability: z.object({
    verdict: VerdictSchema,
    blocker: BlockerSchema,
    rationale: z.string()
  }),
  evidence: z.array(EvidenceSchema),
  confidence: z.object({
    overall: z.number().min(0).max(1),
    auth: z.number().min(0).max(1),
    access: z.number().min(0).max(1),
    api: z.number().min(0).max(1),
    mcp: z.number().min(0).max(1)
  }),
  verification: z.object({
    verifierVersion: z.number().int().nonnegative().default(0),
    status: z.enum(["pending", "automatic_checked", "human_checked", "disputed"]),
    issues: z.array(z.string()),
    corrections: z.array(z.object({
      field: z.string(),
      before: z.string(),
      after: z.string(),
      reason: z.string(),
      sourceUrl: z.string().url()
    }))
  }),
  researchedAt: z.string()
});

export const AuditJudgmentSchema = z.enum(["correct", "incorrect", "justified_unknown", "pending"]);
export const AuditEntrySchema = z.object({
  appId: z.number().int(),
  judgments: z.object({
    identity: AuditJudgmentSchema,
    auth: AuditJudgmentSchema,
    access: AuditJudgmentSchema,
    api: AuditJudgmentSchema,
    mcpBuildability: AuditJudgmentSchema,
    evidenceSupport: AuditJudgmentSchema
  }),
  correction: z.string(),
  notes: z.string(),
  checkedAt: z.string(),
  reviewer: z.string()
});

export const AuditFileSchema = z.object({
  seed: z.number().int(),
  generatedAt: z.string(),
  entries: z.array(AuditEntrySchema).length(20)
});

export const DatasetSchema = z.object({
  generatedAt: z.string(),
  runId: z.string(),
  model: z.literal("gpt-5.4-mini"),
  records: z.array(AppRecordSchema).length(100)
});

export type Category = z.infer<typeof CategorySchema>;
export type AuthMethod = z.infer<typeof AuthMethodSchema>;
export type AccessLevel = z.infer<typeof AccessLevelSchema>;
export type ApiStyle = z.infer<typeof ApiStyleSchema>;
export type Verdict = z.infer<typeof VerdictSchema>;
export type AppSeed = z.infer<typeof AppSeedSchema>;
export type AppRecord = z.infer<typeof AppRecordSchema>;
export type Evidence = z.infer<typeof EvidenceSchema>;
export type AuditEntry = z.infer<typeof AuditEntrySchema>;
export type AuditFile = z.infer<typeof AuditFileSchema>;
export type Dataset = z.infer<typeof DatasetSchema>;
