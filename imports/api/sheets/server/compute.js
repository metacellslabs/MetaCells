import { FormulaEngine } from '../../../engine/formula-engine.js';
import { AIService } from '../../../ui/metacell/runtime/ai-service.js';
import { StorageService } from '../../../engine/storage-service.js';
import {
  buildCellIds,
  buildTargetCellMap,
  createDependencyCollector,
  invalidateWorkbookDependencies,
  isDependencyGraphAuthoritative,
  MemoryWorkbookStorage,
  rebuildWorkbookDependencyGraph,
} from './compute-dependency-runtime.js';

export {
  collectAffectedCellKeysFromSignals,
  buildTargetCellMap,
  invalidateWorkbookDependencies,
  isDependencyGraphAuthoritative,
  rebuildWorkbookDependencyGraph,
} from './compute-dependency-runtime.js';

const COMPUTE_ENGINE_SIGNATURE_VERSION = '2026-03-21-formula-coercion-1';

function inferComputedCellState(rawValue, computedValue) {
  const raw = String(rawValue || '');
  const value = String(computedValue == null ? '' : computedValue);

  if (!raw) return 'resolved';
  if (value === '#REF!' || value === '#ERROR' || value === '#SELECT_FILE')
    return 'error';
  if (value.indexOf('#AI_ERROR:') === 0) return 'error';
  if (raw.charAt(0) === "'" || raw.charAt(0) === '>' || raw.charAt(0) === '#') {
    if (value === '...' || value === '(manual: click Update)') return 'pending';
    return 'resolved';
  }
  if (raw.charAt(0) === '=') {
    if (value === '...' || value === '(manual: click Update)') return 'pending';
    return 'resolved';
  }
  return 'resolved';
}

function normalizeComputeError(error) {
  const message =
    error && error.message
      ? String(error.message)
      : String(error || 'Formula error');
  return message || 'Formula error';
}

function classifyComputeFailure(error) {
  const message = normalizeComputeError(error);
  if (
    /^Unknown sheet:/i.test(message) ||
    /^Unknown cell name:/i.test(message)
  ) {
    return {
      value: '#REF!',
      error: message,
    };
  }
  if (message === '#SELECT_FILE' || /^#SELECT_FILE\b/i.test(message)) {
    return {
      value: '#SELECT_FILE',
      error: 'Select a file first',
    };
  }
  return {
    value: '#ERROR',
    error: message,
  };
}

function buildProcessedChannelEventIds(dependencies, channelPayloads) {
  const result = {};
  const entry =
    dependencies && typeof dependencies === 'object' ? dependencies : {};
  const labels = Array.isArray(entry.channelLabels) ? entry.channelLabels : [];
  const payloads =
    channelPayloads && typeof channelPayloads === 'object'
      ? channelPayloads
      : {};

  labels.forEach((label) => {
    const key = String(label || '').trim();
    const payload = payloads[key];
    const eventId =
      payload && (payload.eventId || payload._id)
        ? String(payload.eventId || payload._id)
        : '';
    if (!key || !eventId) return;
    result[key] = eventId;
  });

  return result;
}

