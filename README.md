# MetaCells

Meteor app for AI-assisted spreadsheets and reports.

## Structure Rule

This repo follows Meteor's application structure guidance:
- official guide: https://guide.meteor.com/structure

Practical rule for this app:
- keep eager entry points thin in `client/` and `server/`
- put startup wiring in `imports/startup/`
- group domain logic under `imports/api/<domain>/`
- keep UI and metacell runtime code under `imports/ui/`
- avoid adding new app logic at the repo root

## Runtime Roles

MetaCells supports two server roles:
- `web`
  - serves the app UI, methods, and publications
  - does not start background jobs or channel polling
- `worker`
  - runs durable jobs and IMAP/channel polling
  - should run as a separate process against the same Mongo database

Role is selected with:
- `METACELLS_ROLE=web`
- `METACELLS_ROLE=worker`

## Routes

- `/`
  - shows all saved metacells
- `/settings`
  - AI providers, channels, general, advanced
- `/metacell/:id`
  - opens a metacell
- `/metacell/:id/:sheetId`
  - opens a metacell and a specific tab
- legacy routes still resolve:
  - `/sheet/:id`
  - `/sheet/:id/:sheetId`

## Data Model

Collections:
- `sheets`
  - one document per metacell
  - source of truth is `workbook`
- `app_settings`
  - singleton settings document

Workbook data stores only populated state, including:
- tabs and active tab
- cells with source/value/state
- named cells
- row heights and column widths
- report content
- AI caches

## Project Layout

### Startup

- [client/main.jsx](/Users/zentelechia/playground/thinker/client/main.jsx)
  - thin Meteor client entry
- [server/main.js](/Users/zentelechia/playground/thinker/server/main.js)
  - thin Meteor server entry
- [imports/startup/client/index.jsx](/Users/zentelechia/playground/thinker/imports/startup/client/index.jsx)
  - renders the React app and loads client CSS
- [imports/startup/server/index.js](/Users/zentelechia/playground/thinker/imports/startup/server/index.js)
  - loads server API modules and starts either web or worker responsibilities
- [imports/startup/server/runtime-role.js](/Users/zentelechia/playground/thinker/imports/startup/server/runtime-role.js)
  - runtime role helpers for `web` vs `worker`

### UI

- [imports/ui/app/App.jsx](/Users/zentelechia/playground/thinker/imports/ui/app/App.jsx)
  - route switch for home, settings, and metacells
- [imports/ui/help/HelpOverlay.jsx](/Users/zentelechia/playground/thinker/imports/ui/help/HelpOverlay.jsx)
  - searchable help modal
- [imports/ui/help/helpContent.js](/Users/zentelechia/playground/thinker/imports/ui/help/helpContent.js)
  - structured help content
- [client/main.css](/Users/zentelechia/playground/thinker/client/main.css)
  - app styling

### Metacell Runtime

- [imports/ui/metacell/runtime/index.js](/Users/zentelechia/playground/thinker/imports/ui/metacell/runtime/index.js)
  - imperative spreadsheet/report controller
- [imports/ui/metacell/runtime/storage-service.js](/Users/zentelechia/playground/thinker/imports/ui/metacell/runtime/storage-service.js)
  - workbook persistence API used by the runtime
- [imports/ui/metacell/runtime/formula-engine.js](/Users/zentelechia/playground/thinker/imports/ui/metacell/runtime/formula-engine.js)
  - formula parsing and evaluation orchestration
- [imports/ui/metacell/runtime/grid-manager.js](/Users/zentelechia/playground/thinker/imports/ui/metacell/runtime/grid-manager.js)
  - grid rendering and interaction
- [imports/ui/metacell/runtime/ai-service.js](/Users/zentelechia/playground/thinker/imports/ui/metacell/runtime/ai-service.js)
  - client-side AI request coordination
- [imports/ui/metacell/runtime/workbook-storage-adapter.js](/Users/zentelechia/playground/thinker/imports/ui/metacell/runtime/workbook-storage-adapter.js)
  - in-memory workbook model for the runtime
- [imports/ui/metacell/sheetDocStorage.js](/Users/zentelechia/playground/thinker/imports/ui/metacell/sheetDocStorage.js)
  - adapter that flushes workbook snapshots to Mongo

### API Domains

- [imports/api/sheets/index.js](/Users/zentelechia/playground/thinker/imports/api/sheets/index.js)
  - collection, publications, methods, migration
