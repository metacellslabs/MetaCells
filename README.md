# MetaCells

**MetaCells** is an open-source spreadsheet runtime for AI workflows, automations, files, and integrations.
![Demo](output.gif)
Instead of hiding logic in scripts, prompts, and backend glue code, **everything lives in cells**:

- formulas
- AI prompts
- files
- reports
- connectors
- actions

Your entire workflow becomes **visible, editable, and composable inside a spreadsheet**.

Think:

**Spreadsheets + AI agents + automations, in one open system.**

---

## Why MetaCells exists

AI workflows today are fragmented.

Logic lives across:

- prompts
- scripts
- cron jobs
- automation tools
- connectors
- backend glue code

MetaCells turns this into something simpler:

**a programmable spreadsheet where cells can think, compute, and act.**

---

## Example

A simple workbook might look like this:

```text
Input:@idea:[Describe your startup idea]
'Summarize the idea in one sentence: @idea
>top 10 user complaints about products like @idea
#compare @idea with competitors;4;6
/tg Launch update is live
/sf:send:{"to":"team@example.com","subj":"Status","body":"See @report"}
```

Each cell can:

- generate text
- produce lists
- create tables
- trigger actions
- feed other cells

Everything updates reactively.

---
## 🔥 Hot fixes wanted

<!-- featured-issues:start -->

### ui/ux

- [#3 Formula bar behavior](https://github.com/metacellslabs/MetaCells/issues/3)

### enhancement

- [#5 npm license compliance check](https://github.com/metacellslabs/MetaCells/issues/5)

<!-- featured-issues:end -->

## What you can build

MetaCells is a **runtime for AI-native workflows**.

### AI research notebooks

- summarize PDFs
- compare competitors
- generate structured insights

### Internal AI tools

- AI reports
- document processing
- automated analysis

### Automation workspaces

- process email
- react to Telegram messages
- generate reports
- trigger actions

### AI agents in spreadsheets

Cells can call AI, generate outputs, and pass results to other cells.

No hidden pipelines.

---

## Why developers fork MetaCells

MetaCells is designed to be **forkable infrastructure**.

You can extend it with:

- new formulas
- new AI providers
- new connectors
- custom workflow primitives

Developers fork MetaCells to build:

- internal AI tools
- automation systems
- research environments
- AI notebook platforms

If you ever wanted to build something like:

- Airtable for AI
- AI-native spreadsheets
- automation workbooks

MetaCells gives you the base runtime.

---

## Core ideas

### Cells are programmable

Cells are not just data.

They can be:

- prompts
- formulas
- reports
- file inputs
- integrations
- actions

### AI is a native cell operation

Example:

```text
'Write 3 launch taglines for @idea
```

### Tables spill automatically

```text
#compare @product with competitors;4;6
```

### Files become AI context

```text
File:@policy:[Upload policy PDF]
```

AI prompts can read the file automatically.

### Cells can trigger actions

```text
/tg Launch update is live
/sf:send:{"to":"team@example.com","subj":"Report","body":"See @summary"}
```

---

## How it works

MetaCells uses a spreadsheet-native computation model:

```text
data -> formulas -> prompts -> AI computation -> new data -> actions
```

Cells reference each other with:

```text
@cell
```

Everything updates reactively across the workbook.

---

## Quick start

### Run locally

Requirements:

- Node.js 20+
- Meteor 3.4+

Install Meteor:

```bash
curl https://install.meteor.com/ | sh
```

Install dependencies:

```bash
npm install
```

Start the app:

```bash
npm start
```

Open:

```text
http://localhost:3400
```

Optional worker for background jobs and connectors:

```bash
npm run start:worker
```

### Run with Electron

Electron is configured as a desktop shell for the Meteor app.

Development mode starts Meteor and Electron together:

```bash
npm run desktop:dev
```

If you already have the Meteor app running elsewhere, point Electron at that URL:

```bash
METACELLS_DESKTOP_URL=http://127.0.0.1:3400 npm run desktop:dev:frontend-only
```

### Build desktop packages

Install dependencies first:

```bash
npm install
```

Build a self-contained desktop app for the current host platform:

```bash
npm run desktop:dist
```

Build platform-specific self-contained packages:

```bash
npm run desktop:dist:mac
npm run desktop:dist:linux
npm run desktop:dist:win
```

Create an unpacked app directory without installers:

```bash
npm run desktop:pack
```

Artifacts are written to:

```text
dist/electron
```

These package commands now prepare a bundled local backend before packaging:

- Meteor server bundle
- Meteor Node runtime
- MongoDB server binary for the current host OS/architecture

The first packaging run may take longer because it downloads the MongoDB binary.

If you build a Meteor server bundle manually, write it outside the app source tree or keep `.meteorignore` in place. Otherwise Meteor may try to parse generated files under `_build/` as application source on the next `meteor run`.

### Run with Docker

```bash
docker compose up --build
```

Open:

```text
http://localhost:3400
```

## First 3 minutes

1. Open MetaCells.
2. Create a workbook.
3. Open `Settings`.
4. Add an AI provider.

Supported providers:

- OpenAI
- Groq
- DeepSeek
- OpenRouter
- Ollama
- LM Studio
- Together
- Fireworks
- xAI