function buildDependencySignature(
  storageService,
  dependencies,
  channelPayloads,
) {
  const entry =
    dependencies && typeof dependencies === 'object' ? dependencies : {};
  const payloads =
    channelPayloads && typeof channelPayloads === 'object'
      ? channelPayloads
      : {};
  const normalized = {
    engineVersion: COMPUTE_ENGINE_SIGNATURE_VERSION,
    cells: [],
    namedRefs: [],
    channelLabels: [],
    attachments: [],
  };

  (Array.isArray(entry.cells) ? entry.cells : []).forEach((item) => {
    if (!item || typeof item !== 'object') return;
    const versionInfo = storageService.getCellVersionInfo(
      item.sheetId,
      item.cellId,
    );
    normalized.cells.push({
      sheetId: String(item.sheetId || ''),
      cellId: String(item.cellId || '').toUpperCase(),
      sourceVersion: Number(versionInfo.sourceVersion) || 0,
      computedVersion: Number(versionInfo.computedVersion) || 0,
      dependencyVersion: Number(versionInfo.dependencyVersion) || 0,
    });
  });

  (Array.isArray(entry.attachments) ? entry.attachments : []).forEach(
    (item) => {
      if (!item || typeof item !== 'object') return;
      const versionInfo = storageService.getCellVersionInfo(
        item.sheetId,
        item.cellId,
      );
      normalized.attachments.push({
        sheetId: String(item.sheetId || ''),
        cellId: String(item.cellId || '').toUpperCase(),
        sourceVersion: Number(versionInfo.sourceVersion) || 0,
        computedVersion: Number(versionInfo.computedVersion) || 0,
      });
    },
  );

  (Array.isArray(entry.namedRefs) ? entry.namedRefs : []).forEach((name) => {
    const normalizedName = String(name || '').trim();
    if (!normalizedName) return;
    const resolved = storageService.resolveNamedCell(normalizedName) || null;
    normalized.namedRefs.push({
      name: normalizedName,
      target: resolved ? JSON.stringify(resolved) : '',
    });
  });

  (Array.isArray(entry.channelLabels) ? entry.channelLabels : []).forEach(
    (label) => {
      const normalizedLabel = String(label || '').trim();
      if (!normalizedLabel) return;
      const payload = payloads[normalizedLabel] || null;
      normalized.channelLabels.push({
        label: normalizedLabel,
        eventId:
          payload && (payload.eventId || payload._id)
            ? String(payload.eventId || payload._id)
            : '',
      });
    },
  );

  return JSON.stringify(normalized);
}

