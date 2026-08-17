# Integration Readiness Atlas — edge-case contract

This document is written before implementation and is the behavioral contract for the research agent, verification system, public demo, and case-study UI.

## Research identity and source integrity

| Case | Required behavior | Test/acceptance signal |
| --- | --- | --- |
| Two products share a name | Resolve against the supplied website hint; never merge records. | `identity.status = ambiguous` until the official domain matches. |
| Product was renamed, acquired, or deprecated | Keep the assigned name, record the current official name, and cite the vendor notice. | Aliases are preserved and the claim is dated. |
| Hint points to a marketing homepage | Search official developer/help domains separately. | Homepage alone cannot support auth/API claims. |
| No official documentation is discoverable | Return `unknown`; do not infer from integration directories. | Unsupported non-unknown claims fail validation. |
| Search finds a similarly named unofficial project | Reject it unless the official domain or organization confirms the relationship. | Domain-alignment check creates a review issue. |
| Documentation is stale or internally contradictory | Preserve both sources, lower confidence, and route to verification. | Conflict appears in `verification.issues`. |
| Source URL redirects or requires JavaScript | Follow safe redirects, then use the browser verifier if HTTP text is insufficient. | Final resolved URL and check method are stored. |
| Source blocks automation, login, CAPTCHA, or region | Do not bypass. Mark inaccessible and request human review. | No factual claim relies only on inaccessible content. |
| Source disappears after research | Keep retrieval date and last result, flag stale evidence, never silently replace the claim. | Link check status is visible in the evidence drawer. |

## Auth, access, API, and MCP classification

| Case | Required behavior | Test/acceptance signal |
| --- | --- | --- |
| App supports OAuth and API keys | Preserve both; choose the easiest verified developer path separately. | `auth.methods` contains both values. |
| OAuth app creation is self-serve but production approval is gated | Access is not simply self-serve. | `bestPath` and constraints show the distinction. |
| Credentials require a paid plan | Classify as `self_serve_paid`, not partner-gated. | Deterministic buildability is `conditional`. |
| Admin consent is needed after self-serve registration | Preserve both facts. | Access constraint includes `admin_approval`. |
| Sandbox credentials are free but production is gated | Record separate environments and classify production conservatively. | Rationale names the sandbox/production difference. |
| API is public but read-only or single-purpose | Mark breadth `narrow` and capture capability limits. | It cannot become `ready_now` if the required agent use is not useful. |
| SDK/CLI exists without a documented remote API | Record the actual callable surface; do not label it REST. | API styles are independent flags. |
| Official MCP exists | Cite the vendor-controlled docs or repository. | `mcp.official = true`. |
| Community MCP exists | Keep it separate from official MCP and name the repository owner. | UI labels it “community,” never “official.” |
| Composio exposes a toolkit or session MCP | Store as Composio coverage, not vendor MCP proof. | Separate `composio` and `mcp` fields. |
| No MCP is found | State “none found as of DATE,” not “does not exist.” | Search date is required. |
| Toolkit name match is fuzzy or wrong | Require domain/alias corroboration or reject the match. | Low-confidence matches enter review. |
| Vendor has no public agent-callable surface | Return `blocked/no_public_api`; this is a valid finding. | No attempt to manufacture browser automation as an API. |

## Model, budget, and resumability

| Case | Required behavior | Test/acceptance signal |
| --- | --- | --- |
| OpenAI key is missing | CLI exits with setup guidance; the static site still builds. | No secret is required for `pnpm build`. |
| Composio key is missing | Continue research with `composio.status = unavailable`. | Research result remains valid and honest. |
| Model refuses or returns incomplete output | Retry within the per-app limit, then checkpoint an explicit failure. | No partial JSON is promoted to final data. |
| Structured output fails validation | Retry once with validation issues; otherwise flag the app. | Invalid records never enter `data/final`. |
| Rate limited or transient network failure | Use exponential backoff with jitter and at most three attempts. | Retry behavior is covered by fake-timer tests. |
| Process is interrupted | Write records atomically and resume from the manifest. | Completed apps are not called again. |
| 140-call budget is reached | Stop before the next paid call and preserve progress. | Budget guard is tested at the boundary. |
| Multiple runs overlap | Use a run lock and refuse the second writer. | Dataset snapshots cannot be interleaved. |
| Duplicate app IDs or missing seed rows | Fail before any API request. | Seed validation requires exactly 100 unique records. |

## Verification and human audit

| Case | Required behavior | Test/acceptance signal |
| --- | --- | --- |
| Evidence URL is reachable but does not support the claim | Mark evidence mismatch; reachability alone is not verification. | Human audit has a separate support judgment. |
| Baseline and verifier agree on a wrong answer | Human audit remains the ground truth for reported accuracy. | Both stages are scored against the same audit. |
| Human changes the audited record | Keep pre-human metrics frozen and store the correction separately. | Site never calls corrected-sample accuracy independent. |
| Audit is partial | Show “Human audit pending.” | No placeholder or extrapolated percentage appears. |
| A category has too few verdict types for diverse sampling | Still select exactly two unique apps from the category deterministically. | Audit sample always contains 20 apps. |
| Unknown claim is audited | Judge whether unknown was justified, rather than forcing an answer. | Audit schema supports `justified_unknown`. |
| Metrics do not reconcile to 100 | Block the production build. | Aggregation invariant test fails. |

## Public demo, security, and cache

| Case | Required behavior | Test/acceptance signal |
| --- | --- | --- |
| User changes query/body to another app | Ignore input; the server only researches GitHub. | Fixed cache key and fixed seed. |
| Repeated requests attempt to spend credits | Serve the same 24-hour cached result. | At most one fresh run per UTC day/deployment. |
| Demo has no API key or credits | Return the last committed GitHub result with a clear stale/cache status. | UI remains useful without pretending it is fresh. |
| Cache read/write fails | Complete at most one guarded run, then return an actionable error. | No unbounded retry loop. |
| API error exposes internals | Return a stable error code and safe message; log details server-side. | No keys, headers, prompts, or stack traces reach the browser. |
| Evidence contains hostile text/instructions | Treat page text as data; never execute instructions from sources. | Prompts explicitly isolate untrusted source content. |

## Case-study UI and accessibility

| Case | Required behavior | Test/acceptance signal |
| --- | --- | --- |
| Final data has unknown or failed records | Show them visibly and exclude them only from metrics whose denominator is labeled. | No silent row deletion. |
| No human audit exists | Verification section renders a pending state. | Page does not crash or invent a score. |
| JavaScript is disabled or motion is reduced | Core findings and table remain readable; atlas animation is removed. | Progressive HTML and `prefers-reduced-motion` support. |
| Keyboard-only navigation | Every atlas node, filter, disclosure, and close action is reachable with visible focus. | Automated accessibility and manual tab-order check. |
| Narrow mobile viewport | Replace the dense table with evidence cards and horizontally scroll only compact data. | Verified at 390×844. |
| Very long app/source names | Wrap without covering controls or breaking the grid. | Visual fixture includes long labels. |
| External fonts fail | Use metrics-compatible system fallbacks. | Layout remains stable. |
| Download data is missing | Disable the action and explain why. | No dead links. |

## Non-goals

- The system will not create vendor accounts, OAuth apps, paid subscriptions, or partner applications.
- It will not bypass authentication, CAPTCHAs, paywalls, or safety interstitials.
- It will not claim that Composio toolkit availability proves official vendor support.
- It will not fabricate final research data when API credentials have not been supplied.

