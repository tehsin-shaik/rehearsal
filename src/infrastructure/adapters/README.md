# Adapter boundary

Each adapter implements the typed `ExecutionAdapter` port. `MemoryAdapters` provides the offline implementation; Gmail, Slack and tracker adapters return verified references from their configured services. `IdempotentAdapter` preserves confirmed or uncertain receipts. The remote browser client submits only server-owned run/action IDs; it does not choose executable parameters.

See [integration setup](../../../docs/INTEGRATIONS.md) for credentials, scopes, owner mappings, optional local services and current limits.
