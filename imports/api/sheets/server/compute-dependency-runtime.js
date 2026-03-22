import { FormulaEngine } from '../../../engine/formula-engine.js';
import { StorageService } from '../../../engine/storage-service.js';
import { GRID_COLS, GRID_ROWS } from '../../../engine/constants.js';
import {
  WorkbookStorageAdapter,
  createEmptyWorkbook,
} from '../../../engine/workbook-storage-adapter.js';

function columnIndexToLabel(index) {
  let n = index;
  let label = '';
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

export function buildCellIds(workbookData) {
  const ids = [];
  let maxRow = GRID_ROWS;
  let maxCol = GRID_COLS;
  const workbook =
    workbookData && typeof workbookData === 'object'
      ? workbookData
      : createEmptyWorkbook();
  const sheets =
    workbook.sheets && typeof workbook.sheets === 'object'
      ? workbook.sheets
      : {};

  Object.keys(sheets).forEach((sheetId) => {
    const cells =
      sheets[sheetId] && typeof sheets[sheetId].cells === 'object'
        ? sheets[sheetId].cells
        : {};
    Object.keys(cells).forEach((cellId) => {
      const match = /^([A-Za-z]+)([0-9]+)$/.exec(
        String(cellId || '').toUpperCase(),
      );
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

export function makeCellGraphKey(sheetId, cellId) {
  return `${String(sheetId || '')}:${String(cellId || '').toUpperCase()}`;
}

function buildChangedCellKeySet(changedSignals) {
  const result = {};
  const signals = Array.isArray(changedSignals) ? changedSignals : [];
  for (let i = 0; i < signals.length; i += 1) {
    const signal = signals[i] || {};
    if (signal.kind !== 'cell') continue;
    result[makeCellGraphKey(signal.sheetId, signal.cellId)] = true;
  }
  return result;
}

function buildReverseDependencyIndexes(byCell) {
  const dependentsByCell = {};
  const dependentsByNamedRef = {};
  const dependentsByChannel = {};
  const dependentsByAttachment = {};
  const register = (bucket, key, sourceKey) => {
    const normalizedKey = String(key || '');
    const normalizedSourceKey = String(sourceKey || '');
    if (!normalizedKey || !normalizedSourceKey) return;
    if (!Array.isArray(bucket[normalizedKey])) bucket[normalizedKey] = [];
    if (bucket[normalizedKey].indexOf(normalizedSourceKey) === -1) {
      bucket[normalizedKey].push(normalizedSourceKey);
    }
  };

  Object.keys(byCell || {}).forEach((sourceKey) => {
    const entry =
      byCell[sourceKey] && typeof byCell[sourceKey] === 'object'
        ? byCell[sourceKey]
        : {};
    (Array.isArray(entry.cells) ? entry.cells : []).forEach((item) => {
      if (!item || typeof item !== 'object') return;
      register(
        dependentsByCell,
        makeCellGraphKey(item.sheetId, item.cellId),
        sourceKey,
      );
    });
    (Array.isArray(entry.namedRefs) ? entry.namedRefs : []).forEach((name) => {
      register(dependentsByNamedRef, String(name || '').trim(), sourceKey);
    });
    (Array.isArray(entry.channelLabels) ? entry.channelLabels : []).forEach(
      (label) => {
        register(dependentsByChannel, String(label || '').trim(), sourceKey);
      },
    );
    (Array.isArray(entry.attachments) ? entry.attachments : []).forEach(
      (item) => {
        if (!item || typeof item !== 'object') return;
        register(
          dependentsByAttachment,
          makeCellGraphKey(item.sheetId, item.cellId),
          sourceKey,
        );
      },
    );
  });

  return {
    dependentsByCell,
    dependentsByNamedRef,
    dependentsByChannel,
    dependentsByAttachment,
  };
}

export function createDependencyCollector() {
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
      const normalizedSheetId = String(sheetId || '');
      const normalizedCellId = String(cellId || '').toUpperCase();
      if (!normalizedSheetId || !normalizedCellId) return;
      const key = `${normalizedSheetId}:${normalizedCellId}`;
      if (seenCells[key]) return;
      seenCells[key] = true;
      cells.push({ sheetId: normalizedSheetId, cellId: normalizedCellId });
    },
    addNamedRef(name) {
      const normalizedName = String(name || '').trim();
      if (!normalizedName || seenNamedRefs[normalizedName]) return;
      seenNamedRefs[normalizedName] = true;
      namedRefs.push(normalizedName);
    },
    addChannel(label) {
      const normalizedLabel = String(label || '').trim();
      if (!normalizedLabel || seenChannels[normalizedLabel]) return;
      seenChannels[normalizedLabel] = true;
      channelLabels.push(normalizedLabel);
    },
    addAttachment(sheetId, cellId) {
      const normalizedSheetId = String(sheetId || '');
      const normalizedCellId = String(cellId || '').toUpperCase();
      if (!normalizedSheetId || !normalizedCellId) return;
      const key = `${normalizedSheetId}:${normalizedCellId}`;
      if (seenAttachments[key]) return;
      seenAttachments[key] = true;
      attachments.push({
        sheetId: normalizedSheetId,
        cellId: normalizedCellId,
      });
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
  const workbook =
    workbookData && typeof workbookData === 'object' ? workbookData : {};
  const graph =
    workbook.dependencyGraph && typeof workbook.dependencyGraph === 'object'
      ? workbook.dependencyGraph
      : {};
  const byCell =
    graph.byCell && typeof graph.byCell === 'object' ? graph.byCell : {};
  const reverse = buildReverseDependencyIndexes(byCell);
  const dependentsByCell =
    graph.dependentsByCell && typeof graph.dependentsByCell === 'object'
      ? graph.dependentsByCell
      : reverse.dependentsByCell;
  const dependentsByNamedRef =
    graph.dependentsByNamedRef && typeof graph.dependentsByNamedRef === 'object'
      ? graph.dependentsByNamedRef
      : reverse.dependentsByNamedRef;
  const dependentsByChannel =
    graph.dependentsByChannel && typeof graph.dependentsByChannel === 'object'
      ? graph.dependentsByChannel
      : reverse.dependentsByChannel;
  const dependentsByAttachment =
    graph.dependentsByAttachment &&
    typeof graph.dependentsByAttachment === 'object'
      ? graph.dependentsByAttachment
      : reverse.dependentsByAttachment;
  return {
    byCell,
    dependentsByCell,
    dependentsByNamedRef,
    dependentsByChannel,
    dependentsByAttachment,
    meta:
      graph.meta && typeof graph.meta === 'object'
        ? graph.meta
        : { authoritative: false },
  };
}

export function isDependencyGraphAuthoritative(workbookData) {
  const graph = getWorkbookDependencyGraph(workbookData);
  return graph.meta && graph.meta.authoritative === true;
}

export function collectAffectedCellKeysFromSignals(
  workbookData,
  changedSignals,
) {
  const signals = Array.isArray(changedSignals) ? changedSignals : [];
  if (!signals.length) return null;

  const graph = getWorkbookDependencyGraph(workbookData);
  if (!graph || !Object.keys(graph.byCell).length) return null;
  if (!isDependencyGraphAuthoritative(workbookData)) return null;

  const reverseGraph = graph;
  const queue = [];
  const affected = {};

  const enqueue = (cellKey) => {
    const normalizedKey = String(cellKey || '');
    if (!normalizedKey || affected[normalizedKey]) return;
    affected[normalizedKey] = true;
    queue.push(normalizedKey);
  };

  for (let i = 0; i < signals.length; i += 1) {
    const signal = signals[i] || {};
    if (signal.kind === 'named-cells') return null;

    if (signal.kind === 'cell') {
      const signalKey = makeCellGraphKey(signal.sheetId, signal.cellId);
      enqueue(signalKey);
      const cellDependents = reverseGraph.dependentsByCell[signalKey] || [];
      const attachmentDependents =
        reverseGraph.dependentsByAttachment[signalKey] || [];
      cellDependents.forEach(enqueue);
      attachmentDependents.forEach(enqueue);
      continue;
    }

    if (signal.kind === 'named-ref') {
      const dependents =
        reverseGraph.dependentsByNamedRef[String(signal.name || '').trim()] ||
        [];
      dependents.forEach(enqueue);
      continue;
    }

    if (signal.kind === 'channel') {
      const dependents =
        reverseGraph.dependentsByChannel[String(signal.label || '').trim()] ||
        [];
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
  const affectedKeys = collectAffectedCellKeysFromSignals(
    workbookData,
    changedSignals,
  );
  if (!affectedKeys) return null;
  const bySheet = {};

  Object.keys(affectedKeys).forEach((cellKey) => {
    const separatorIndex = cellKey.indexOf(':');
    if (separatorIndex === -1) return;
    const sheetId = cellKey.slice(0, separatorIndex);
    const cellId = cellKey.slice(separatorIndex + 1);
    if (!bySheet[sheetId]) bySheet[sheetId] = {};
    bySheet[sheetId][cellId] = true;
  });

  return bySheet;
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
      const rawValue = String(
        storageService.getCellValue(sheetId, cellId) || '',
      );
      if (!rawValue) return;
      const sourceKey = makeCellGraphKey(sheetId, cellId);
      const isFormula = /^[='>#]/.test(rawValue);
      const isDirectlyChanged = !!changedCellKeys[sourceKey];
      const isExplicitAsyncFormula =
        rawValue.charAt(0) === "'" ||
        rawValue.charAt(0) === '>' ||
        rawValue.charAt(0) === '#' ||
        (rawValue.charAt(0) === '=' &&
          /(^|[^A-Za-z0-9_])(askAI|listAI|recalc|update)\s*\(/i.test(
            rawValue.substring(1),
          ));
      const clearsGeneratedResults =
        rawValue.charAt(0) === '>' ||
        rawValue.charAt(0) === '#' ||
        (rawValue.charAt(0) === '=' &&
          /(^|[^A-Za-z0-9_])(listAI|tableAI)\s*\(/i.test(
            rawValue.substring(1),
          ));

      if (isFormula) {
        if (clearsGeneratedResults) {
          storageService.clearGeneratedCellsBySource(sheetId, cellId);
        }
        const nextState = {
          state: 'stale',
          error: '',
        };
        if (isExplicitAsyncFormula) nextState.value = '';
        storageService.setCellRuntimeState(sheetId, cellId, nextState);
        return;
      }

      if (isDirectlyChanged) {
        storageService.setCellRuntimeState(sheetId, cellId, {
          value: rawValue,
          state: 'resolved',
          error: '',
        });
      }
    });
  });

  return rawStorage.snapshot();
}

export class MemoryWorkbookStorage extends WorkbookStorageAdapter {}

export function rebuildWorkbookDependencyGraph(
  workbookData,
  channelPayloads = {},
) {
  const rawStorage = new MemoryWorkbookStorage(workbookData);
  const storageService = new StorageService(rawStorage);
  const aiStub = {
    getMode() {
      return 'auto';
    },
    ask() {
      return '...';
    },
    list() {
      return ['...'];
    },
    askTable() {
      return [['...']];
    },
  };
  const tabs = storageService.readTabs();
  const formulaEngine = new FormulaEngine(
    storageService,
    aiStub,
    () => tabs,
    buildCellIds(rawStorage.snapshot()),
  );

  tabs
    .filter((tab) => tab && tab.type === 'sheet')
    .forEach((tab) => {
      const sheetId = String(tab.id || '');
      const cellRefs =
        typeof storageService.listAllCellIds === 'function'
          ? storageService.listAllCellIds(sheetId)
          : [];
      cellRefs.forEach((entry) => {
        const cellId = String((entry && entry.cellId) || '').toUpperCase();
        const rawValue = String(
          storageService.getCellValue(sheetId, cellId) || '',
        );
        if (!rawValue || !/^[='>#]/.test(rawValue)) {
          storageService.clearCellDependencies(sheetId, cellId);
          return;
        }
        const dependencyCollector = createDependencyCollector();
        try {
          formulaEngine.evaluateCell(
            sheetId,
            cellId,
            {},
            {
              forceRefreshAI: false,
              channelPayloads,
              dependencyCollector,
            },
          );
        } catch (error) {}
        storageService.setCellDependencies(
          sheetId,
          cellId,
          dependencyCollector.snapshot(),
        );
      });
    });

  rawStorage.markDependencyGraphAuthoritative(true, 'repair');
  return rawStorage.snapshot();
}
