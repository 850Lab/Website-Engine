# Distributed Campaign Execution

The Opportunity Engine supports distributed discovery execution with worker machines.

## Execution Modes

- Without `DATABASE_URL`: JSON-backed queue (`data/discovery-jobs.json` / `data/discovery-campaigns.json`)
- With `DATABASE_URL`: Postgres-backed queue + campaign store (`oe_jobs`, `oe_campaigns`)

## Start API Server

```bash
npm run server
```

## Start Worker

```bash
npm run worker
```

Optional worker environment:

- `WORKER_ID` custom worker identity
- `WORKER_API_KEY` required worker authentication key
- `CAMPAIGN_ID` lock worker to one campaign
- `WORKER_LEASE_SECONDS` lease duration (default `180`)
- `WORKER_HEARTBEAT_SECONDS` heartbeat interval (default `60`)
- `WORKER_IDLE_MS` idle poll sleep (default `5000`)

Server environment:

- `WORKER_API_KEY` single valid key, or
- `WORKER_API_KEYS` comma-separated valid keys

## API Endpoints (worker control)

- `POST /api/opportunity-engine/jobs/claim`
- `POST /api/opportunity-engine/jobs/:jobId/heartbeat`
- `POST /api/opportunity-engine/jobs/:jobId/complete`
- `POST /api/opportunity-engine/jobs/:jobId/fail`
- `GET /api/opportunity-engine/campaigns/:campaignId/jobs`

All worker job endpoints require either:

- `x-worker-key: <key>` or
- `Authorization: Bearer <key>`

## Idempotency + Locking

- Job idempotency key: `campaignId|city|industry|adapterId`
- Worker lease + heartbeat used for distributed claim/lock ownership
- Expired leases become claimable again
