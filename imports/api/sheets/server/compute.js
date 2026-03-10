import { FormulaEngine } from "../../../ui/metacell/runtime/formula-engine.js";
import { AIService } from "../../../ui/metacell/runtime/ai-service.js";
import { StorageService } from "../../../ui/metacell/runtime/storage-service.js";
import { GRID_COLS, GRID_ROWS } from "../../../ui/metacell/runtime/constants.js";
import { WorkbookStorageAdapter, createEmptyWorkbook } from "../../../ui/metacell/runtime/workbook-storage-adapter.js";

function columnIndexToLabel(index) {
  let n = index;
  let label = "";
  while (n > 0) {
    const rem = (n - 1) % 26;
    label = String.fromCharCode(65 + rem) + label;
    n = Math.floor((n - 1) / 26);
  }
  return label;
}

function columnLabelToIndex(label) {
  let result = 0;
  for (let i = 0; i < label.length; i += 1) {
    result = result * 26 + (label.charCodeAt(i) - 64);
  }
  return result;
}

function buildCellIds(workbookData) {
  const ids = [];
  let maxRow = GRID_ROWS;
  let maxCol = GRID_COLS;
  const workbook = workbookData && typeof workbookData === "object" ? workbookData : createEmptyWorkbook();
  const sheets = workbook.sheets && typeof workbook.sheets === "object" ? workbook.sheets : {};

  Object.keys(sheets).forEach((sheetId) => {
    const cells = sheets[sheetId] && typeof sheets[sheetId].cells === "object" ? sheets[sheetId].cells : {};
    Object.keys(cells).forEach((cellId) => {
      const match = /^([A-Za-z]+)([0-9]+)$/.exec(String(cellId || "").toUpperCase());
      if (!match) return;
      const col = columnLabelToIndex(match[1]);
      const row = parseInt(match[2], 10);
      if (!Number.isNaN(col) && col > maxCol) maxCol = col;
      if (!Number.isNaN(row) && row > maxRow) maxRow = row;
    });
  });

  for (let row = 1; row <= maxRow; row += 1) {
    for (let col = 1; col <= maxCol; col += 1) {
      ids.push(`${columnIndexToLabel(col)}${row}`);
    }
  }

  return ids;
}

class MemoryWorkbookStorage extends WorkbookStorageAdapter {}

function inferComputedCellState(rawValue, computedValue) {
  const raw = String(rawValue || "");
  const value = String(computedValue == null ? "" : computedValue);

  if (!raw) return "resolved";
  if (value.indexOf("#AI_ERROR:") === 0) return "error";
  if (raw.charAt(0) === "'" || raw.charAt(0) === ">" || raw.charAt(0) === "#") {
    if (value === "..." || value === "(manual: click Update)") return "pending";
    return "resolved";
  }
  if (raw.charAt(0) === "=") {
    if (value === "..." || value === "(manual: click Update)") return "pending";
    return "resolved";
  }
  return "resolved";
}

export async function computeSheetSnapshot({
  sheetDocumentId,
  workbookData,
  activeSheetId,
  persistWorkbook,
  forceRefreshAI = false,
}) {
  const rawStorage = new MemoryWorkbookStorage(workbookData);
  const storageService = new StorageService(rawStorage);
  const saveSnapshot = async (computedValues) => {
    if (typeof persistWorkbook !== "function") return;
    if (computedValues && activeSheetId) {
      Object.keys(computedValues).forEach((cellId) => {
        const rawValue = storageService.getCellValue(activeSheetId, cellId);
        storageService.setComputedCellValue(
          activeSheetId,
          cellId,
          computedValues[cellId],
          inferComputedCellState(rawValue, computedValues[cellId]),
        );
      });
    }
    await persistWorkbook(rawStorage.snapshot());
  };

  const aiService = new AIService(storageService, () => {
    saveSnapshot().catch((error) => {
      console.error("[sheet.compute] failed to persist async AI update", error);
    });
  }, {
    sheetDocumentId,
    getActiveSheetId: () => activeSheetId,
  });

  const formulaEngine = new FormulaEngine(
    storageService,
    aiService,
    () => storageService.readTabs(),
    buildCellIds(workbookData),
  );

  const values = {};
  const evaluationPlan = typeof formulaEngine.buildEvaluationPlan === "function"
    ? formulaEngine.buildEvaluationPlan(activeSheetId)
    : formulaEngine.cellIds;

  for (let i = 0; i < evaluationPlan.length; i += 1) {
    const cellId = evaluationPlan[i];
    try {
      values[cellId] = formulaEngine.evaluateCell(activeSheetId, cellId, {}, { forceRefreshAI });
    } catch (error) {
      values[cellId] = storageService.getCellValue(activeSheetId, cellId) || "";
    }
  }

  await saveSnapshot(values);
  return { values, workbook: rawStorage.snapshot() };
}
