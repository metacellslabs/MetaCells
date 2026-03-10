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

function makeCellGraphKey(sheetId, cellId) {
  return `${String(sheetId || "")}:${String(cellId || "").toUpperCase()}`;
}

function createDependencyCollector() {
  const cells = [];
  const namedRefs = [];
  const channelLabels = [];
  const attachments = [];
  const seenCells = {};
  const seenNamedRefs = {};
  const seenChannels = {};
  const seenAttachments = {};

  return {
    addCell(sheetId, cellId) {
      const normalizedSheetId = String(sheetId || "");
      const normalizedCellId = String(cellId || "").toUpperCase();
      if (!normalizedSheetId || !normalizedCellId) return;
      const key = `${normalizedSheetId}:${normalizedCellId}`;
      if (seenCells[key]) return;
      seenCells[key] = true;
      cells.push({ sheetId: normalizedSheetId, cellId: normalizedCellId });
    },
    addNamedRef(name) {
      const normalizedName = String(name || "").trim();
      if (!normalizedName || seenNamedRefs[normalizedName]) return;
      seenNamedRefs[normalizedName] = true;
      namedRefs.push(normalizedName);
    },
    addChannel(label) {
      const normalizedLabel = String(label || "").trim();
      if (!normalizedLabel || seenChannels[normalizedLabel]) return;
      seenChannels[normalizedLabel] = true;
      channelLabels.push(normalizedLabel);
    },
    addAttachment(sheetId, cellId) {
      const normalizedSheetId = String(sheetId || "");
      const normalizedCellId = String(cellId || "").toUpperCase();
      if (!normalizedSheetId || !normalizedCellId) return;
      const key = `${normalizedSheetId}:${normalizedCellId}`;
      if (seenAttachments[key]) return;
      seenAttachments[key] = true;
      attachments.push({ sheetId: normalizedSheetId, cellId: normalizedCellId });
    },
    snapshot() {
      return {
        cells,
        namedRefs,
        channelLabels,
        attachments,
      };
    },
  };
}

function getWorkbookDependencyGraph(workbookData) {
  const workbook = workbookData && typeof workbookData === "object" ? workbookData : {};
  const graph = workbook.dependencyGraph && typeof workbook.dependencyGraph === "object"
    ? workbook.dependencyGraph
    : {};
  const byCell = graph.byCell && typeof graph.byCell === "object" ? graph.byCell : {};
  return { byCell };
}

function buildReverseDependencyGraph(workbookData) {
  const graph = getWorkbookDependencyGraph(workbookData);
  const dependentsByCell = {};
  const dependentsByNamedRef = {};
  const dependentsByChannel = {};
  const dependentsByAttachment = {};

  Object.keys(graph.byCell).forEach((sourceKey) => {
    const entry = graph.byCell[sourceKey] && typeof graph.byCell[sourceKey] === "object" ? graph.byCell[sourceKey] : {};
    const register = (bucket, key) => {
      if (!key) return;
      if (!bucket[key]) bucket[key] = [];
      if (bucket[key].indexOf(sourceKey) === -1) {
        bucket[key].push(sourceKey);
      }
    };

    (Array.isArray(entry.cells) ? entry.cells : []).forEach((item) => {
      if (!item || typeof item !== "object") return;
      register(dependentsByCell, makeCellGraphKey(item.sheetId, item.cellId));
    });

    (Array.isArray(entry.namedRefs) ? entry.namedRefs : []).forEach((name) => {
      register(dependentsByNamedRef, String(name || "").trim());
    });

    (Array.isArray(entry.channelLabels) ? entry.channelLabels : []).forEach((label) => {
      register(dependentsByChannel, String(label || "").trim());
    });

    (Array.isArray(entry.attachments) ? entry.attachments : []).forEach((item) => {
      if (!item || typeof item !== "object") return;
      register(dependentsByAttachment, makeCellGraphKey(item.sheetId, item.cellId));
    });
  });

  return {
    dependentsByCell,
    dependentsByNamedRef,
    dependentsByChannel,
    dependentsByAttachment,
  };
}

