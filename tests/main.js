import assert from "assert";

describe("metacells", function () {
  it("package.json has correct name", async function () {
    const { name } = await import("../package.json");
    assert.strictEqual(name, "metacells");
  });

  if (Meteor.isClient) {
    it("client is not server", function () {
      assert.strictEqual(Meteor.isServer, false);
    });
  }

  if (Meteor.isServer) {
    it("server is not client", function () {
      assert.strictEqual(Meteor.isClient, false);
    });

    it("builds a topological evaluation plan for same-sheet dependencies", async function () {
      const { FormulaEngine } = await import("../imports/ui/metacell/runtime/formula-engine.js");

      const cells = {
        A1: "seed",
        B1: "=A1",
        C1: "=B1",
        D1: "=C1",
      };
      const storageService = {
        getCellValue(sheetId, cellId) {
          return cells[cellId] || "";
        },
        getCellState() {
          return "resolved";
        },
        resolveNamedCell() {
          return null;
        },
      };
      const formulaEngine = new FormulaEngine(
        storageService,
        {},
        () => [{ id: "sheet-1", name: "Sheet 1", type: "sheet" }],
        ["A1", "B1", "C1", "D1"],
      );

      const plan = formulaEngine.buildEvaluationPlan("sheet-1");

      assert.deepStrictEqual(plan, ["A1", "B1", "C1", "D1"]);
    });

    it("falls back safely when dependency cycles exist", async function () {
      const { FormulaEngine } = await import("../imports/ui/metacell/runtime/formula-engine.js");

      const cells = {
        A1: "=B1",
        B1: "=A1",
        C1: "=B1",
      };
      const storageService = {
        getCellValue(sheetId, cellId) {
          return cells[cellId] || "";
        },
        getCellState() {
          return "resolved";
        },
        resolveNamedCell() {
          return null;
        },
      };
      const formulaEngine = new FormulaEngine(
        storageService,
        {},
        () => [{ id: "sheet-1", name: "Sheet 1", type: "sheet" }],
        ["A1", "B1", "C1"],
      );

      const plan = formulaEngine.buildEvaluationPlan("sheet-1");

      assert.strictEqual(plan.length, 3);
      assert.deepStrictEqual([...plan].sort(), ["A1", "B1", "C1"]);
      assert.strictEqual(plan[2], "C1");
    });

    it("saves workbook cell content in Mongo", async function () {
      const { Sheets } = await import("../imports/api/sheets/index.js");
      const { decodeWorkbookDocument } = await import("../imports/api/sheets/workbook-codec.js");

      const sheetId = await Meteor.server.method_handlers["sheets.create"].apply({}, ["Test Save Workbook"]);

      try {
        const workbook = {
          version: 1,
          tabs: [{ id: "sheet-1", name: "Sheet 1", type: "sheet" }],
          activeTabId: "sheet-1",
          aiMode: "auto",
          namedCells: {},
          sheets: {
            "sheet-1": {
              cells: {
                A1: {
                  source: "hello world",
                  sourceType: "raw",
                  value: "hello world",
                  state: "resolved",
                  generatedBy: "",
                  version: 1,
                },
              },
              columnWidths: {},
              rowHeights: {},
              reportContent: "",
            },
          },
          caches: {},
          globals: {},
        };

        await Meteor.server.method_handlers["sheets.saveWorkbook"].apply({}, [sheetId, workbook]);

        const saved = await Sheets.findOneAsync(sheetId);
        assert.ok(saved);
        assert.strictEqual(typeof saved.storage, "undefined");

        const decodedWorkbook = decodeWorkbookDocument(saved.workbook || {});
        assert.strictEqual(decodedWorkbook.sheets["sheet-1"].cells.A1.source, "hello world");
        assert.strictEqual(decodedWorkbook.sheets["sheet-1"].cells.A1.value, "hello world");
      } finally {
        await Sheets.removeAsync({ _id: sheetId });
      }
    });

    it("computes and persists formula cell values", async function () {
      const { Sheets } = await import("../imports/api/sheets/index.js");
      const { decodeWorkbookDocument } = await import("../imports/api/sheets/workbook-codec.js");

      const sheetId = await Meteor.server.method_handlers["sheets.create"].apply({}, ["Test Compute Workbook"]);

      try {
        const workbook = {
          version: 1,
          tabs: [{ id: "sheet-1", name: "Sheet 1", type: "sheet" }],
          activeTabId: "sheet-1",
          aiMode: "auto",
          namedCells: {},
          sheets: {
            "sheet-1": {
              cells: {
                A1: {
                  source: "alpha",
                  sourceType: "raw",
                  value: "alpha",
                  state: "resolved",
                  generatedBy: "",
                  version: 1,
                },
                B1: {
                  source: "=A1",
                  sourceType: "formula",
                  value: "",
                  state: "stale",
                  generatedBy: "",
                  version: 1,
                },
              },
              columnWidths: {},
              rowHeights: {},
              reportContent: "",
            },
          },
          caches: {},
          globals: {},
        };

        await Meteor.server.method_handlers["sheets.saveWorkbook"].apply({}, [sheetId, workbook]);
        const result = await Meteor.server.method_handlers["sheets.computeGrid"].apply({}, [sheetId, "sheet-1", {}]);

        assert.strictEqual(result.values.B1, "alpha");

        const saved = await Sheets.findOneAsync(sheetId);
        const decodedWorkbook = decodeWorkbookDocument(saved.workbook || {});
        assert.strictEqual(decodedWorkbook.sheets["sheet-1"].cells.B1.value, "alpha");
        assert.strictEqual(decodedWorkbook.sheets["sheet-1"].cells.B1.state, "resolved");
      } finally {
        await Sheets.removeAsync({ _id: sheetId });
      }
    });
  }
});
