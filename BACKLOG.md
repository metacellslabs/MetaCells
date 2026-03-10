# Backlog

## 1. Split UI Runtime From Execution Workers

Goal:
- Keep the browser and Meteor web app focused on editing, rendering, routing, and persistence orchestration only.
- Move long-running execution into worker processes that can scale independently.

Requirements:
- Meteor web process must not execute AI calls, file conversion, or channel polling inline.
- Worker processes must be able to run independently from the web process.
- Workbook edits must remain durable even if workers are offline.
- Execution results must be written back through stable persistence APIs, not direct ad hoc mutations.
- Worker startup/shutdown must not break the UI or corrupt workbook state.

## 2. Formalize Durable Job Architecture

Goal:
- Make all long-running work durable, observable, retryable, and safe across restarts and crashes.

Requirements:
- Separate collections or stores for:
  - jobs
  - job logs
  - dead-letter jobs
- Standard job states:
  - queued
  - leased
  - running
  - retrying
  - completed
  - failed
  - cancelled
- Every job type must define:
  - payload schema
  - idempotency strategy
  - retry policy
  - timeout policy
- Jobs must support dedupe keys.
- Jobs must support backoff and maximum attempts.
- Failed jobs must be inspectable after final failure.

## 3. Move Workers Out Of The Meteor Web Process

Status:
- Completed on 2026-03-10.

Goal:
- Prevent AI, conversion, and channel workloads from competing with HTTP/UI memory and CPU.

Requirements:
- Web app and worker app must be deployable separately.
- Workers must consume the same durable job format.
- Workers must support horizontal scaling with multiple instances.
- Worker crashes must not lose jobs.
- Web app must continue serving routes and subscriptions even if workers are degraded.

Delivered:
- Added explicit runtime roles:
  - `web`
  - `worker`
- Background startup is now role-gated by `METACELLS_ROLE`.
- Durable job execution now starts only in the worker process.
- Channel polling now starts only in the worker process.
- Added separate local commands for web and worker processes.
- The web process now remains focused on UI routes, methods, and publications.

## 4. Persist A Real Dependency Graph

Status:
- Completed on 2026-03-10.

Goal:
- Track exactly which cells, ranges, names, channels, attachments, and reports depend on which inputs.

Requirements:
- Persist dependency edges for:
  - cell -> cell
  - cell -> region
  - cell -> named ref
  - cell -> channel label
  - cell -> attachment
  - report -> mentioned refs
- Recompute triggers must use the persisted graph, not only runtime scans.
- Dependency graph must update after formula edits, renames, tab changes, and deletions.
- Missing dependencies must surface as stable user-facing errors like `#REF!`.

Delivered:
- Persisted dependency graph storage in workbook documents under `dependencyGraph.byCell`.
- Stored graph edges for:
  - cell -> referenced cells
  - cell -> named refs
  - cell -> channel labels
  - cell -> attachments
- Dependency collection now happens during real formula evaluation, including AI prompt preparation and mention resolution.
- Server recompute now walks the reverse dependency graph and recomputes only changed cells plus downstream dependents, with full recompute fallback when the graph is unavailable.

## 5. Add Incremental Invalidation And Recompute

Status:
- Completed on 2026-03-10.

Goal:
- Recompute only affected cells and outputs instead of whole sheets or whole workbooks.

Requirements:
- Dirty-state tracking per cell.
- Downstream dependent traversal from the dependency graph.
- Recompute only touched subgraphs when possible.
- Full recompute fallback must remain available for recovery/debugging.
- AI cells must only rerun when required dependencies or force-refresh flags change.

Delivered:
- Direct cell, named-ref, and channel changes now invalidate downstream formulas via the persisted dependency graph.
- Downstream formula cells are marked `stale` immediately on workbook save before recompute runs.
- Server compute now limits evaluation to the affected subgraph when dependency signals are available.
- Async AI completion invalidation now also uses the source-cell dependency path instead of broad recompute.
- Full recompute fallback remains in place when the graph is missing or the change cannot be narrowed safely.

## 6. Separate Hot, Warm, And Cold State

Goal:
- Reduce memory pressure and prevent large documents or caches from becoming bottlenecks.

Requirements:
- Hot state:
  - active jobs
  - locks
  - leases
  - current channel events
- Warm state:
  - workbook metadata
  - current computed values
  - dependency graph
- Cold state:
  - job history
  - old AI outputs
  - old channel events
  - audit logs
- Retention rules must exist for cold state.

## 7. Move Large Blobs Out Of Workbook Documents

Goal:
- Keep workbook documents small and fast to load, diff, and publish.

