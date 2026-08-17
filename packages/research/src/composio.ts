import type { AppSeed, AppRecord } from "@atlas/shared";

type ToolkitCandidate = { slug?: string; name?: string; authConfigDetails?: unknown; toolsCount?: number; toolCount?: number; website?: string };

function normalized(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]/g, "");
}

function findCandidates(payload: unknown): ToolkitCandidate[] {
  if (Array.isArray(payload)) return payload as ToolkitCandidate[];
  if (payload && typeof payload === "object") {
    const object = payload as Record<string, unknown>;
    for (const key of ["items", "toolkits", "data"]) if (Array.isArray(object[key])) return object[key] as ToolkitCandidate[];
  }
  return [];
}

export async function enrichWithComposio(seed: AppSeed, apiKey = process.env.COMPOSIO_API_KEY): Promise<AppRecord["composio"]> {
  if (!apiKey) return { status: "unavailable", toolkitSlug: null, toolCount: null, authSchemes: [], matchConfidence: 0 };

  try {
    const { Composio } = await import("@composio/core");
    const composio = new Composio({ apiKey });
    const api = composio.toolkits as unknown as { list: (query?: Record<string, unknown>) => Promise<unknown> };
    const payload = await api.list({ search: seed.name, limit: 10 });
    const candidates = findCandidates(payload);
    const exact = candidates.filter((candidate) => normalized(candidate.name ?? candidate.slug ?? "") === normalized(seed.name));
    if (exact.length > 1) return { status: "ambiguous", toolkitSlug: null, toolCount: null, authSchemes: [], matchConfidence: 0.4 };
    const match = exact[0] ?? candidates.find((candidate) => normalized(candidate.slug ?? "").includes(normalized(seed.name)));
    if (!match) return { status: "not_found", toolkitSlug: null, toolCount: null, authSchemes: [], matchConfidence: 0 };

    const authSchemes = JSON.stringify(match.authConfigDetails ?? "").match(/oauth2|api[_ -]?key|basic|bearer|token/gi) ?? [];
    return {
      status: exact.length === 1 ? "matched" : "ambiguous",
      toolkitSlug: match.slug ?? null,
      toolCount: match.toolsCount ?? match.toolCount ?? null,
      authSchemes: [...new Set(authSchemes.map((item) => item.toLowerCase().replace(/[ _-]/g, "_")))],
      matchConfidence: exact.length === 1 ? 0.95 : 0.55
    };
  } catch {
    return { status: "unavailable", toolkitSlug: null, toolCount: null, authSchemes: [], matchConfidence: 0 };
  }
}
