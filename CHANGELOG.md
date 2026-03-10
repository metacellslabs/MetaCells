# Changelog

## 2026-03-10

### Added
- Persisted workbook dependency graph storage under `workbook.dependencyGraph.byCell`.
- Dependency edges for:
  - referenced cells
  - named refs
  - channel labels
  - attachment-backed cells
- Reverse-graph based targeted recompute for changed cells and downstream dependents.
- Regression tests for dependency graph persistence and affected-cell traversal.
- Incremental invalidation that marks downstream formulas stale on dependency changes.
- Regression test for downstream stale-state propagation.
- Explicit server runtime roles:
  - `web`
  - `worker`
- Dedicated startup scripts for web and worker processes.

### Changed
- Server compute now collects dependencies during actual formula evaluation instead of relying only on runtime-derived scans.
- Channel-triggered recompute now passes explicit channel dependency signals into server compute.
- Named-cell mapping changes now emit per-name dependency signals instead of only broad invalidation.
- Workbook saves now clear outdated per-cell dependency edges when a source changes.
- Server compute now invalidates only the affected dependency subgraph before recompute.
- Async AI completion invalidation now uses source-cell dependency signals to avoid broad recompute.
- Durable jobs now start only in the worker runtime.
- Channel polling now starts only in the worker runtime.
- The default app startup now runs in `web` mode.
- Local `start:worker` now attaches to the web dev Mongo instead of trying to start a second local Mongo from the same checkout.

### Verification
- `node --check` passed for:
  - [imports/api/sheets/server/compute.js](/Users/zentelechia/playground/thinker/imports/api/sheets/server/compute.js)
  - [imports/api/sheets/index.js](/Users/zentelechia/playground/thinker/imports/api/sheets/index.js)
  - [imports/api/sheets/workbook-codec.js](/Users/zentelechia/playground/thinker/imports/api/sheets/workbook-codec.js)
  - [imports/ui/metacell/runtime/formula-engine.js](/Users/zentelechia/playground/thinker/imports/ui/metacell/runtime/formula-engine.js)
  - [imports/ui/metacell/runtime/formula-engine/ai-methods.js](/Users/zentelechia/playground/thinker/imports/ui/metacell/runtime/formula-engine/ai-methods.js)
  - [imports/ui/metacell/runtime/formula-engine/mention-methods.js](/Users/zentelechia/playground/thinker/imports/ui/metacell/runtime/formula-engine/mention-methods.js)
  - [imports/ui/metacell/runtime/workbook-storage-adapter.js](/Users/zentelechia/playground/thinker/imports/ui/metacell/runtime/workbook-storage-adapter.js)
- `meteor test --once --port 3183 --driver-package meteortesting:mocha` is still blocked by the existing Rspack client panic:
  - `scope not loaded, run load first`