export function collectAffectedCellKeysFromSignals(workbookData, changedSignals) {
  const signals = Array.isArray(changedSignals) ? changedSignals : [];
  if (!signals.length) return null;

  const graph = getWorkbookDependencyGraph(workbookData);
  if (!graph || !Object.keys(graph.byCell).length) return null;

  const reverseGraph = buildReverseDependencyGraph(workbookData);
  const queue = [];
  const affected = {};

  const enqueue = (cellKey) => {
    const normalizedKey = String(cellKey || "");
    if (!normalizedKey || affected[normalizedKey]) return;
    affected[normalizedKey] = true;
    queue.push(normalizedKey);
  };

  for (let i = 0; i < signals.length; i += 1) {
    const signal = signals[i] || {};
    if (signal.kind === "named-cells") return null;

    if (signal.kind === "cell") {
      const signalKey = makeCellGraphKey(signal.sheetId, signal.cellId);
      enqueue(signalKey);
      const cellDependents = reverseGraph.dependentsByCell[signalKey] || [];
      const attachmentDependents = reverseGraph.dependentsByAttachment[signalKey] || [];
      cellDependents.forEach(enqueue);
      attachmentDependents.forEach(enqueue);
      continue;
    }

    if (signal.kind === "named-ref") {
      const dependents = reverseGraph.dependentsByNamedRef[String(signal.name || "").trim()] || [];
      dependents.forEach(enqueue);
      continue;
    }

    if (signal.kind === "channel") {
      const dependents = reverseGraph.dependentsByChannel[String(signal.label || "").trim()] || [];
      dependents.forEach(enqueue);
      continue;
    }

    return null;
  }

  while (queue.length) {
    const currentKey = queue.shift();
    const downstream = reverseGraph.dependentsByCell[currentKey] || [];
    downstream.forEach(enqueue);
  }

  return affected;
}

export function buildTargetCellMap(workbookData, changedSignals) {
  const affectedKeys = collectAffectedCellKeysFromSignals(workbookData, changedSignals);
  if (!affectedKeys) return null;
  const bySheet = {};

  Object.keys(affectedKeys).forEach((cellKey) => {
    const separatorIndex = cellKey.indexOf(":");
    if (separatorIndex === -1) return;
    const sheetId = cellKey.slice(0, separatorIndex);
    const cellId = cellKey.slice(separatorIndex + 1);
    if (!bySheet[sheetId]) bySheet[sheetId] = {};
    bySheet[sheetId][cellId] = true;
  });

  return bySheet;
}

function buildChangedCellKeySet(changedSignals) {
  const signals = Array.isArray(changedSignals) ? changedSignals : [];
  const result = {};
  for (let i = 0; i < signals.length; i += 1) {
    const signal = signals[i] || {};
    if (signal.kind !== "cell") continue;
    result[makeCellGraphKey(signal.sheetId, signal.cellId)] = true;
  }
  return result;
}

