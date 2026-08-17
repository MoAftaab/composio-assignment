"use client";

import { useMemo, useState } from "react";
import type { AppRecord, AuditFile, Dataset } from "@atlas/shared";
import { atlasZone, type Summary } from "@atlas/shared";

type Props = {
  dataset: Dataset;
  summary: Summary;
  audit: AuditFile | null;
  auditResult: { complete: boolean; correct: number; judged: number; percent: number | null };
  baselineAuditResult: { complete: boolean; correct: number; judged: number; percent: number | null };
};

const verdictLabels = {
  ready_now: "Ready now",
  conditional: "Conditional",
  outreach_required: "Outreach",
  blocked: "Blocked",
  unknown: "Unresearched"
} as const;

function label(value: string): string {
  return value.replaceAll("_", " ").replace(/\b\w/g, (character) => character.toUpperCase());
}

function plainText(value: string): string {
  return value
    .replace(/\s*\(\[[^\]]+\]\([^)]+\)\)/g, "")
    .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1")
    .trim();
}

function displayDate(value: string): string {
  if (!value) return "Run pending";
  const [year, month, day] = value.slice(0, 10).split("-");
  const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  return year && month && day ? `${day} ${months[Number(month) - 1] ?? month} ${year}` : value;
}

function thesis(props: Props): { headline: string; detail: string } {
  if (props.summary.evidenceCollected === 0) {
    return {
      headline: "The instrument is ready. The evidence run is not.",
      detail: "All 100 assigned apps are loaded, but no result is presented as fact until the research pipeline runs with credentials."
    };
  }
  const topBlocker = props.summary.blockers.find((item) => item.blocker !== "none" && item.blocker !== "unknown");
  return {
    headline: `${props.summary.byVerdict.ready_now} of 100 integrations are ready to build now.`,
    detail: topBlocker ? `${label(topBlocker.blocker)} is the largest verified constraint, affecting ${topBlocker.count} apps.` : "The evidence shows more technical availability than operational accessibility."
  };
}

function download(filename: string, value: string, type: string) {
  const url = URL.createObjectURL(new Blob([value], { type }));
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
}

function EvidenceDossier({ record, onClose }: { record: AppRecord; onClose?: () => void }) {
  return (
    <aside className="dossier" aria-label={`${record.name} evidence dossier`}>
      <div className="dossier__head">
        <div>
          <span className="eyebrow">App {record.id.toString().padStart(3, "0")}</span>
          <h3>{record.name}</h3>
        </div>
        {onClose ? <button className="icon-button" onClick={onClose} aria-label="Close evidence dossier">×</button> : null}
      </div>
      <p className="dossier__summary">{plainText(record.oneLiner)}</p>
      <dl className="facts">
        <div><dt>Verdict</dt><dd>{verdictLabels[record.buildability.verdict]}</dd></div>
        <div><dt>Auth</dt><dd>{record.auth.methods.map(label).join(", ")}</dd></div>
        <div><dt>Access</dt><dd>{label(record.access.bestPath)}</dd></div>
        <div><dt>Surface</dt><dd>{record.api.styles.map(label).join(", ")}</dd></div>
        <div><dt>MCP</dt><dd>{label(record.mcp.status)}</dd></div>
        <div><dt>Confidence</dt><dd>{Math.round(record.confidence.overall * 100)}%</dd></div>
      </dl>
      <div className="dossier__rationale">
        <span className="eyebrow">Buildability logic</span>
        <p>{record.buildability.rationale}</p>
      </div>
      <div className="evidence-list">
        <span className="eyebrow">Evidence · {record.evidence.length}</span>
        {record.evidence.length ? record.evidence.map((evidence) => (
          <a href={evidence.url} target="_blank" rel="noreferrer" key={evidence.id}>
            <strong>{evidence.title || evidence.publisher}</strong>
            <span>{evidence.supports.map(label).join(" · ")}</span>
          </a>
        )) : <p className="empty-note">No evidence recorded. This app remains unresearched.</p>}
      </div>
    </aside>
  );
}