Requirements:
- Store large file payloads, conversion outputs, fetched URL bodies, and large AI outputs outside workbook documents.
- Workbook documents should keep only references plus compact metadata.
- Attachments must support:
  - filename
  - type
  - preview reference
  - content reference
- Blob storage strategy must support future migration to object storage.

## 8. Introduce Bounded Server Caches

Goal:
- Prevent silent memory growth from long-lived in-memory maps.

Requirements:
- Replace unbounded caches with TTL/LRU bounded caches.
- Apply bounded caching to:
  - provider/model metadata
  - fetched URL markdown
  - file conversion outputs
  - AI prompt/result cache
- Cache entries must include size limits and expiry rules.
- Cache misses must degrade safely, not break execution.

## 9. Add Versioned State For Async Safety

Goal:
- Prevent stale async results from overwriting newer workbook edits.

Requirements:
- Add versioning for:
  - workbook
  - cell
  - dependency graph
  - channel event state
- Jobs must record the versions they were created against.
- Job completion must validate versions before applying results.
- Stale job results must be discarded or requeued, not applied blindly.

## 10. Replace Ad Hoc Locks With Leases And Heartbeats

Goal:
- Make long-running work safe for multiple workers and crash recovery.

Requirements:
- Jobs must use time-bound leases, not permanent in-memory locks.
- Workers must renew leases while actively processing.
- Expired leases must be reclaimable by other workers.
- Channel polling must use the same lease model to avoid duplicate pollers.

## 11. Expand Registry-Driven Extensibility

Goal:
- Keep new functionality modular and discoverable without creating import tangles.

Requirements:
- Registry-driven modules for:
  - formulas
  - AI providers
  - channels
  - job handlers
  - file extractors
  - send actions
- Startup validation must continue to fail fast for broken modules.
- Registry metadata must be reused by settings/help/docs where relevant.

## 12. Add Operational Visibility

Goal:
- Make scaling and failure analysis possible without debugging through raw logs.

Requirements:
- Admin visibility for:
  - queue depth by job type
  - running jobs
  - retry rate
  - dead-letter count
  - worker heartbeats
  - memory-heavy caches
  - per-provider error rates
- Jobs and channel polling must emit structured logs.
- Add a small operational view in settings or a separate admin page.

## 13. Define A Broker-Abstraction Boundary

Goal:
- Make later migration from Mongo-backed jobs to RabbitMQ, SQS, Redis Streams, or another broker low-risk.

Requirements:
- Introduce a queue interface with operations like:
  - enqueue
  - lease
  - renew
  - complete
  - retry
  - fail
  - cancel
- Keep job handler execution independent from queue transport.
- Mongo implementation must remain one transport.
- Future broker implementations must be pluggable without rewriting job handlers.

## 14. Improve Channel Event Processing

Goal:
- Scale inbound channels without turning channel polling into a bottleneck.

Requirements:
- Channel events must be normalized before being injected into formulas.
- Polling and event ingestion must be decoupled from recompute execution.
- Support high-water marks like `lastSeenUid` or equivalent source offsets.
- Channel-triggered recalcs must use dependency graph lookups, not workbook-wide scans.
- Duplicate event delivery must be idempotent.

## 15. Improve File Processing Pipeline

Goal:
- Make file ingestion reliable for larger documents and future extractors.

Requirements:
- File upload, conversion, preview generation, and content extraction must be separate stages.
- Each stage must be a durable job or workflow step.
- Conversion failures must be retained with debug metadata.
- Large files must stream or chunk where possible instead of loading fully into memory.

## 16. Add Recovery And Maintenance Tooling

Goal:
- Provide safe operational recovery without manual database surgery.

Requirements:
- Admin actions for:
  - retry failed jobs
  - cancel stuck jobs
  - reset channel baseline to now
  - rebuild dependency graph
  - force workbook recompute
  - clear selected caches
- Recovery actions must be auditable.

## 17. Improve Test Architecture For Scale

Goal:
- Keep the system safe as more asynchronous and distributed behavior is added.

Requirements:
- Unit tests for:
  - formulas
  - registries
  - queue handlers
  - dependency graph logic
- Integration tests for:
  - AI jobs
  - file conversion jobs
  - channel event -> recalc flow
- Failure-mode tests for:
  - retries
  - stale result discard
  - worker crash recovery
  - duplicate event delivery

## 18. Recommended Execution Order

Goal:
- Sequence the architecture work to reduce risk.

Requirements:
- Phase 1:
  - durable jobs cleanup
  - separate worker process
  - operational visibility
- Phase 2:
  - dependency graph
  - incremental recompute
  - versioned async state
- Phase 3:
  - blob extraction from workbook documents
  - leases/heartbeats
  - richer file and channel workflows
- Phase 4:
  - broker abstraction
  - broker implementation migration if needed
