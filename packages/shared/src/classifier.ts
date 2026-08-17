import type { AppRecord, Verdict } from "./schemas";

export function classifyBuildability(record: Pick<AppRecord, "identity" | "access" | "api">): AppRecord["buildability"] {
  if (record.identity.status !== "confirmed") {
    return { verdict: "blocked", blocker: "identity_ambiguity", rationale: "The product identity could not be tied confidently to an official developer surface." };
  }

  const styles = new Set(record.api.styles);
  const hasCallableSurface = !styles.has("none") && !styles.has("unknown") && record.api.breadth !== "none" && record.api.breadth !== "unknown";
  if (!hasCallableSurface) {
    return { verdict: "blocked", blocker: "no_public_api", rationale: "No useful documented public agent-callable surface was verified." };
  }

  if (record.api.readWrite === "read_only" && record.api.breadth === "narrow") {
    return { verdict: "conditional", blocker: "read_only", rationale: "A callable surface exists, but it is narrow and read-only." };
  }

  if (["partner_approval", "contact_sales"].includes(record.access.bestPath)) {
    return { verdict: "outreach_required", blocker: "partner_gate", rationale: "The API exists, but production credentials require vendor outreach or approval." };
  }

  if (record.access.bestPath === "admin_approval") {
    return { verdict: "conditional", blocker: "admin_approval", rationale: "The API is buildable after an administrator grants access." };
  }

  if (record.access.bestPath === "self_serve_paid") {
    return { verdict: "conditional", blocker: "paid_access", rationale: "The API is buildable, but obtaining credentials requires a paid plan." };
  }

  if (["self_serve_free", "self_serve_trial"].includes(record.access.bestPath)) {
    return { verdict: "ready_now", blocker: "none", rationale: "A useful public surface and a self-serve credential path are both available." };
  }

  return { verdict: "conditional", blocker: "unknown", rationale: "A callable surface exists, but the credential path remains uncertain." };
}

export function atlasZone(verdict: Verdict): Exclude<Verdict, "unknown"> {
  return verdict === "unknown" ? "blocked" : verdict;
}
