import { AI_MODE } from './constants.js';
import { normalizeCellSchedule } from '../lib/cell-schedule.js';

export function isPlainObject(value) {
  return !!value && typeof value === 'object' && !Array.isArray(value);
}

export function deepClone(value) {
  return JSON.parse(JSON.stringify(value || {}));
}

export function normalizeChannelFeedMeta(meta) {
  if (!isPlainObject(meta)) return null;
  var next = {
    filterMode: String(meta.filterMode || ''),
    decisionMode: String(meta.decisionMode || ''),
    promptTemplate: String(meta.promptTemplate || ''),
    lastDecisionAt: String(meta.lastDecisionAt || ''),
    lastEvaluatedEventId: String(meta.lastEvaluatedEventId || ''),
    lastIncludedEventId: String(meta.lastIncludedEventId || ''),
    lastValuePreview: String(meta.lastValuePreview || ''),
    lastAttributes: isPlainObject(meta.lastAttributes)
      ? deepClone(meta.lastAttributes)
      : {},
  };
  if (
    !next.filterMode &&
    !next.decisionMode &&
    !next.promptTemplate &&
    !next.lastDecisionAt &&
    !next.lastEvaluatedEventId &&
    !next.lastIncludedEventId &&
    !next.lastValuePreview &&
    !Object.keys(next.lastAttributes).length
  ) {
    return null;
  }
  return next;
}

export function normalizeTabs(tabs) {
  if (!Array.isArray(tabs)) return [];
  return tabs
    .filter(function (tab) {
      return tab && typeof tab.id === 'string' && typeof tab.name === 'string';
    })
    .map(function (tab) {
      return {
        id: String(tab.id),
        name: String(tab.name),
        type: tab.type === 'report' ? 'report' : 'sheet',
      };
    });
}

export function normalizeWorkbook(input) {
  var workbook = isPlainObject(input) ? input : {};
  return {
    version: 1,
    tabs: normalizeTabs(workbook.tabs),
    activeTabId:
      typeof workbook.activeTabId === 'string' ? workbook.activeTabId : '',
    aiMode:
      workbook.aiMode === AI_MODE.auto ? AI_MODE.auto : AI_MODE.manual,
    namedCells: isPlainObject(workbook.namedCells)
      ? deepClone(workbook.namedCells)
      : {},
    sheets: isPlainObject(workbook.sheets) ? deepClone(workbook.sheets) : {},
    dependencyGraph: isPlainObject(workbook.dependencyGraph)
      ? deepClone(workbook.dependencyGraph)
      : {
          byCell: {},
          dependentsByCell: {},
          dependentsByNamedRef: {},
          dependentsByChannel: {},
          dependentsByAttachment: {},
          meta: {
            authoritative: false,
            version: 1,
            repairedAt: '',
          },
        },
    caches: isPlainObject(workbook.caches) ? deepClone(workbook.caches) : {},
    globals: isPlainObject(workbook.globals) ? deepClone(workbook.globals) : {},
  };
}

export function makeDependencyGraphKey(sheetId, cellId) {
  return String(sheetId || '') + ':' + String(cellId || '').toUpperCase();
}

export function normalizeCellRecord(source, previousCell) {
  var nextSource = String(source == null ? '' : source);
  var prev = isPlainObject(previousCell) ? previousCell : {};
  var sourceType = /^[='>#]/.test(nextSource) ? 'formula' : 'raw';
  var sourceChanged = String(prev.source || '') !== nextSource;
  var sourceVersion = Number(prev.sourceVersion) || Number(prev.version) || 0;
  if (sourceChanged) sourceVersion += 1;
  if (sourceVersion < 1) sourceVersion = 1;
  var computedVersion =
    sourceType === 'formula'
      ? sourceChanged
        ? 0
        : Number(prev.computedVersion) || 0
      : sourceVersion;
  var dependencyVersion =
    sourceType === 'formula'
      ? sourceChanged
        ? 0
        : Number(prev.dependencyVersion) || 0
      : sourceVersion;

  return {
    source: nextSource,
    sourceType: sourceType,
    format: String(prev.format || 'text'),
    align: String(prev.align || 'left'),
    wrapText: prev.wrapText === true,
    bold: prev.bold === true,
    italic: prev.italic === true,
    decimalPlaces: Number.isInteger(prev.decimalPlaces)
      ? Math.max(0, Math.min(6, prev.decimalPlaces))
      : null,
    backgroundColor:
      typeof prev.backgroundColor === 'string'
        ? String(prev.backgroundColor)
        : '',
    fontFamily:
      typeof prev.fontFamily === 'string' ? String(prev.fontFamily) : 'default',
    fontSize: Number.isFinite(prev.fontSize)
      ? Math.max(10, Math.min(28, Number(prev.fontSize)))
      : 14,
    borders: isPlainObject(prev.borders)
      ? {
          top: prev.borders.top === true,
          right: prev.borders.right === true,
          bottom: prev.borders.bottom === true,
          left: prev.borders.left === true,
        }
      : {
          top: false,
          right: false,
          bottom: false,
          left: false,
        },
    value: sourceType === 'formula' ? String(prev.value || '') : nextSource,
    displayValue:
      sourceType === 'formula' ? String(prev.displayValue || '') : nextSource,
    state:
      sourceType === 'formula'
        ? String(prev.source || '') !== nextSource
          ? 'stale'
          : String(prev.state || 'stale')
        : 'resolved',
    error: sourceType === 'formula' ? String(prev.error || '') : '',
    generatedBy: String(prev.generatedBy || ''),
    lastProcessedChannelEventIds: isPlainObject(
      prev.lastProcessedChannelEventIds,
    )
      ? deepClone(prev.lastProcessedChannelEventIds)
      : {},
    channelFeedMeta:
      sourceType === 'formula' && !sourceChanged
        ? normalizeChannelFeedMeta(prev.channelFeedMeta)
        : null,
    sourceVersion: sourceVersion,
    computedVersion: computedVersion,
    dependencyVersion: dependencyVersion,
    dependencySignature:
      sourceType === 'formula' && !sourceChanged
        ? String(prev.dependencySignature || '')
        : '',
    schedule: normalizeCellSchedule(prev.schedule) || null,
    version: sourceVersion,
  };
}

export function createEmptyWorkbookCore() {
  return normalizeWorkbook({});
}
