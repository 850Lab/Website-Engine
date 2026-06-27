# 18 — Performance

**Status:** Constitution · Scaling and cost philosophy  
**Related:** [Design Principles](./11-design-principles.md) · [AI Agents](./12-ai-agents.md) · [Phase 2 Roadmap](./01-roadmap.md#phase-2--live-signal-engine)

**Goal:** Scale from one founder to national monitoring **without** linear LLM cost growth.

---

## Core Philosophy

```
Rules before AI
  → Embeddings before LLM
    → Small models before frontier
      → Batch before real-time
        → Cache before recompute
```

Cost control is **architecture**, not an ops afterthought.

---

## Tiered Processing Pipeline

| Tier | Method | Use for |
|---|---|---|
| **0** | Rules, regex, calendars, hash dedup | 60–80% of signals |
| **1** | Embeddings similarity, classifiers | Dedup, entity match, near-dup news |
| **2** | Small LLM / mini models | Extraction templates, summaries |
| **3** | Frontier LLM | Multi-hop problem inference, strategy |

**Default:** New connectors start at Tier 0–1 only.

---

## Caching

| Cache | Key | TTL |
|---|---|---|
| Raw capture | `contentHash` | Permanent (immutable) |
| Company profile | `entityId` + version | Until new signal affects entity |
| Website analysis | `url` + content hash | 7–30 days |
| Radar projection | `ceoMode` + data version | Minutes–hours |
| Score vector | `opportunityId` + input hash | Until underlying facts change |

**Rule:** Execution AI reads cache first — never re-research from scratch per email.

---

## Embeddings

| Use | Reduces |
|---|---|
| Signal dedup | Duplicate LLM extractions |
| Entity resolution | Wrong-company opportunities |
| Playbook RAG | Prompt size for Scribe/Planner |
| Similar win retrieval | Economist/Strategist input tokens |
| Problem clustering | Reasoning fan-out duplication |

**Storage:** Vector index — [Data Model](./14-data-model.md)

---

## Batching

| Job | Schedule |
|---|---|
| Full score council recompute | Nightly for non-delta entities |
| Signal extraction backfill | Off-peak batches |
| Learning calibration | Weekly |
| Forecast training | Weekly / monthly |
| Radar materialized view | Every 5–15 min or on event |

**Sync (user waits):** CEO drill-down, single plan approval, mode switch — reads **materialized** projections only.

---

## Asynchronous Processing

| Async | Sync |
|---|---|
| All ingestion | Mode switch UI |
| Fact extraction at scale | Single opportunity detail (cached) |
| Problem fan-out | Approve/send one action |
| Forecast generation | Evidence drill-down (preassembled) |
| Learning jobs | |

Event spine (Phase 2+): publish/subscribe between stages — [API Boundaries](./15-api-boundaries.md).

---

## Knowledge Graph Indexing

| Query pattern | Index strategy |
|---|---|
| Opportunity → evidence subgraph | Adjacency + precomputed evidence bundles |
| Entity neighborhood | Graph index |
| Similar problems | Embedding cluster ID on Problem node |
| Precursor patterns | Warehouse feature tables (Phase 5) |

**Do not:** Run full graph traversal per HTTP request without bounds (max depth, max nodes).

---

## Opportunity Radar Performance

| Scale | Strategy |
|---|---|
| Founder (500 entities) | In-memory engine acceptable |
| 10K entities | Tiered scoring — full LLM on top 5% only |
| 1M entities | Regional partitions + incremental delta scoring |
| Enterprise | Materialized radar per region × CEO mode |

Today: `buildOpportunityRadar()` loads all businesses — **must evolve** before LARGE scale.

---

## Cost Control Without Reducing Capability

1. **Score tiering** — cheap engines for all; expensive for top N  
2. **Incremental updates** — re-score on signal delta, not full corpus  
3. **Evidence bundles** — precompute at opportunity creation  
4. **Connector prioritization** — high-ROI sources first  
5. **Autonomy batching** — queue drafts; human batch approve  

See prior infrastructure cost model discussions in project records.

---

## Observability

Track per phase:
- Tokens per opportunity created  
- Signals per LLM call  
- Cache hit rate  
- Radar latency (p50, p95)  
- Cost per won outcome  

Alert when LLM tier exceeds budget threshold for source type.

---

## Anti-Patterns

- LLM on every signal by default  
- Real-time full corpus rescoring  
- Unbounded graph traversal in request path  
- Regenerating research context per task  

See [Architecture Rules R15](./07-architecture-rules.md).
