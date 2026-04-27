# Technical Approach — Cloud-Native Edition

**RFP #MC-2026-0417 — Meridian Components Inventory Dashboard Modernization**
**Submitted by:** Accenture Team
**Date:** April 28, 2026
**Version:** 2.0

---

## 1. Solution Architecture Overview

### 1.1 Cloud-Native Design Principles

Accenture Team will re-platform the Meridian dashboard from a locally hosted application to a cloud-native architecture on AWS. This decision is driven by three business requirements that are not well-served by the current on-premise model:

- **Availability:** Meridian's three warehouses (SF, London, Tokyo) need a globally available application with low latency — a CDN-backed SPA and a regionally proxied API serve this better than a single internal host.
- **Maintainability:** IaC-managed cloud infrastructure can be versioned, reviewed, and reliably reproduced. Tribal knowledge of a local server is a single point of failure.
- **Developer velocity:** A CI/CD pipeline with automated quality gates (SonarQube, Checkmarx, Playwright) requires a cloud-connected build environment. Wiring these into a local-only host is unnecessarily complex.

The re-platforming will be executed as part of Phase 1 alongside R4 (architecture documentation). Application code changes (R1, R2, R3) will be developed and tested in the cloud environment from day one.

### 1.2 Target Architecture (AWS)

```
┌──────────────────────────────────────────────────────────────────┐
│                         Users (SF / London / Tokyo)              │
└────────────────────────┬─────────────────────────────────────────┘
                         │ HTTPS
                         ▼
              ┌──────────────────┐
              │   CloudFront CDN │  ← Vue SPA (S3 origin) + API proxy
              └─────────┬────────┘
              │ (SPA)   │ (API /api/*)
              ▼         ▼
         ┌────────┐  ┌──────────────────────────────┐
         │   S3   │  │        API Gateway           │
         │(static)│  └──────────────┬───────────────┘
         └────────┘                 │
                                    ▼
                      ┌─────────────────────────┐
                      │  ECS Fargate (FastAPI)  │
                      │  Private Subnet, 2 tasks│
                      └────────────┬────────────┘
                                   │
                    ┌──────────────┼──────────────┐
                    ▼              ▼              ▼
              ┌──────────┐  ┌──────────┐  ┌──────────────┐
              │  Aurora  │  │Secrets   │  │  S3 (data /  │
              │ PostgreSQL│  │Manager   │  │  exports)    │
              │(Serverless│  └──────────┘  └──────────────┘
              │   v2)    │
              └──────────┘
                    │
              ┌─────┴──────┐
              │  CloudWatch│  ← Logs, metrics, alarms
              │  + X-Ray   │  ← Distributed tracing
              └────────────┘
```

**AWS Services — rationale:**

| Service | Role | Justification |
|---|---|---|
| CloudFront | CDN + API proxy | Low-latency SPA delivery to 3 global warehouses; SSL termination; WAF integration |
| S3 | Static hosting | Zero-server frontend hosting; versioned deployments via bucket prefix |
| API Gateway | API front door | Request throttling, API key management, CloudWatch metrics out of the box |
| ECS Fargate | FastAPI runtime | Containerised, serverless compute — no EC2 management; scales to zero in non-prod |
| RDS Aurora PostgreSQL Serverless v2 | Primary datastore | Auto-scales ACUs; PostgreSQL compatible; replaces JSON files (see §8 Data Assessment) |
| Secrets Manager | Credentials | DB passwords, API keys — never in code or environment variables |
| CloudWatch + X-Ray | Observability | Unified logs, metrics, traces; alarm-based on-call routing |
| WAF | Security | OWASP Top 10 ruleset; rate limiting; geo-restriction if needed |
| Route 53 | DNS | Hosted zone for `inventory.meridiancomponents.internal` |
| AWS CDK (TypeScript) | IaC | All infrastructure defined as code; stack per environment (dev/staging/prod) |

---

## 2. Data Engineering Assessment

### 2.1 Current State — JSON File Layer

The existing data layer consists of static JSON files loaded into memory via `server/mock_data.py`. This was appropriate for a prototype but introduces structural limitations that will constrain every item in the statement of work:

| Limitation | Impact |
|---|---|
| No schema enforcement | Any malformed record silently passes through — defects in R1 may be partially data-quality issues, not just filter bugs |
| No query capability | All filtering is in-memory Python — full dataset loaded on every request; does not scale |
| No transactional guarantees | R2 (restocking) writes recommendations; JSON files have no ACID semantics |
| No audit trail | No change history; no visibility into who changed what |
| No referential integrity | SKU-warehouse-supplier relationships are implicit in JSON structure — easy to corrupt |
| No multi-user concurrency | Concurrent writes to JSON files produce undefined behavior |