- [imports/api/sheets/server/compute.js](/Users/zentelechia/playground/thinker/imports/api/sheets/server/compute.js)
  - server-side cell evaluation
- [imports/api/sheets/workbook-codec.js](/Users/zentelechia/playground/thinker/imports/api/sheets/workbook-codec.js)
  - workbook encode/decode and legacy migration helpers
- [imports/api/sheets/storage-codec.js](/Users/zentelechia/playground/thinker/imports/api/sheets/storage-codec.js)
  - safe key encoding helpers
- [imports/api/settings/index.js](/Users/zentelechia/playground/thinker/imports/api/settings/index.js)
  - AI provider and channel settings
- [imports/api/channels/connectors](/Users/zentelechia/playground/thinker/imports/api/channels/connectors)
  - file-based communication channel connector definitions
- [imports/api/channels/server/index.js](/Users/zentelechia/playground/thinker/imports/api/channels/server/index.js)
  - server-side channel test/send handlers and worker-side polling startup
- [imports/api/settings/providers](/Users/zentelechia/playground/thinker/imports/api/settings/providers)
  - file-based AI provider definitions and registry
- [imports/api/ai/index.js](/Users/zentelechia/playground/thinker/imports/api/ai/index.js)
  - server-side AI requests, queueing, dependency refresh, provider selection
- [imports/api/files/index.js](/Users/zentelechia/playground/thinker/imports/api/files/index.js)
  - file content extraction via the server-side converter binary

## Compute Flow

1. User edits a cell, report input, or attachment.
2. The client runtime updates its workbook snapshot.
3. The workbook is saved through `sheets.saveWorkbook`.
4. Server compute runs through `sheets.computeGrid`.
5. Returned computed values are rendered in the grid.
6. Async AI results persist back into Mongo and are republished.

The server is the source of truth for calculation and AI execution.

Background execution is worker-owned:
- the `web` process enqueues durable jobs
- the `worker` process executes AI jobs and channel polling
- workbook state remains durable in Mongo between processes

## Supported Cell Behavior

- plain values
- `=formula`
- `'prompt`
  - asks AI and shows the answer in the cell
- `>prompt`
  - asks AI for a list and spills rows below
- `#prompt`
  - asks AI for a table and spills rows/columns
- attachments
  - cell displays filename
  - formulas and mentions use extracted file content

Supported reference concepts:
- `A1`
- `Sheet 1!A1`
- `A1:B5`
- `@idea`
- `_@idea`
- `@@idea`
- `!@idea`
- `recalc(...)`
- `update(...)`

## Custom Formulas

File-based formulas live in:
- [imports/ui/metacell/runtime/formulas](/Users/zentelechia/playground/thinker/imports/ui/metacell/runtime/formulas)

Format:
- one formula per file
- export a definition with `defineFormula(...)`
- the definition is auto-discovered at startup through [imports/ui/metacell/runtime/formulas/index.js](/Users/zentelechia/playground/thinker/imports/ui/metacell/runtime/formulas/index.js)
- startup validation in [imports/startup/server/validate-formulas.js](/Users/zentelechia/playground/thinker/imports/startup/server/validate-formulas.js) scans the real formula files, computes file hashes, and fails app startup if a discovered formula file is broken or missing from the registry
- Help reads the same registry, so registered formulas appear in Help automatically

Definition shape:

```js
import { defineFormula } from "./definition.js";

export default defineFormula({
  name: "MYFORMULA",
  aliases: ["MY_ALIAS"],
  signature: "MYFORMULA(arg1, arg2)",
  summary: "Explain what the formula does.",
  examples: ["`=MYFORMULA(A1:A3, 2)`"],
  execute: ({ args, helpers, engine, sheetId, cellId, stack, options }) => {
    return "";
  },
});
```

Useful execution inputs:
- `args`
  - already evaluated formula arguments
- `helpers`
  - shared coercion and matrix helpers such as `toMatrix`, `flattenValues`, `toNumber`, `matchesCriteria`
- `engine`
  - current `FormulaEngine` instance if custom logic needs deeper access

How to add a new formula:
1. Create a new file in `imports/ui/metacell/runtime/formulas/`
2. Export a formula definition with `defineFormula(...)`
3. Restart the app
4. Startup validation checks the file schema, file hash coverage, and registry coverage
5. The formula becomes available in evaluation and in Help automatically