function canReuseComputedCell(
  storageService,
  sheetId,
  cellId,
  rawValue,
  dependencySignature,
  forceRefreshAI,
) {
  const raw = String(rawValue || '');
  if (!raw || !/^[='>#]/.test(raw)) return false;
  if (forceRefreshAI) return false;
  const state = String(storageService.getCellState(sheetId, cellId) || '');
  if (state !== 'resolved') return false;
  const value = String(
    storageService.getCellComputedValue(sheetId, cellId) || '',
  );
  if (!value) return false;
  const versionInfo = storageService.getCellVersionInfo(sheetId, cellId);
  return (
    String(versionInfo.dependencySignature || '') ===
    String(dependencySignature || '')
  );
}

export async function computeSheetSnapshot({
  sheetDocumentId,
  workbookData,
  activeSheetId,
  persistWorkbook,
  channelPayloads = {},
  forceRefreshAI = false,
  manualTriggerAI = false,
  changedSignals = [],
}) {
  const invalidatedWorkbook = invalidateWorkbookDependencies(
    workbookData,
    changedSignals,
  );
  const rawStorage = new MemoryWorkbookStorage(invalidatedWorkbook);
  const storageService = new StorageService(rawStorage);
  const tabs = storageService.readTabs();
  const sheetTabIds = tabs
    .filter((tab) => tab && tab.type === 'sheet')
    .map((tab) => String(tab.id || ''))
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

  const saveSnapshot = async (
    computedValues,
    computedErrors,
    computedProcessedEventIds,
  ) => {
    if (typeof persistWorkbook !== 'function') return;
    if (computedValues && typeof computedValues === 'object') {
      Object.keys(computedValues).forEach((sheetId) => {
        const sheetValues = computedValues[sheetId];
        if (!sheetValues || typeof sheetValues !== 'object') return;
        Object.keys(sheetValues).forEach((cellId) => {
          const rawValue = storageService.getCellValue(sheetId, cellId);
          const errorMessage =
            computedErrors &&
            computedErrors[sheetId] &&
            Object.prototype.hasOwnProperty.call(
              computedErrors[sheetId],
              cellId,
            )
              ? computedErrors[sheetId][cellId]
              : '';
          storageService.setComputedCellValue(
            sheetId,
            cellId,
            sheetValues[cellId],
            inferComputedCellState(rawValue, sheetValues[cellId]),
            errorMessage,
            {
              displayValue: storageService.getCellDisplayValue(sheetId, cellId),
            },
          );
          if (
            computedProcessedEventIds &&
            computedProcessedEventIds[sheetId] &&
            Object.prototype.hasOwnProperty.call(
              computedProcessedEventIds[sheetId],
              cellId,
            )
          ) {
            storageService.setCellRuntimeState(sheetId, cellId, {
              lastProcessedChannelEventIds:
                computedProcessedEventIds[sheetId][cellId],
            });
          }
        });
      });
    }
    await persistWorkbook(rawStorage.snapshot());
  };

  const aiService = new AIService(
    storageService,
    async (queueMeta) => {
      const asyncComputedValues = {};
      const asyncComputedErrors = {};
      const asyncProcessedEventIds = {};
      const asyncDependenciesBySheet = {};
      const sourceSheetId =
        queueMeta && queueMeta.sourceCellId
          ? String(queueMeta.activeSheetId || activeSheetId || '')
          : '';
      const sourceCellId =
        queueMeta && queueMeta.sourceCellId
          ? String(queueMeta.sourceCellId || '').toUpperCase()
          : '';
      const asyncChangedSignals =
        queueMeta && queueMeta.sourceCellId
          ? [
              {
                kind: 'cell',
                sheetId: sourceSheetId,
                cellId: sourceCellId,
              },
            ]
          : [];
      if (sourceSheetId && sourceCellId) {
        asyncComputedValues[sourceSheetId] = {};
        asyncComputedErrors[sourceSheetId] = {};
        asyncProcessedEventIds[sourceSheetId] = {};
        asyncDependenciesBySheet[sourceSheetId] = {};
        const sourceDependencyCollector = createDependencyCollector();
        const sourceRuntimeMeta = {};
        try {
          const computedValue = formulaEngine.evaluateCell(
            sourceSheetId,
            sourceCellId,
            {},
            {
              forceRefreshAI,
              channelPayloads,
              dependencyCollector: sourceDependencyCollector,
              runtimeMeta: sourceRuntimeMeta,
            },
          );
          const sourceDependencies = sourceDependencyCollector.snapshot();
          const dependencySignature = buildDependencySignature(
            storageService,
            sourceDependencies,
            channelPayloads,
          );
          asyncComputedValues[sourceSheetId][sourceCellId] = computedValue;
          asyncDependenciesBySheet[sourceSheetId][sourceCellId] =
            sourceDependencies;
          storageService.setComputedCellValue(
            sourceSheetId,
            sourceCellId,
            computedValue,
            inferComputedCellState(
              storageService.getCellValue(sourceSheetId, sourceCellId),
              computedValue,
            ),
            '',
            {
              dependencySignature,
              ...(Object.prototype.hasOwnProperty.call(
                sourceRuntimeMeta,
                'displayValue',
              )
                ? {
                    displayValue: String(
                      sourceRuntimeMeta.displayValue == null
                        ? ''
                        : sourceRuntimeMeta.displayValue,
                    ),
                  }
                : {}),
            },
          );
          asyncProcessedEventIds[sourceSheetId][sourceCellId] =
            buildProcessedChannelEventIds(sourceDependencies, channelPayloads);
          storageService.setCellRuntimeState(sourceSheetId, sourceCellId, {
            lastProcessedChannelEventIds:
              asyncProcessedEventIds[sourceSheetId][sourceCellId],
          });
        } catch (error) {
          const failure = classifyComputeFailure(error);
          const sourceDependencies = sourceDependencyCollector.snapshot();
          const dependencySignature = buildDependencySignature(
            storageService,
            sourceDependencies,
            channelPayloads,
          );
          asyncComputedValues[sourceSheetId][sourceCellId] = failure.value;
          asyncComputedErrors[sourceSheetId][sourceCellId] = failure.error;
          asyncDependenciesBySheet[sourceSheetId][sourceCellId] =
            sourceDependencies;
          storageService.setComputedCellValue(
            sourceSheetId,
            sourceCellId,
            failure.value,
            'error',
            failure.error,
            { dependencySignature },
          );
          asyncProcessedEventIds[sourceSheetId][sourceCellId] =
            buildProcessedChannelEventIds(sourceDependencies, channelPayloads);
          storageService.setCellRuntimeState(sourceSheetId, sourceCellId, {
            lastProcessedChannelEventIds:
              asyncProcessedEventIds[sourceSheetId][sourceCellId],
          });
        }
        if (typeof persistWorkbook === 'function') {
          await persistWorkbook(rawStorage.snapshot());
        }
      }
      const asyncTargetCellMap = forceRefreshAI
        ? null
        : buildTargetCellMap(rawStorage.snapshot(), asyncChangedSignals);
      for (let i = 0; i < orderedSheetIds.length; i += 1) {
        const sheetId = orderedSheetIds[i];
        const evaluationPlan =
          typeof formulaEngine.buildEvaluationPlan === 'function'
            ? formulaEngine.buildEvaluationPlan(sheetId)
            : formulaEngine.cellIds;
        const targetCells =
          asyncTargetCellMap && asyncTargetCellMap[sheetId]
            ? asyncTargetCellMap[sheetId]
            : null;
        asyncComputedValues[sheetId] = asyncComputedValues[sheetId] || {};
        asyncComputedErrors[sheetId] = asyncComputedErrors[sheetId] || {};
        asyncProcessedEventIds[sheetId] = asyncProcessedEventIds[sheetId] || {};
        asyncDependenciesBySheet[sheetId] =
          asyncDependenciesBySheet[sheetId] || {};
        for (
          let cellIndex = 0;
          cellIndex < evaluationPlan.length;
          cellIndex += 1
        ) {
          const cellId = evaluationPlan[cellIndex];
          if (asyncTargetCellMap && !targetCells?.[cellId]) {
            continue;
          }
          if (sheetId === sourceSheetId && cellId === sourceCellId) {
            continue;
          }
          const storedDependencies = storageService.getCellDependencies(
            sheetId,
            cellId,
          );
          const storedDependencySignature = buildDependencySignature(
            storageService,
            storedDependencies,
            channelPayloads,
          );
          const mustReevaluateAsyncTarget = !!(
            asyncTargetCellMap && targetCells?.[cellId]
          );
          if (
            !mustReevaluateAsyncTarget &&
            canReuseComputedCell(
              storageService,
              sheetId,
              cellId,
              storageService.getCellValue(sheetId, cellId),
              storedDependencySignature,
              forceRefreshAI,
            )
          ) {
            asyncComputedValues[sheetId][cellId] =
              storageService.getCellComputedValue(sheetId, cellId);
            asyncDependenciesBySheet[sheetId][cellId] = storedDependencies;
            asyncProcessedEventIds[sheetId][cellId] =
              buildProcessedChannelEventIds(
                storedDependencies,
                channelPayloads,
              );
            continue;
          }
          const dependencyCollector = createDependencyCollector();
          const runtimeMeta = {};
          try {
            const computedValue = formulaEngine.evaluateCell(
              sheetId,
              cellId,
              {},
              {
                forceRefreshAI,
                channelPayloads,
                dependencyCollector,
                runtimeMeta,
              },
            );
            asyncDependenciesBySheet[sheetId][cellId] =
              dependencyCollector.snapshot();
            asyncComputedValues[sheetId][cellId] = computedValue;
            const dependencySignature = buildDependencySignature(
              storageService,
              asyncDependenciesBySheet[sheetId][cellId],
              channelPayloads,
            );
            storageService.setComputedCellValue(
              sheetId,
              cellId,
              computedValue,
              inferComputedCellState(
                storageService.getCellValue(sheetId, cellId),
                computedValue,
              ),
              '',
              {
                dependencySignature,
                ...(Object.prototype.hasOwnProperty.call(
                  runtimeMeta,
                  'displayValue',
                )
                  ? {
                      displayValue: String(
                        runtimeMeta.displayValue == null
                          ? ''
                          : runtimeMeta.displayValue,
                      ),
                    }
                  : {}),
              },
            );
            asyncProcessedEventIds[sheetId][cellId] =
              buildProcessedChannelEventIds(
                asyncDependenciesBySheet[sheetId][cellId],
                channelPayloads,
              );
            storageService.setCellRuntimeState(sheetId, cellId, {
              lastProcessedChannelEventIds:
                asyncProcessedEventIds[sheetId][cellId],
            });
          } catch (error) {
            const failure = classifyComputeFailure(error);
            asyncComputedValues[sheetId][cellId] = failure.value;
            asyncComputedErrors[sheetId][cellId] = failure.error;
            asyncDependenciesBySheet[sheetId][cellId] =
              dependencyCollector.snapshot();
            const dependencySignature = buildDependencySignature(
              storageService,
              asyncDependenciesBySheet[sheetId][cellId],
              channelPayloads,
            );
            storageService.setComputedCellValue(
              sheetId,
              cellId,
              failure.value,
              'error',
              failure.error,
              { dependencySignature },
            );
            asyncProcessedEventIds[sheetId][cellId] =
              buildProcessedChannelEventIds(
                asyncDependenciesBySheet[sheetId][cellId],
                channelPayloads,
              );
            storageService.setCellRuntimeState(sheetId, cellId, {
              lastProcessedChannelEventIds:
                asyncProcessedEventIds[sheetId][cellId],
            });
          }
        }
      }
      Object.keys(asyncDependenciesBySheet).forEach((sheetId) => {
        const sheetDeps = asyncDependenciesBySheet[sheetId] || {};
        Object.keys(sheetDeps).forEach((cellId) => {
          storageService.setCellDependencies(
            sheetId,
            cellId,
            sheetDeps[cellId],
          );
        });
      });
      rawStorage.markDependencyGraphAuthoritative(true, 'async-compute');
      saveSnapshot(
        asyncComputedValues,
        asyncComputedErrors,
        asyncProcessedEventIds,
      ).catch((error) => {
        console.error(
          '[sheet.compute] failed to persist async AI update',
          error,
        );
      });
    },
    {
      sheetDocumentId,
      getActiveSheetId: () => activeSheetId,
    },
  );

  const formulaEngine = new FormulaEngine(
    storageService,
    aiService,
    () => storageService.readTabs(),
    buildCellIds(invalidatedWorkbook),
  );

  const valuesBySheet = {};
  const errorsBySheet = {};
  const dependenciesBySheet = {};
  const processedEventIdsBySheet = {};
  const targetCellMap = forceRefreshAI
    ? null
    : buildTargetCellMap(workbookData, changedSignals);

  const evaluateWorkbook = () => {
    for (
      let sheetIndex = 0;
      sheetIndex < orderedSheetIds.length;
      sheetIndex += 1
    ) {
      const sheetId = orderedSheetIds[sheetIndex];
      const sheetValues = {};
      const sheetErrors = {};
      const sheetDependencies = {};
      const sheetProcessedEventIds = {};
      const evaluationPlan =
        typeof formulaEngine.buildEvaluationPlan === 'function'
          ? formulaEngine.buildEvaluationPlan(sheetId)
          : formulaEngine.cellIds;
      const targetCells =
        targetCellMap && targetCellMap[sheetId] ? targetCellMap[sheetId] : null;

      for (let i = 0; i < evaluationPlan.length; i += 1) {
        const cellId = evaluationPlan[i];
        if (targetCellMap && !targetCells?.[cellId]) {
          continue;
        }
        const storedDependencies = storageService.getCellDependencies(
          sheetId,
          cellId,
        );
        const storedDependencySignature = buildDependencySignature(
          storageService,
          storedDependencies,
          channelPayloads,
        );
        if (
          canReuseComputedCell(
            storageService,
            sheetId,
            cellId,
            storageService.getCellValue(sheetId, cellId),
            storedDependencySignature,
            forceRefreshAI,
          )
        ) {
          sheetValues[cellId] = storageService.getCellComputedValue(
            sheetId,
            cellId,
          );
          sheetDependencies[cellId] = storedDependencies;
          sheetProcessedEventIds[cellId] = buildProcessedChannelEventIds(
            storedDependencies,
            channelPayloads,
          );
          continue;
        }
        const dependencyCollector = createDependencyCollector();
        const runtimeMeta = {};
        try {
          const computedValue = formulaEngine.evaluateCell(
            sheetId,
            cellId,
            {},
            {
              forceRefreshAI,
              channelPayloads,
              dependencyCollector,
              runtimeMeta,
            },
          );
          sheetValues[cellId] = computedValue;
          sheetDependencies[cellId] = dependencyCollector.snapshot();
          sheetProcessedEventIds[cellId] = buildProcessedChannelEventIds(
            sheetDependencies[cellId],
            channelPayloads,
          );
          const dependencySignature = buildDependencySignature(
            storageService,
            sheetDependencies[cellId],
            channelPayloads,
          );
          storageService.setComputedCellValue(
            sheetId,
            cellId,
            computedValue,
            inferComputedCellState(
              storageService.getCellValue(sheetId, cellId),
              computedValue,
            ),
            '',
            {
              dependencySignature,
              ...(Object.prototype.hasOwnProperty.call(
                runtimeMeta,
                'displayValue',
              )
                ? {
                    displayValue: String(
                      runtimeMeta.displayValue == null
                        ? ''
                        : runtimeMeta.displayValue,
                    ),
                  }
                : {}),
            },
          );
          storageService.setCellRuntimeState(sheetId, cellId, {
            lastProcessedChannelEventIds: sheetProcessedEventIds[cellId],
          });
        } catch (error) {
          const failure = classifyComputeFailure(error);
          sheetValues[cellId] = failure.value;
          sheetErrors[cellId] = failure.error;
          sheetDependencies[cellId] = dependencyCollector.snapshot();
          sheetProcessedEventIds[cellId] = buildProcessedChannelEventIds(
            sheetDependencies[cellId],
            channelPayloads,
          );
          const dependencySignature = buildDependencySignature(
            storageService,
            sheetDependencies[cellId],
            channelPayloads,
          );
          storageService.setComputedCellValue(
            sheetId,
            cellId,
            failure.value,
            'error',
            failure.error,
            { dependencySignature },
          );
          storageService.setCellRuntimeState(sheetId, cellId, {
            lastProcessedChannelEventIds: sheetProcessedEventIds[cellId],
          });
        }
      }

      valuesBySheet[sheetId] = sheetValues;
      errorsBySheet[sheetId] = sheetErrors;
      dependenciesBySheet[sheetId] = sheetDependencies;
      processedEventIdsBySheet[sheetId] = sheetProcessedEventIds;
    }
  };

  if (manualTriggerAI) aiService.withManualTrigger(evaluateWorkbook);
  else evaluateWorkbook();

  if (Object.keys(valuesBySheet).length) {
    Object.keys(dependenciesBySheet).forEach((sheetId) => {
      const sheetDeps = dependenciesBySheet[sheetId] || {};
      Object.keys(sheetDeps).forEach((cellId) => {
        storageService.setCellDependencies(sheetId, cellId, sheetDeps[cellId]);
      });
    });
  }

  rawStorage.markDependencyGraphAuthoritative(true, 'compute');

  await saveSnapshot(valuesBySheet, errorsBySheet, processedEventIdsBySheet);
  return {
    values: valuesBySheet[activeSheetId] || {},
    valuesBySheet,
    workbook: rawStorage.snapshot(),
  };
}
