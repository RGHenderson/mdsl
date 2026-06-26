---
status: active
---

# Database Failover

## Steps

### Promote replica

#### Command

pg_ctl promote -D /var/lib/postgresql/data

### Verify replication

#### Command

psql -c "SELECT pg_is_in_recovery();"