Built-in formulas included now:
- `SUM`
- `AVERAGE`
- `IF`
- `VLOOKUP`
- `XLOOKUP`
- `COUNT`
- `COUNTA`
- `COUNTIF`
- `LEN`
- `TRIM`
- `SUMIF`
- `INDEX`
- `TODAY`
- `DATEDIF`
- `FILTER`

## Reports

Report tabs support:
- rich text editing
- markdown rendering in view mode
- `Input:@cell:[Placeholder]`
- `File:@cell:[Hint]`
- live mentions to cells, regions, and named cells

## AI

AI runs only on the server.

Features:
- provider selection from settings
- DeepSeek and LM Studio support
- provider definitions are file-based and auto-discovered at startup
- queue with max 3 concurrent requests
- dedupe for identical queued tasks
- dependency-aware refresh for queued tasks
- retry on failure
- URL content fetching for AI prompt enrichment

## Custom Channels

File-based communication channel connectors live in:
- [imports/api/channels/connectors](/Users/zentelechia/playground/thinker/imports/api/channels/connectors)

Format:
- one connector definition per file
- export a definition with `defineChannelConnector(...)`
- definitions are auto-discovered at startup through [imports/api/channels/connectors/index.js](/Users/zentelechia/playground/thinker/imports/api/channels/connectors/index.js)
- startup validation in [imports/startup/server/validate-channel-connectors.js](/Users/zentelechia/playground/thinker/imports/startup/server/validate-channel-connectors.js) scans connector files, computes file hashes, and fails startup for broken or missing connector modules
- the settings UI and Help read the same connector registry, so discovered connectors appear automatically in `/settings` and Help

Connector definition shape:

```js
import { defineChannelConnector } from "./definition.js";

export default defineChannelConnector({
  id: "imap-email",
  type: "imap",
  name: "Email (IMAP + SMTP)",
  description: "Receive mailbox events over IMAP and send outbound mail over SMTP from the same channel.",
  packageName: "imapflow + nodemailer",
  supportsReceive: true,
  supportsSend: true,
  settingsFields: [
    { key: "label", label: "Channel label", type: "text", placeholder: "Inbox watcher", defaultValue: "Inbox watcher" },
    { key: "host", label: "IMAP host", type: "text", placeholder: "imap.example.com", defaultValue: "" },
    { key: "port", label: "IMAP port", type: "number", placeholder: "993", defaultValue: 993 },
    { key: "secure", label: "IMAP secure", type: "checkbox", defaultValue: true },
    { key: "username", label: "IMAP username", type: "text", placeholder: "user@example.com" },
    { key: "password", label: "IMAP password", type: "password", placeholder: "App password" },
    { key: "mailbox", label: "Mailbox", type: "text", placeholder: "INBOX", defaultValue: "INBOX" },
    { key: "smtpHost", label: "SMTP host", type: "text", placeholder: "smtp.example.com", defaultValue: "" },
    { key: "smtpPort", label: "SMTP port", type: "number", placeholder: "465", defaultValue: 465 },
    { key: "smtpSecure", label: "SMTP secure", type: "checkbox", defaultValue: true },
    { key: "smtpUsername", label: "SMTP username", type: "text", placeholder: "user@example.com", defaultValue: "" },
    { key: "smtpPassword", label: "SMTP password", type: "password", placeholder: "App password", defaultValue: "" },
    { key: "from", label: "From", type: "text", placeholder: "user@example.com", defaultValue: "" },
  ],
  sendParams: ["to", "subj", "body", "attachments"],
  mentioningFormulas: [
    ">summarize /sf in one sentence",
    "/channel1:send:message",
  ],
  help: [
    "Use /sf in formulas to bind logic to the latest received channel event and message payload.",
  ],
});
```

Server handlers are implemented separately in:
- `imports/api/channels/server/handlers/`

Expected connector server interface:
- `testConnection(settings)`
- `send({ settings, to, subj, body, attachments })`
- `poll(settings, runtimeState)` or equivalent receive logic for connectors with `supportsReceive`
- normalize inbound events into a payload that can be injected into `/channelLabel` mentions