### 2.2 Data Model Assessment

From inspection of the API surface, the logical entities are:

```
Product (SKU, name, category, unit_cost, reorder_target)
    └── Inventory (product_id, warehouse_id, quantity, last_updated)
Warehouse (id, name, location, timezone, locale)
Order (id, product_id, warehouse_id, supplier_id, qty, status, month)
Supplier (id, name, preferred_flag, lead_time_days)
DemandForecast (product_id, warehouse_id, period, avg_daily_demand)
Backlog (product_id, warehouse_id, qty_backlogged, priority)
SpendingTransaction (id, supplier_id, warehouse_id, amount, date, category)
```

The JSON files encode these relationships via nested objects and repeated denormalized data. The PostgreSQL target schema will normalize these to third normal form, with appropriate indexes on `(warehouse_id, category)`, `(product_id, warehouse_id)`, and `(month, status)` to support the existing filter patterns.

### 2.3 Migration Strategy

We will execute the data migration in two steps:

**Step 1 — Abstraction layer (Phase 1, before any feature work):**
Introduce a repository pattern in the Python layer. All data access moves through `server/repositories/*.py` interfaces. The implementation behind the interface remains JSON files initially — but the application no longer calls `mock_data.py` directly.

This step has zero user-visible impact and costs roughly one day of engineering. Its value is that Steps 2–4 become drop-in replacements without touching application logic.

**Step 2 — Schema creation and data load (Phase 1 close):**
CDK provisions Aurora PostgreSQL Serverless v2. Migration scripts (`scripts/migrate/`) load the JSON data into the normalised schema. Data validation runs on load: null checks, referential integrity, value-range assertions. Failures are logged to a migration report reviewed with Meridian before go-live.

**Step 3 — Repository swap (Phase 1→2 boundary):**
The JSON repository implementations are replaced with SQLAlchemy implementations. All application tests (Playwright + future unit tests) run against the Postgres instance from this point. JSON files are archived to S3 and retired.

**Step 4 — Data quality baseline (Phase 2, alongside R2):**
The restocking engine (R2) requires trustworthy demand and stock data. We will deliver a data quality report at the start of Phase 2 covering: completeness (missing SKUs, null quantities), freshness (when was each record last updated), and consistency (stock + demand figures plausible given order history). Findings are shared with Tanaka's team before R2 development begins.

### 2.4 Future State Recommendations (out of scope for this engagement)

- **Real-time inventory updates:** Replace batch JSON loads with an event-driven pipeline — warehouse systems emit events to EventBridge → Lambda → Aurora. Removes the current "stale data" risk.
- **Analytics layer:** S3 + Athena over historical snapshots enables ad-hoc analysis without hitting the operational database.
- **Data quality monitoring:** AWS Glue Data Quality or Great Expectations for automated freshness and completeness checks on a schedule.

---

## 3. DevOps & CI/CD Pipeline

### 3.1 Pipeline Architecture

Every commit to the main branch and every pull request triggers the following pipeline (implemented in GitHub Actions, deployable to AWS CodePipeline if preferred):

```
PR / Push
    │
    ├─► Lint & Unit Tests (Python pytest + Vitest for Vue)
    │       └── Fail fast — blocks all downstream stages
    │
    ├─► SonarQube Scan
    │       ├── Quality Gate: coverage ≥ 80%, no new blockers/criticals
    │       └── Results posted as PR comment
    │
    ├─► Checkmarx SAST Scan
    │       ├── Severity threshold: HIGH → block merge, MEDIUM → warn
    │       └── Report artifact stored in S3
    │
    ├─► Docker Build + ECR Push (main branch only)
    │
    ├─► CDK Diff (PR) / CDK Deploy (main → dev)
    │
    ├─► Playwright E2E Tests (vs. dev environment)
    │       └── Fail → block promotion to staging
    │
    └─► Manual approval gate → staging → prod
```

### 3.2 Environments

| Environment | Trigger | Purpose |
|---|---|---|
| `dev` | Every merge to `main` | Integration testing; Playwright runs here |
| `staging` | Manual promotion from dev | UAT with Meridian; performance baseline |
| `prod` | Manual approval | Live system |

Infrastructure per environment is identical (CDK stack parameterised by env). ECS Fargate scales to zero in non-prod during off-hours to reduce cost.

### 3.3 Infrastructure as Code

All AWS resources are defined in CDK TypeScript stacks:

```
infra/
  ├── bin/app.ts              # Entry point, env parameterization
  ├── lib/
  │   ├── network-stack.ts    # VPC, subnets, security groups
  │   ├── database-stack.ts   # Aurora Serverless v2, Secrets Manager
  │   ├── compute-stack.ts    # ECS Fargate, task definitions, ALB
  │   ├── frontend-stack.ts   # S3, CloudFront, Route 53
  │   └── pipeline-stack.ts   # CodePipeline (optional) or GitHub OIDC role
  └── cdk.json
```

CDK stacks are reviewed in the same PR as application code. Infrastructure changes require the same quality gates as application changes.

### 3.4 Container Strategy

The FastAPI backend is containerised via a multi-stage Dockerfile:

```dockerfile
# Stage 1: dependency install (cached layer)
FROM python:3.12-slim AS deps
WORKDIR /app
COPY pyproject.toml uv.lock ./
RUN pip install uv && uv sync --frozen --no-dev

# Stage 2: runtime image
FROM python:3.12-slim AS runtime
WORKDIR /app
COPY --from=deps /app/.venv ./.venv
COPY server/ ./server/
ENV PATH="/app/.venv/bin:$PATH"
EXPOSE 8001
CMD ["uvicorn", "server.main:app", "--host", "0.0.0.0", "--port", "8001"]
```

Images are tagged with the Git SHA and pushed to ECR. ECS task definitions reference the SHA tag — rollback is a task definition update, no redeployment required.

---

## 4. Quality Engineering

### 4.1 SonarQube

SonarQube will be configured with a custom quality gate for this project:

| Metric | Threshold |
|---|---|
| Line coverage (new code) | ≥ 80% |
| Duplicated lines (new code) | < 3% |
| Maintainability rating | A |
| Reliability rating | A |
| Security rating | A |
| New blocker issues | 0 |
| New critical issues | 0 |

SonarQube will scan both the Python backend (`server/`) and the Vue frontend (`client/src/`). Results are posted as a PR comment and block merge if the quality gate fails. The SonarQube instance will be provisioned on the Accenture shared tenant (or a Meridian-owned SonarCloud account if preferred).

Coverage is generated by:
- **Backend:** `pytest --cov=server --cov-report=xml` (coverage.xml fed to Sonar)
- **Frontend:** `vitest run --coverage` (lcov format fed to Sonar)

### 4.2 Checkmarx SAST

Checkmarx will run a static application security testing scan on every PR. Configuration:

- **Scope:** Full repository (`server/` + `client/`)
- **Ruleset:** Checkmarx default + OWASP Top 10 + custom rules for FastAPI injection patterns
- **Severity thresholds:**
  - HIGH → blocks PR merge; must be resolved or formally risk-accepted before merge
  - MEDIUM → PR comment + warning; must be tracked in the security backlog
  - LOW/INFO → informational only
- **Scan artifacts:** Full SAST report stored in S3 per scan; 90-day retention.
- **False positive process:** Developer marks FP in Checkmarx UI with justification; tech lead reviews weekly.

Checkmarx runs as a GitHub Actions step using the official Checkmarx GitHub Action (`checkmarx/ast-github-action`). Credentials are stored in GitHub Secrets (never in source code).

### 4.3 Playwright Browser Testing

See §6 (R3) for the full test scope and strategy. The pipeline integration:

- Tests run against the **dev** environment after every successful deployment.
- Test results are published as a JUnit XML artifact (GitHub Actions test summary).
- Playwright video recordings are retained for 7 days on S3 for failed test debugging.
- Failed E2E tests block promotion to staging.

---

## 5. R1 — Reports Module Remediation

*(Approach unchanged from v1.0; now runs in cloud-native context from day 1)*

**Audit-first:** A written defect register is agreed with Meridian before remediation begins. No fixes shipped before scope is locked.

**Filter system:** End-to-end trace of all four filters (Time Period, Warehouse, Category, Order Status) per report view. Broken query-param bindings repaired in the Vue layer and corresponding FastAPI handlers.

**i18n gaps:** All Report-module strings audited against the i18n key registry. Missing keys added; hardcoded strings extracted. Tokyo locale (Japanese) prioritized.

**Options → Composition API migration:** Reports-scoped only. Remaining Options API components documented in R4 as tech debt; out of scope for this engagement unless bundled in a future change request.

**Test coverage:** Every fixed defect has a Playwright regression test. R1 and R3 are developed together.

---

## 6. R2 — Restocking Recommendations

*(Approach from v1.0 retained; data engineering perspective added)*

### Algorithm

```
days_of_stock_remaining  = current_quantity / avg_daily_demand
stockout_risk_score      = 1 / days_of_stock_remaining
recommended_order_qty    = max(0, reorder_target - current_quantity)
estimated_cost           = recommended_order_qty × unit_cost
```