function IntegrationAssay({ records, selected, setSelected }: { records: AppRecord[]; selected: AppRecord; setSelected: (record: AppRecord) => void }) {
  const categories = [...new Set(records.map((record) => record.category))];
  const zones = ["ready_now", "conditional", "outreach_required", "blocked"] as const;
  return (
    <div className="assay" aria-label="100-app integration readiness atlas">
      <div className="assay__header" aria-hidden="true">
        <span>Category lane</span>
        {zones.map((zone) => <span key={zone}>{verdictLabels[zone]}</span>)}
      </div>
      {categories.map((category) => {
        const categoryRecords = records.filter((record) => record.category === category);
        return (
          <div className="assay__row" key={category}>
            <strong>{category}</strong>
            {zones.map((zone) => (
              <div className={`assay__well assay__well--${zone}`} key={zone}>
                {categoryRecords.filter((record) => atlasZone(record.buildability.verdict) === zone).map((record) => (
                  <button
                    className={`specimen specimen--${record.buildability.verdict}${selected.id === record.id ? " is-selected" : ""}`}
                    key={record.id}
                    onClick={() => setSelected(record)}
                    aria-label={`${record.name}: ${verdictLabels[record.buildability.verdict]}`}
                    title={`${record.name} — ${verdictLabels[record.buildability.verdict]}`}
                  >
                    {record.id}
                  </button>
                ))}
              </div>
            ))}
          </div>
        );
      })}
    </div>
  );
}

function LiveDemo() {
  const [state, setState] = useState<{ status: "idle" | "running" | "done" | "error"; message: string; record: AppRecord | null }>({ status: "idle", message: "One fixed app. One cache key. At most one fresh run every 24 hours.", record: null });
  async function run() {
    setState({ status: "running", message: "Researching GitHub with web search and Composio enrichment…", record: null });
    try {
      const response = await fetch("/api/demo", { method: "POST" });
      const body = await response.json() as { message: string; record: AppRecord };
      setState({ status: response.ok ? "done" : "error", message: body.message, record: body.record });
    } catch {
      setState({ status: "error", message: "The demo endpoint could not be reached.", record: null });
    }
  }
  return (
    <div className="demo-panel">
      <div>
        <span className="eyebrow">Fixed live proof · GitHub</span>
        <h3>Run one real evidence pass</h3>
        <p>{state.message}</p>
      </div>
      <button className="run-button" onClick={run} disabled={state.status === "running"}>{state.status === "running" ? "Researching…" : "Run the GitHub research agent"}</button>
      {state.record && state.record.researchStatus !== "unresearched" ? <EvidenceDossier record={state.record} /> : null}
    </div>
  );
}