Current IMAP receive flow:
- channel labels are mentioned as `/sf`
- the IMAP poller stores runtime fields like `lastSeenUid`, `lastEvent`, `lastEventAt`, `lastPolledAt`, and `watchError`
- polling currently runs on server startup and then every 30 seconds
- first poll sets a baseline at "now" and does not import old mailbox history
- formulas mentioning `/sf` are recomputed when a new event arrives, and `/sf` is replaced with the latest normalized email payload before the AI call

How to add a new connector:
1. Create a new definition file in `imports/api/channels/connectors/`
2. Implement the matching server handler in `imports/api/channels/server/handlers/`
3. Wire the handler in [imports/api/channels/server/index.js](/Users/zentelechia/playground/thinker/imports/api/channels/server/index.js)
4. Restart the app
5. Startup validation checks the connector schema, file hash coverage, and registry coverage
6. The connector appears in `/settings` and in Help automatically

Built-in channel connectors included now:
- `Email (IMAP + SMTP)` via `imapflow` and `nodemailer`

## Custom AI Providers

File-based AI providers live in:
- [imports/api/settings/providers](/Users/zentelechia/playground/thinker/imports/api/settings/providers)

Format:
- one provider per file
- export a definition with `defineAIProvider(...)`
- the definition is auto-discovered at startup through [imports/api/settings/providers/index.js](/Users/zentelechia/playground/thinker/imports/api/settings/providers/index.js)
- startup validation in [imports/startup/server/validate-ai-providers.js](/Users/zentelechia/playground/thinker/imports/startup/server/validate-ai-providers.js) scans provider files, computes file hashes, and fails startup for broken or missing provider modules
- the settings UI reads the same registry, so discovered providers show up there automatically

Definition shape:

```js
import { defineAIProvider } from "./definition.js";

export default defineAIProvider({
  id: "my-provider",
  name: "My Provider",
  type: "my_provider",
  baseUrl: "https://api.example.com/v1",
  model: "default-model",
  apiKey: "",
  enabled: true,
  availableModels: ["default-model", "fast-model"],
  fields: [
    { key: "baseUrl", label: "Base URL", type: "text", placeholder: "https://api.example.com/v1" },
    { key: "model", label: "Model", type: "text", placeholder: "default-model" },
    { key: "apiKey", label: "API key", type: "password", placeholder: "sk-..." },
  ],
});
```

How to add a new provider:
1. Create a new file in `imports/api/settings/providers/`
2. Export a provider definition with `defineAIProvider(...)`
3. Restart the app
4. Startup validation checks the provider schema, file hash coverage, and registry coverage
5. The provider appears in `/settings` automatically

Provider schema notes:
- `id`
  - stable persisted id used in settings
- `type`
  - provider family or transport type
- `name`
  - UI label in `/settings`
- `baseUrl`
  - API base URL
- `model`
  - default model when the user has not overridden it
- `apiKey`
  - default empty secret field; users fill this in `/settings`
- `availableModels`
  - optional suggested model list
- `fields`
  - dynamic settings form fields shown in `/settings`

Built-in providers included now:
- `DeepSeek`
- `LM Studio`

## File Extraction

Attachments are converted on the server with:
- [server/tools/file-converter/file-converter](/Users/zentelechia/playground/thinker/server/tools/file-converter/file-converter)

Converter notes:
- runtime code lives under `imports/`
- the binary stays under `server/tools/` as a server-side dependency

## Local Development

Run the web app:

```bash
npm run start:web
```

Run the worker:

```bash
npm run start:worker
```

Local worker note:
- `start:worker` reads the current Meteor dev Mongo port from `.meteor/local/db/METEOR-PORT`
- worker Mongo URL becomes `mongodb://127.0.0.1:<port-from-file>/meteor`
- start the web process first
- do not let the worker try to boot its own local Mongo from the same checkout
- start the web process first, so `.meteor/local/db/METEOR-PORT` exists and points at the active dev Mongo
- if you use a different Mongo, override `MONGO_URL` manually

Run tests:

```bash
meteor test --once --driver-package meteortesting:mocha
```

Current scripts:
- `npm run start`
  - same as `start:web`
- `npm run start:web`
  - runs `METACELLS_ROLE=web meteor run --port 3400`
- `npm run start:worker`
  - runs `MONGO_PORT=$(cat .meteor/local/db/METEOR-PORT) && MONGO_URL=mongodb://127.0.0.1:${MONGO_PORT}/meteor METACELLS_ROLE=worker meteor run --port 3410 --exclude-archs web.browser.legacy`
