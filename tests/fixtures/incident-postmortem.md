---
owner: search-oncall
reviewers:
  - carol
  - dave
severity: sev2
status: published
---

# Search Index Lag 2026-03-15

## Summary

On March 15th, search results were stale for 38 minutes due to an indexing pipeline backlog caused by an upstream schema migration.

## Rollback

Reverted the schema migration and flushed the indexing queue at 09:47 UTC.

## Timeline

### Detection

#### Timestamp

2026-03-15T09:09:00Z

#### Actor

Monitoring pipeline

#### Details

Alerting fired when index lag exceeded 60 seconds.

### Mitigation

#### Timestamp

2026-03-15T09:47:00Z

#### Actor

Oncall engineer

#### Details

Reverted schema migration and manually triggered queue flush.

## Impacted Services

- search-api
- recommendations-service
- browse-frontend

## Root Causes

### Schema migration applied without backfill

#### Analysis

The new field was added to the index schema but existing documents were not backfilled, causing the pipeline to stall on unrecognised records.

#### Contributing Factors

- Migration runbook did not include a backfill step
- Staging index contained insufficient document variety to surface the issue

## Action Items

### Add backfill step to migration runbook

#### Owner

search-team

#### Due Date

2026-04-01

#### Status

pending

### Expand staging index coverage

#### Owner

dev-tools-team

#### Due Date

2026-03-25

#### Status

done

## API Changes

| endpoint       | method | change                          | breaking |
| -------------- | ------ | ------------------------------- | -------- |
| /v1/search     | GET    | Added `fields` filter parameter | no       |
| /v1/index/bulk | POST   | Schema version header required  | yes      |

## Decisions

### Gate migrations behind feature flags

#### Context

The schema migration was applied globally without a gradual rollout.

#### Decision

All index schema migrations must be feature-flagged and rolled out progressively.

#### Consequences

- Additional flag management overhead per migration
- Safer rollout with per-cohort validation before full release