Candidates ranked by `stockout_risk_score` descending; greedy selection until budget ceiling reached.

### New API Endpoint

```
POST /api/restocking/recommendations
Body:  { "warehouse": "SF" | "London" | "Tokyo" | "all", "budget_ceiling": 25000.00 }
Response: {
  "recommendations": [
    { "sku": "...", "product": "...", "warehouse": "...", "days_remaining": 4.2,
      "recommended_qty": 500, "estimated_cost": 2250.00, "cumulative_spend": 2250.00 }
  ],
  "total_estimated_cost": 18400.00,
  "items_excluded_by_budget": 3
}
```

Logic isolated in `server/restocking.py` — independently unit-tested. DB-backed post-migration (replaces in-memory JSON reads).

### UI

New route `/restocking`:
1. Budget input panel + warehouse selector
2. Ranked recommendations table with risk colour-coding (red < 7 days, amber < 30, green ≥ 30)
3. Live cumulative spend tracker vs. ceiling
4. CSV export

---

## 7. R3 — Automated Browser Testing

*(Extended with pipeline integration — see §4.3)*

**Framework:** Playwright (Python) running against dev environment.

**Scope by phase:**

| Phase | Tests |
|---|---|
| Phase 1 | Inventory filters (all combinations), Orders filters, Reports defect regressions, basic smoke suite |
| Phase 2 | Restocking: budget input → results, ceiling enforcement, warehouse scoping, CSV export |
| Phase 3 | Full navigation smoke, no-console-errors baseline, i18n locale switch |

**Deliverable:** `tests/e2e/` directory, `pytest` runner, `README`, GitHub Actions job definition, and a Playwright HTML report template.

---

## 8. R4 — Architecture Documentation

Self-contained HTML deliverable covering:

1. System diagram (as-built AWS architecture)
2. Component inventory (views, routes, data entities)
3. Technical debt register (pre-engagement findings)
4. Future-state recommendations (DB migration, CI/CD, i18n roadmap, dark mode)
5. Operational runbook (start/stop, env vars, rollback procedure)

---

## 9. D1, D2, D3 — Desired Items

**D1 — UI Modernization:** One HTML visual prototype delivered to Meridian for ratification before implementation. Design token system introduced (CSS custom properties) that enables D3 without a second full redesign pass. One revision round included; further revisions are change requests.

**D2 — Internationalization:** Full i18n key audit across all Vue views. Japanese translations added for all missing keys. Meridian provides a bilingual reviewer; machine translation used with explicit caveat if not available.

**D3 — Dark Mode:** `data-theme` toggle on root `<html>` element, persisted to `localStorage`, respects `prefers-color-scheme` as default. Developed on an isolated git branch to protect main from unfinished work.

---

## 10. AWS Infrastructure Cost Estimate

*Monthly recurring costs, production environment. USD, on-demand pricing. Reserved pricing column assumes 1-year Compute Savings Plan.*

| Service | Specification | On-Demand/mo | Reserved/mo |
|---|---|---|---|
| CloudFront | ~10 GB transfer, 2M requests | $12 | $12 |
| S3 | 20 GB storage + PUT/GET | $5 | $5 |
| API Gateway | HTTP API, 2M requests | $2 | $2 |
| ECS Fargate | 2 tasks, 0.5 vCPU / 1 GB RAM each | $68 | $45 |
| RDS Aurora PostgreSQL Serverless v2 | 0.5–2 ACU, 20 GB storage | $135 | $95 |
| Secrets Manager | 5 secrets, 10K API calls | $4 | $4 |
| CloudWatch | 10 GB logs ingested, 10 metrics | $18 | $18 |
| X-Ray | 100K traces | $5 | $5 |
| WAF | Web ACL + OWASP ruleset | $20 | $20 |
| Route 53 | 1 hosted zone, 1M queries | $1 | $1 |
| **Total (production)** | | **~$270/mo** | **~$207/mo** |

**Non-production environments (dev + staging):** ~$80/month combined (Fargate scales to zero off-hours; Aurora pauses at 0 ACU when idle).

**First-year total infrastructure:** ~$3,600 (on-demand) → **~$2,800 with 1-year Savings Plan**

**One-time setup costs (not recurring):**
- Checkmarx license: per Meridian's enterprise agreement or ~$12,000/year standalone
- SonarQube: SonarCloud Team tier ~$600/year (alternative: self-hosted on Fargate, ~$40/month)
- Domain / SSL: included in Route 53 + ACM (free certificates)

---

## 11. Project Pricing — Fixed-Fee by Phase (Big4 Europe Rates)

### Daily Billing Rates