export function AtlasExperience(props: Props) {
  const [selected, setSelected] = useState(props.dataset.records[60] ?? props.dataset.records[0]!);
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("all");
  const [verdict, setVerdict] = useState("all");
  const story = thesis(props);
  const categories = [...new Set(props.dataset.records.map((record) => record.category))];
  const filtered = useMemo(() => props.dataset.records.filter((record) => {
    return record.name.toLowerCase().includes(search.toLowerCase())
      && (category === "all" || record.category === category)
      && (verdict === "all" || record.buildability.verdict === verdict);
  }), [props.dataset.records, search, category, verdict]);
  const dominantAuth = Object.entries(props.summary.byAuth).filter(([value]) => value !== "unknown").sort((a, b) => b[1] - a[1])[0];
  const categoryRows = Object.entries(props.summary.byCategory);
  const easiestCategory = [...categoryRows].sort((a, b) => (b[1].ready / b[1].total) - (a[1].ready / a[1].total))[0];
  const gatedCategory = [...categoryRows].sort((a, b) => (b[1].gated / b[1].total) - (a[1].gated / a[1].total))[0];
  const topBlocker = props.summary.blockers.find((item) => !["none", "unknown"].includes(item.blocker));
  const auditsComplete = props.baselineAuditResult.complete && props.auditResult.complete;

  return (
    <main>
      <header className="masthead">
        <a className="wordmark" href="#top">INTEGRATION / READINESS</a>
        <nav aria-label="Case study sections">
          <a href="#findings">Findings</a><a href="#verification">Verification</a><a href="#agent">Agent</a><a href="#evidence">Evidence</a>
        </nav>
        <span className={`run-status${props.summary.evidenceCollected === 100 ? " run-status--complete" : ""}`}>{props.summary.evidenceCollected}/100 evidence collected</span>
      </header>

      <section className="hero" id="top">
        <div className="hero__thesis">
          <span className="eyebrow">Composio AI Product Ops · take-home</span>
          <h1>{story.headline}</h1>
          <p>{story.detail}</p>
          {props.summary.evidenceCollected === 0 ? <div className="preview-flag">Preview mode · no research claims are being presented as final</div> : null}
          {props.summary.evidenceCollected > 0 && props.summary.evidenceCollected < 100 ? <div className="preview-flag">Partial run · {props.summary.failed + props.summary.unresearched} apps remain pending and are excluded from completion claims</div> : null}
        </div>
        <div className="hero__index" aria-label="Dataset index">
          <span>100 apps</span><span>10 categories</span><span>{props.dataset.model}</span><span>{displayDate(props.dataset.generatedAt)}</span>
        </div>
      </section>

      <section className="atlas-section" aria-labelledby="atlas-title">
        <div className="section-head"><div><span className="eyebrow">The integration assay</span><h2 id="atlas-title">Every app. One readiness position.</h2></div><p>Select a numbered specimen to inspect its evidence dossier.</p></div>
        <div className="atlas-layout">
          <IntegrationAssay records={props.dataset.records} selected={selected} setSelected={setSelected} />
          <EvidenceDossier record={selected} />
        </div>
      </section>

      <section className="findings" id="findings" aria-labelledby="findings-title">
        <div className="section-head"><div><span className="eyebrow">Patterns, not rows</span><h2 id="findings-title">What the portfolio says</h2></div><p>Counts always reconcile to the underlying 100 records.</p></div>
        <div className="finding-grid">
          <article><span className="finding-number">{props.summary.byVerdict.ready_now}</span><h3>Ready now</h3><p>Useful callable surface and a self-serve credential path.</p></article>
          <article><span className="finding-number">{props.summary.byVerdict.outreach_required + props.summary.byVerdict.blocked}</span><h3>Need access or a new surface</h3><p>Partner gates, sales gates, ambiguity, or no verified public API.</p></article>
          <article><span className="finding-number">{props.summary.composioChecked ? props.summary.composioMatched : "—"}</span><h3>{props.summary.composioChecked ? "Found in Composio" : "Composio check pending"}</h3><p>{props.summary.composioChecked ? "Coverage is shown separately from official vendor MCP availability." : "The optional SDK enrichment was not run; zero is not presented as a coverage result."}</p></article>
        </div>
        <div className="pattern-ledger" aria-label="Portfolio pattern summary">
          <article><span>Dominant auth</span><strong>{dominantAuth ? `${label(dominantAuth[0])} · ${dominantAuth[1]} apps` : "Pending"}</strong></article>
          <article><span>Best easy-win category</span><strong>{easiestCategory ? `${easiestCategory[0]} · ${easiestCategory[1].ready}/${easiestCategory[1].total} ready` : "Pending"}</strong></article>
          <article><span>Most gated category</span><strong>{gatedCategory ? `${gatedCategory[0]} · ${gatedCategory[1].gated}/${gatedCategory[1].total} gated` : "Pending"}</strong></article>
          <article><span>Most common blocker</span><strong>{topBlocker ? `${label(topBlocker.blocker)} · ${topBlocker.count} apps` : "Pending"}</strong></article>
        </div>
      </section>

      <section className="verification" id="verification" aria-labelledby="verification-title">
        <div className="section-head"><div><span className="eyebrow">Trust ledger</span><h2 id="verification-title">Accuracy is measured, not implied.</h2></div></div>
        <div className="verification-grid">
          <div className="accuracy-meter">
            <div className="accuracy-flow"><span>{props.baselineAuditResult.percent === null ? "—" : `${props.baselineAuditResult.percent}%`}</span><b aria-hidden="true">→</b><span>{props.auditResult.percent === null ? "—" : `${props.auditResult.percent}%`}</span></div>
            <strong>{auditsComplete ? "First pass → verified accuracy" : "Applicant confirmation pending"}</strong>
            <p>Baseline {props.baselineAuditResult.judged}/120 · final {props.auditResult.judged}/120 judgments.</p>
            <div className="audit-disclosure">Automated checks are complete where evidence exists. Accuracy is published only after the applicant personally confirms both matched 20-app audits.</div>
          </div>
          <ol className="verification-steps"><li><strong>Baseline frozen</strong><span>The first structured record remains immutable.</span></li><li><strong>Sources checked</strong><span>{props.summary.automaticallyChecked}/100 records received automatic link and claim-coverage checks.</span></li><li><strong>20 apps sampled</strong><span>Two per category, six claim groups each; applicant sign-off remains explicit.</span></li></ol>
        </div>
      </section>

      <section className="agent" id="agent" aria-labelledby="agent-title">
        <div className="section-head"><div><span className="eyebrow">The research agent</span><h2 id="agent-title">A bounded pipeline with human escalation.</h2></div><p>140-call ceiling · three concurrent jobs · atomic checkpoints</p></div>
        <div className="workflow" aria-label="Research workflow">
          <div><span>01</span><strong>Resolve</strong><p>Match the product to its official domain.</p></div>
          <div><span>02</span><strong>Research</strong><p>Search auth, access, API, and MCP separately.</p></div>
          <div><span>03</span><strong>Enrich</strong><p>Add Composio toolkit metadata as a distinct signal.</p></div>
          <div><span>04</span><strong>Verify</strong><p>Check sources, contradictions, and a human sample.</p></div>
        </div>
        <LiveDemo />
      </section>

      <section className="evidence" id="evidence" aria-labelledby="evidence-title">
        <div className="section-head"><div><span className="eyebrow">Evidence ledger</span><h2 id="evidence-title">The complete research set</h2></div><div className="download-actions"><button onClick={() => download("apps.json", JSON.stringify(props.dataset, null, 2), "application/json")}>Download JSON</button>{props.audit ? <button onClick={() => download("audit.json", JSON.stringify(props.audit, null, 2), "application/json")}>Download audit</button> : null}</div></div>
        <div className="filters">
          <label><span>Search</span><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="App name" /></label>
          <label><span>Category</span><select value={category} onChange={(event) => setCategory(event.target.value)}><option value="all">All categories</option>{categories.map((value) => <option value={value} key={value}>{value}</option>)}</select></label>
          <label><span>Verdict</span><select value={verdict} onChange={(event) => setVerdict(event.target.value)}><option value="all">All verdicts</option>{Object.entries(verdictLabels).map(([value, text]) => <option value={value} key={value}>{text}</option>)}</select></label>
          <output>{filtered.length} records</output>
        </div>
        <div className="table-wrap">
          <table>
            <thead><tr><th>App</th><th>Category</th><th>Auth</th><th>Access</th><th>Surface</th><th>MCP</th><th>Verdict</th><th>Evidence</th></tr></thead>
            <tbody>{filtered.map((record) => (
              <tr key={record.id} onClick={() => setSelected(record)}>
                <td data-label="App"><strong>{record.name}</strong><span>{plainText(record.oneLiner)}</span></td>
                <td data-label="Category">{record.category}</td>
                <td data-label="Auth">{record.auth.methods.map(label).join(", ")}</td>
                <td data-label="Access">{label(record.access.bestPath)}</td>
                <td data-label="Surface">{record.api.styles.map(label).join(", ")}</td>
                <td data-label="MCP">{label(record.mcp.status)}</td>
                <td data-label="Verdict"><span className={`verdict verdict--${record.buildability.verdict}`}>{verdictLabels[record.buildability.verdict]}</span></td>
                <td data-label="Evidence">{record.evidence.length}</td>
              </tr>
            ))}</tbody>
          </table>
        </div>
      </section>

      <footer><strong>Integration Readiness Atlas</strong><span>Evidence dated at retrieval · Unknown is a valid result · No vendor accounts created</span><a href={process.env.NEXT_PUBLIC_REPOSITORY_URL || "https://github.com/MoAftaab/composio-assignment"}>Source & methodology</a></footer>
    </main>
  );
}
