---
owner: search-team
status: draft
---

# Search Ranking Improvements

## Summary

Improves result relevance using signals from user engagement data.

## Requirements

- Incorporate click-through rate as a ranking signal
- Re-rank results within 500ms p99
- Degrade gracefully when signal data is unavailable

## API

| endpoint | method | description        |
| -------- | ------ | ------------------ |
| /v1/rank | POST   | Score a result set |
