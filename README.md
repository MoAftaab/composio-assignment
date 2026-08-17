# Integration Readiness Atlas

A reproducible research agent and one-page case study for Composio's AI Product Ops take-home. The pipeline researches the assigned 100 apps, keeps evidence attached to each claim, verifies sources, prepares a stratified human audit, and renders the findings as a reviewer-friendly HTML page.

The repository is safe to build without credentials. Until a real evidence run exists, the page clearly labels every app **Unresearched** instead of presenting generated or guessed claims as facts.

## What is implemented

- The exact 100-app, 10-category research set with stable IDs.
- A model-pinned `gpt-5.4-mini` research pass using the OpenAI Responses API, web search, and strict Zod structured output. The pipeline fails closed if another model is configured.
- Optional Composio SDK enrichment, recorded separately from official or community MCP availability.
- Deterministic buildability rules, so the verdict is explainable and testable rather than model-authored prose.
- A hard 140-model-call ceiling, three-job concurrency limit, retry policy, resumable per-app checkpoints, and single-writer run locks.
- Evidence URL verification with redirect/status handling, SSRF-resistant URL checks, contradiction/coverage flags, and immutable baseline records.
- A deterministic 20-app human audit sample: two apps from every category and six claim groups per app (120 judgments).
- A fixed GitHub live demo endpoint with a 24-hour cache. It cannot be turned into an arbitrary, user-funded research proxy.
- A single responsive case-study page with the readiness assay, evidence dossier, portfolio patterns, trust ledger, agent workflow, filters, and JSON export.

The edge-case contract was written before implementation: see [`EDGE_CASES.md`](./EDGE_CASES.md). Visual decisions are documented in [`DESIGN.md`](./DESIGN.md).

## Architecture

```text
100-app seed
    │
    ▼
OpenAI research pass ── optional Composio lookup
    │                    (separate coverage signal)
    ▼
immutable baseline records
    │
    ├── evidence coverage checks
    ├── safe URL / redirect verification
    └── unresolved claims → needs_review
    │
    ▼
verified dataset ── 20-app / 120-claim human audit
    │
    ▼
summary + CSV + one-page Next.js case study
```

The trust boundary is deliberate: retrieved pages are untrusted evidence, never instructions. A missing source, ambiguous identity, inaccessible page, or gated credential path becomes an explicit unknown or review item.

## Local setup

Requirements: Node.js 20+ and pnpm 10+.

```bash
pnpm install
copy .env.example .env
```

On macOS/Linux use `cp .env.example .env`. Add secrets only to the untracked `.env` file:

```dotenv
OPENAI_API_KEY=your_openai_key
COMPOSIO_API_KEY=your_optional_composio_key
OPENAI_MODEL=gpt-5.4-mini
ATLAS_MAX_MODEL_CALLS=140
ATLAS_CONCURRENCY=3
```

`OPENAI_API_KEY` is required only for fresh research and the live demo. `COMPOSIO_API_KEY` is optional: without it, the dataset records Composio coverage as `not_checked`. Secrets stay server-side and are never exposed through `NEXT_PUBLIC_*` variables.

## Run the research agent

Use a stable run ID so an interrupted run can resume without paying for completed apps again:

```bash
pnpm research -- --run submission
pnpm verify -- --run submission
pnpm analyze
pnpm audit:prepare -- --seed 391
```

For a cheap smoke test, research one app without publishing a partial 100-app dataset:

```bash
pnpm research -- --run smoke --app github
```

Outputs:

- `data/runs/<run-id>/baseline/`: immutable first-pass records.
- `data/runs/<run-id>/verified/`: automatically checked records.
- `data/runs/<run-id>/manifest.json`: model, call usage, failures, and timestamp.
- `data/final/apps.json`: published 100-app dataset consumed by the page.
- `data/final/apps.csv`: portable flat export.
- `data/final/summary.json`: reconciled aggregate counts.
- `data/final/audit.json`: deterministic 20-app human-check worksheet.

`audit:prepare` creates matched `audit-baseline.json` and `audit-final.json` files over the same 20-app sample. Complete every judgment with `correct`, `incorrect`, or `justified_unknown`; add reviewer, checked date, correction, notes, and supporting URL where appropriate. Re-run the site build after both files are complete. The trust ledger reports first-pass and final accuracy directly from those files; it never invents an improvement number.

The committed partial run currently contains evidence for 85 apps. Fifteen records remain explicitly failed because the account returned a billing 429. Re-running `pnpm research -- --run submission` after credits are restored retries only those failed checkpoints.

## Run the case study

```bash
pnpm dev
```

Open [http://localhost:3000](http://localhost:3000). A production check is:

```bash
pnpm test
pnpm exec tsc --noEmit
pnpm build
pnpm start
```

## Deploy

The repository includes `vercel.json` for a root-level monorepo deployment. Deploy with the Vercel CLI:

```bash
vercel link
vercel deploy --prod
```

Add `OPENAI_API_KEY` and, optionally, `COMPOSIO_API_KEY` only as server-side Vercel environment variables. Set `NEXT_PUBLIC_REPOSITORY_URL` to `https://github.com/MoAftaab/composio-assignment`.

The static page remains deployable without either API key. In that state, the fixed demo returns an honest setup message and the committed dataset still renders.

## Verification model

Verification is intentionally layered:

1. The model must map evidence to identity, auth, access, API, MCP, or buildability claims.
2. Schema validation rejects malformed enums, missing required fields, and non-100 final datasets.
3. Deterministic rules recompute the buildability verdict from access and API facts.
4. The verifier checks URL safety, redirects, reachability, and core claim coverage.
5. Ambiguity, contradictions, missing sources, and blocked pages are escalated instead of silently accepted.
6. The stratified human sample checks two apps per category across six claim groups.

This separates *first-pass generation*, *automatic verification*, and *human judgment*. The page only reports an accuracy change after actual judgments have been entered; pending work stays visibly pending.

## Known limitations

- A reachable URL does not prove that its content supports a claim; that is why the human evidence-support judgment exists.
- Some vendor documentation blocks automated browsers or requires login. The verifier records this as blocked, not false.
- “No MCP found” is time-bounded and never treated as proof that none exists.
- Community MCP quality and safety are not inferred from repository existence alone.
- No paid vendor accounts are created. Paid, admin, partnership, or sales gates are valid findings.

## Repository map

```text
apps/case-study/       Next.js one-page case study and fixed live demo
packages/research/     OpenAI agent, Composio enrichment, verifier, CLI, storage
packages/shared/       schemas, seed, deterministic rules, analytics, audit logic
data/runs/             resumable run checkpoints (ignored except .gitkeep)
data/final/            published evidence artifacts created by the pipeline
EDGE_CASES.md          pre-development failure-mode contract
DESIGN.md              visual system and information architecture
```