export function invalidateWorkbookDependencies(workbookData, changedSignals) {
  const targetCellMap = buildTargetCellMap(workbookData, changedSignals);
  if (!targetCellMap) {
    return workbookData;
  }

  const rawStorage = new MemoryWorkbookStorage(workbookData);
  const storageService = new StorageService(rawStorage);
  const changedCellKeys = buildChangedCellKeySet(changedSignals);

  Object.keys(targetCellMap).forEach((sheetId) => {
    const targetCells = targetCellMap[sheetId] || {};
    Object.keys(targetCells).forEach((cellId) => {
      const rawValue = String(storageService.getCellValue(sheetId, cellId) || "");
      if (!rawValue) return;
      const sourceKey = makeCellGraphKey(sheetId, cellId);
      const isFormula = /^[='>#]/.test(rawValue);
      const isDirectlyChanged = !!changedCellKeys[sourceKey];

      if (isFormula) {
        storageService.setCellRuntimeState(sheetId, cellId, {
          state: "stale",
          error: "",
        });
        return;
      }

      if (isDirectlyChanged) {
        storageService.setCellRuntimeState(sheetId, cellId, {
          value: rawValue,
          state: "resolved",
          error: "",
        });
      }
    });
  });

  return rawStorage.snapshot();
}

class MemoryWorkbookStorage extends WorkbookStorageAdapter {}

function inferComputedCellState(rawValue, computedValue) {
  const raw = String(rawValue || "");
  const value = String(computedValue == null ? "" : computedValue);

  if (!raw) return "resolved";
  if (value === "#REF!" || value === "#ERROR" || value === "#SELECT_FILE") return "error";
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

function normalizeComputeError(error) {
  const message = error && error.message ? String(error.message) : String(error || "Formula error");
  return message || "Formula error";
}

function classifyComputeFailure(error) {
  const message = normalizeComputeError(error);
  if (/^Unknown sheet:/i.test(message) || /^Unknown cell name:/i.test(message)) {
    return {
      value: "#REF!",
      error: message,
    };
  }
  if (message === "#SELECT_FILE" || /^#SELECT_FILE\b/i.test(message)) {
    return {
      value: "#SELECT_FILE",
      error: "Select a file first",
    };
  }
  return {
    value: "#ERROR",
    error: message,
  };
}

export async function computeSheetSnapshot({
  sheetDocumentId,
  workbookData,
  activeSheetId,
  persistWorkbook,
  channelPayloads = {},
  forceRefreshAI = false,
  changedSignals = [],
}) {
  const invalidatedWorkbook = invalidateWorkbookDependencies(workbookData, changedSignals);
  const rawStorage = new MemoryWorkbookStorage(invalidatedWorkbook);
  const storageService = new StorageService(rawStorage);
  const tabs = storageService.readTabs();
  const sheetTabIds = tabs
    .filter((tab) => tab && tab.type === "sheet")
    .map((tab) => String(tab.id || ""))
    .filter(Boolean);
  const orderedSheetIds = [];

  if (activeSheetId && sheetTabIds.indexOf(activeSheetId) !== -1) {
    orderedSheetIds.push(activeSheetId);
  }
  for (let i = 0; i < sheetTabIds.length; i += 1) {
    if (orderedSheetIds.indexOf(sheetTabIds[i]) === -1) {
      orderedSheetIds.push(sheetTabIds[i]);
    }
  }

  const saveSnapshot = async (computedValues, computedErrors) => {
    if (typeof persistWorkbook !== "function") return;
    if (computedValues && typeof computedValues === "object") {
      Object.keys(computedValues).forEach((sheetId) => {
        const sheetValues = computedValues[sheetId];
        if (!sheetValues || typeof sheetValues !== "object") return;
        Object.keys(sheetValues).forEach((cellId) => {
          const rawValue = storageService.getCellValue(sheetId, cellId);
          const errorMessage = computedErrors
            && computedErrors[sheetId]
            && Object.prototype.hasOwnProperty.call(computedErrors[sheetId], cellId)
            ? computedErrors[sheetId][cellId]
            : "";
          storageService.setComputedCellValue(
            sheetId,
            cellId,
            sheetValues[cellId],
            inferComputedCellState(rawValue, sheetValues[cellId]),
            errorMessage,
          );
        });
      });
    }
    await persistWorkbook(rawStorage.snapshot());
  };

  const aiService = new AIService(storageService, (queueMeta) => {
    const asyncComputedValues = {};
    const asyncComputedErrors = {};
    const asyncChangedSignals = queueMeta && queueMeta.sourceCellId
      ? [{
          kind: "cell",
          sheetId: String(queueMeta.activeSheetId || activeSheetId || ""),
          cellId: String(queueMeta.sourceCellId || "").toUpperCase(),
        }]
      : [];
    const asyncTargetCellMap = forceRefreshAI ? null : buildTargetCellMap(rawStorage.snapshot(), asyncChangedSignals);
    for (let i = 0; i < orderedSheetIds.length; i += 1) {
      const sheetId = orderedSheetIds[i];
      const evaluationPlan = typeof formulaEngine.buildEvaluationPlan === "function"
        ? formulaEngine.buildEvaluationPlan(sheetId)
        : formulaEngine.cellIds;
      const targetCells = asyncTargetCellMap && asyncTargetCellMap[sheetId] ? asyncTargetCellMap[sheetId] : null;
      asyncComputedValues[sheetId] = {};
      asyncComputedErrors[sheetId] = {};
      for (let cellIndex = 0; cellIndex < evaluationPlan.length; cellIndex += 1) {
        const cellId = evaluationPlan[cellIndex];
        if (asyncTargetCellMap && !targetCells?.[cellId]) {
          continue;
        }
        try {
          asyncComputedValues[sheetId][cellId] = formulaEngine.evaluateCell(sheetId, cellId, {}, {
            forceRefreshAI,
            channelPayloads,
          });
        } catch (error) {
          const failure = classifyComputeFailure(error);
          asyncComputedValues[sheetId][cellId] = failure.value;
          asyncComputedErrors[sheetId][cellId] = failure.error;
        }
      }
    }
    saveSnapshot(asyncComputedValues, asyncComputedErrors).catch((error) => {
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
    buildCellIds(invalidatedWorkbook),
  );

  const valuesBySheet = {};
  const errorsBySheet = {};
  const dependenciesBySheet = {};
  const targetCellMap = forceRefreshAI ? null : buildTargetCellMap(workbookData, changedSignals);

  for (let sheetIndex = 0; sheetIndex < orderedSheetIds.length; sheetIndex += 1) {
    const sheetId = orderedSheetIds[sheetIndex];
    const sheetValues = {};
    const sheetErrors = {};
    const sheetDependencies = {};
    const evaluationPlan = typeof formulaEngine.buildEvaluationPlan === "function"
      ? formulaEngine.buildEvaluationPlan(sheetId)
      : formulaEngine.cellIds;
    const targetCells = targetCellMap && targetCellMap[sheetId] ? targetCellMap[sheetId] : null;

    for (let i = 0; i < evaluationPlan.length; i += 1) {
      const cellId = evaluationPlan[i];
      if (targetCellMap && !targetCells?.[cellId]) {
        continue;
      }
      const dependencyCollector = createDependencyCollector();
      try {
        sheetValues[cellId] = formulaEngine.evaluateCell(sheetId, cellId, {}, {
          forceRefreshAI,
          channelPayloads,
          dependencyCollector,
        });
        sheetDependencies[cellId] = dependencyCollector.snapshot();
      } catch (error) {
        const failure = classifyComputeFailure(error);
        sheetValues[cellId] = failure.value;
        sheetErrors[cellId] = failure.error;
        sheetDependencies[cellId] = dependencyCollector.snapshot();
      }
    }

    valuesBySheet[sheetId] = sheetValues;
    errorsBySheet[sheetId] = sheetErrors;
    dependenciesBySheet[sheetId] = sheetDependencies;
  }

  if (Object.keys(valuesBySheet).length) {
    Object.keys(dependenciesBySheet).forEach((sheetId) => {
      const sheetDeps = dependenciesBySheet[sheetId] || {};
      Object.keys(sheetDeps).forEach((cellId) => {
        storageService.setCellDependencies(sheetId, cellId, sheetDeps[cellId]);
      });
    });
  }

  await saveSnapshot(valuesBySheet, errorsBySheet);
  return { values: valuesBySheet[activeSheetId] || {}, valuesBySheet, workbook: rawStorage.snapshot() };
}