Rates reflect Accenture Europe standard billing rates, fully inclusive of travel, tooling overhead, and margin. No additional charges.

| Role | Accenture Level | Daily Billing Rate |
|---|---|---|
| Solutions Architect (Lead) | Manager | €2,500/day |
| Full-Stack Developer (Vue + FastAPI) | Senior Consultant | €1,800/day |
| Data Engineer | Senior Consultant | €1,900/day |
| DevSecOps Engineer | Senior Consultant | €1,700/day |
| QA Engineer | Consultant | €1,400/day |

### Team Allocation by Phase

| Role | Rate/day | Phase 1 (15d) | Phase 2 (20d) | Phase 3 (10d) |
|---|---|---|---|---|
| Solutions Architect (Lead) | €2,500 | 100% → €37,500 | 100% → €50,000 | 100% → €25,000 |
| Full-Stack Developer | €1,800 | 100% → €27,000 | 100% → €36,000 | 100% → €18,000 |
| Data Engineer | €1,900 | 75% → €21,375 | 100% → €38,000 | 25% → €4,750 |
| DevSecOps Engineer | €1,700 | 100% → €25,500 | 50% → €17,000 | 25% → €4,250 |
| QA Engineer | €1,400 | 50% → €10,500 | 75% → €21,000 | 50% → €7,000 |
| **Phase subtotal (cost basis)** | | **~€121,875** | **~€162,000** | **~€59,000** |

### Fixed-Fee by Phase

| Phase | Scope | Duration | Avg FTE | Fixed Fee (EUR) |
|---|---|---|---|---|
| **Phase 1** | AWS infra, CDK, CI/CD, R4, R1, R3 initial, DB migration | 3 weeks | ~3.75 | **€125,000** |
| **Phase 2** | R2 restocking engine, R3 extension, data quality baseline | 4 weeks | ~4.25 | **€165,000** |
| **Phase 3** | D1 UI refresh, D2 i18n, D3 dark mode, go-live, KT | 2 weeks | ~2.5 | **€60,000** |
| **Total** | R1–R4, D1–D3, full AWS re-platform | **9 weeks** | | **€350,000** |

Fixed fees include a standard Big4 contingency buffer (~2.5%) to absorb minor scope variations within each phase without requiring a change request.

### Payment Schedule

| Milestone | % | Amount (EUR) |
|---|---|---|
| Contract signature | 20% | **€70,000** |
| Phase 1 sign-off | 30% | **€105,000** |
| Phase 2 sign-off | 30% | **€105,000** |
| Phase 3 sign-off + go-live | 20% | **€70,000** |

### Out-of-Scope Items (available as change requests)

| Item | Indicative Range |
|---|---|
| DB migration (if deferred beyond Phase 1) | €12,000–18,000 |
| Additional D1 revision rounds (beyond 1 included) | €4,500/round |
| CI/CD integration into Meridian's own pipeline | €8,000–12,000 |
| WCAG 2.1 AA accessibility audit + remediation | €15,000–22,000 |
| Checkmarx enterprise license (if not on Meridian EA) | ~€12,000/year standalone |
| Real-time event-driven inventory pipeline (EventBridge + Lambda) | €25,000–40,000 |
| Analytics layer (S3 + Athena + QuickSight) | €20,000–35,000 |

---

## 12. Risk Register (Updated)

| Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|
| R1 defect list exceeds 8 | Medium | Schedule | Upfront audit + agreed defect register before Phase 1 work begins |
| Data quality issues block R2 | Medium | Scope | Phase 2 data quality report before restocking engine development |
| Checkmarx scan blocks merge on legacy code | Medium | Velocity | Pre-engagement baseline scan; existing issues tracked separately from new-code gate |
| Aurora Serverless v2 cold-start latency | Low | UX | Minimum ACU = 0.5 (never fully pauses in prod); < 1s warm-start |
| D1 visual direction misalignment | Low | Rework | HTML prototype ratification gate before implementation |
| JSON data inconsistencies surface during migration | Medium | Timeline | Migration validation report reviewed with Meridian before repo swap |
| Tokyo locale review resource unavailable | Low | Quality | Machine translation with explicit caveat; native review in post-go-live sprint |

---

## 13. Engagement Governance

- Each phase closes with a written sign-off from J. Okafor or R. Tanaka.
- Weekly status report (Friday): work completed, blockers, next week plan, budget burn.
- Change requests: scoped, priced, and approved in writing before work begins.
- Security: Checkmarx scan reports shared with Meridian IT at phase close. Any HIGH finding from the engagement period is resolved before go-live; post-go-live findings are managed via a 30-day remediation SLA.
