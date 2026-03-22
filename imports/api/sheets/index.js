import { Mongo } from 'meteor/mongo';
import { Meteor } from 'meteor/meteor';
import { check, Match } from 'meteor/check';
import {
  computeSheetSnapshot,
  invalidateWorkbookDependencies,
  isDependencyGraphAuthoritative,
  rebuildWorkbookDependencyGraph,
} from './server/compute';
import {
  hydrateWorkbookAttachmentArtifacts,
  stripWorkbookAttachmentInlineData,
} from '../artifacts/index.js';
import {
  buildWorkbookFromFlatStorage,
  decodeWorkbookDocument,
  encodeWorkbookForDocument,
} from './workbook-codec';
import {
  notifyQueuedSheetDependenciesChanged,
  registerAIQueueSheetRuntimeHooks,
  enqueueAIChatRequest,
} from '../ai/index.js';
import {
  extractChannelMentionLabels,
  normalizeChannelLabel,
} from '../channels/mentioning.js';
import { getActiveChannelPayloadMap } from '../channels/runtime-state.js';
import { createServerCellUpdateProfiler } from '../../lib/cell-update-profile.js';
import {
  buildComputedFinancialModelWorkbook,
  buildComputedFormulaTestWorkbook,
} from './formula-test-workbook.js';
import { runChannelBatchForWorkbook } from './channel-feed-runtime.js';
import {
  migrateAllSheetsToWorkbookRuntime,
  normalizeSheetDocumentRuntime,
  rebuildAllSheetDependencyGraphsRuntime,
  rebuildSheetDependencyGraphRuntime,
} from './sheet-document-runtime.js';
import {
  collectChangedDependencySignals,
  mergeWorkbookForCompute,
} from './workbook-merge-runtime.js';

export const Sheets = new Mongo.Collection('sheets');

const isPlainObject = Match.Where((value) => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new Match.Error('Expected a plain object');
  }
  return true;
});

async function normalizeSheetDocument(sheetId) {
  return normalizeSheetDocumentRuntime(Sheets, sheetId);
}

async function migrateAllSheetsToWorkbook() {
  return migrateAllSheetsToWorkbookRuntime(Sheets);
}

async function rebuildSheetDependencyGraph(sheetId) {
  return rebuildSheetDependencyGraphRuntime(Sheets, sheetId);
}

async function rebuildAllSheetDependencyGraphs() {
  return rebuildAllSheetDependencyGraphsRuntime(Sheets);
}

export function workbookMentionsChannel(workbookValue, channelLabel) {
  const workbook = decodeWorkbookDocument(workbookValue || {});
  const target = normalizeChannelLabel(channelLabel);
  if (!target) return false;

  const sheets =
    workbook && workbook.sheets && typeof workbook.sheets === 'object'
      ? workbook.sheets
      : {};
  return Object.keys(sheets).some((sheetId) => {
    const sheet = sheets[sheetId];
    const cells =
      sheet && sheet.cells && typeof sheet.cells === 'object'
        ? sheet.cells
        : {};
    return Object.keys(cells).some((cellId) => {
      const cell = cells[cellId];
      const source = String((cell && cell.source) || '');
      if (!source) return false;
      const labels = extractChannelMentionLabels(source);
      return labels.indexOf(target) !== -1;
    });
  });
}

export async function recomputeSheetsMentioningChannel(channelLabel) {
  const target = normalizeChannelLabel(channelLabel);
  if (!target) {
    return { matched: 0, recomputed: 0 };
  }

  const channelPayloads = await getActiveChannelPayloadMap();
  const docs = await Sheets.find({}, { fields: { workbook: 1 } }).fetchAsync();
  let matched = 0;
  let recomputed = 0;

  for (let i = 0; i < docs.length; i += 1) {
    const doc = docs[i];
    const workbook = decodeWorkbookDocument((doc && doc.workbook) || {});
    if (!workbookMentionsChannel(workbook, target)) continue;
    matched += 1;

    const tabs = Array.isArray(workbook.tabs) ? workbook.tabs : [];
    const defaultActiveSheetId =
      String(workbook.activeTabId || '') ||
      String(
        (tabs.find((tab) => tab && tab.type === 'sheet') || {}).id || 'sheet-1',
      );

    const computeResult = await computeSheetSnapshot({
      sheetDocumentId: doc._id,
      workbookData: workbook,
      activeSheetId: defaultActiveSheetId,
      channelPayloads,
      changedSignals: [{ kind: 'channel', label: target }],
      persistWorkbook: async (nextWorkbook) => {
        await Sheets.updateAsync(
          { _id: doc._id },
          {
            $set: {
              workbook: encodeWorkbookForDocument(
                decodeWorkbookDocument(nextWorkbook),
              ),
              updatedAt: new Date(),
            },
            $unset: {
              storage: '',
            },
          },
        );
      },
    });
    const nextWorkbook = await runChannelBatchForWorkbook({
      sheetDocumentId: doc._id,
      workbook:
        computeResult && computeResult.workbook
          ? computeResult.workbook
          : workbook,
      channelLabel: target,
      channelPayloads,
    });
    await Sheets.updateAsync(
      { _id: doc._id },
      {
        $set: {
          workbook: encodeWorkbookForDocument(
            decodeWorkbookDocument(nextWorkbook),
          ),
          updatedAt: new Date(),
        },
        $unset: {
          storage: '',
        },
      },
    );
    recomputed += 1;
  }

  return { matched, recomputed };
}

registerAIQueueSheetRuntimeHooks({
  loadSheetDocumentStorage: async (sheetId) => {
    const sheetDocument = await normalizeSheetDocument(sheetId);
    if (!sheetDocument) return null;
    return hydrateWorkbookAttachmentArtifacts(
      decodeWorkbookDocument(sheetDocument.workbook || {}),
    );
  },
});

async function syncWorkbookSchedulesAfterPersist(payload, logMessage) {
  try {
    const module = await import('../schedules/index.js');
    if (
      module &&
      typeof module.syncWorkbookSchedulesOnSave === 'function'
    ) {
      await module.syncWorkbookSchedulesOnSave(payload);
    }
  } catch (error) {
    console.error(logMessage, error);
  }
}

async function removeWorkbookSchedulesAfterDelete(sheetId) {
  try {
    const module = await import('../schedules/index.js');
    if (
      module &&
      typeof module.removeWorkbookSchedulesAndJobs === 'function'
    ) {
      await module.removeWorkbookSchedulesAndJobs(sheetId);
    }
  } catch (error) {
    console.error('Failed to remove workbook schedules during delete', error);
  }
}

if (Meteor.isServer) {
  Meteor.startup(async () => {
    const result = await migrateAllSheetsToWorkbook();
    console.log('[sheets] workbook migration complete', result);
  });

  Meteor.publish('sheets.list', function publishSheetsList() {
    return Sheets.find(
      {},
      {
        fields: { name: 1, createdAt: 1, updatedAt: 1 },
        sort: { updatedAt: -1, createdAt: -1 },
      },
    );
  });

  Meteor.publish('sheets.one', function publishSheet(sheetId) {
    check(sheetId, String);

    return Sheets.find(
      { _id: sheetId },
      {
        fields: { name: 1, workbook: 1, createdAt: 1, updatedAt: 1 },
      },
    );
  });

  Meteor.methods({
    async 'sheets.create'(name) {
      check(name, Match.Maybe(String));

      const now = new Date();
      const count = (await Sheets.find().countAsync()) + 1;
      const sheetName = String(name || '').trim() || `Metacell ${count}`;
      const workbook = buildWorkbookFromFlatStorage({});
      if (!workbook.sheets['sheet-1'] || typeof workbook.sheets['sheet-1'] !== 'object') {
        workbook.sheets['sheet-1'] = {
          cells: {},
          columnWidths: {},
          rowHeights: {},
          reportContent: '',
        };
      }
      workbook.sheets['sheet-1'].rows = { count: 500 };
      workbook.sheets['sheet-1'].cols = { count: 26 };

      return Sheets.insertAsync({
        name: sheetName,
        workbook: encodeWorkbookForDocument(workbook),
        createdAt: now,
        updatedAt: now,
      });
    },

    async 'sheets.createFormulaTestWorkbook'(name) {
      check(name, Match.Maybe(String));

      const now = new Date();
      const workbook = await buildComputedFormulaTestWorkbook();
      const sheetName = String(name || '').trim() || 'Formula Test Bench';

      return Sheets.insertAsync({
        name: sheetName,
        workbook: encodeWorkbookForDocument(workbook),
        createdAt: now,
        updatedAt: now,
      });
    },

    async 'sheets.createFinancialModelWorkbook'(name) {
      check(name, Match.Maybe(String));

      const now = new Date();
      const workbook = await buildComputedFinancialModelWorkbook();
      const sheetName =
        String(name || '').trim() || 'AI Startup Financial Model';

      return Sheets.insertAsync({
        name: sheetName,
        workbook: encodeWorkbookForDocument(workbook),
        createdAt: now,
        updatedAt: now,
      });
    },

    async 'sheets.rename'(sheetId, name) {
      check(sheetId, String);
      check(name, String);

      const nextName = String(name || '').trim();
      if (!nextName) {
        throw new Meteor.Error('invalid-name', 'Workbook name is required');
      }

      await Sheets.updateAsync(
        { _id: sheetId },
        {
          $set: {
            name: nextName,
            updatedAt: new Date(),
          },
        },
      );
    },

    async 'sheets.remove'(sheetId) {
      check(sheetId, String);
      await removeWorkbookSchedulesAfterDelete(sheetId);
      await Sheets.removeAsync({ _id: sheetId });
    },

    async 'sheets.migrateAllToWorkbook'() {
      return migrateAllSheetsToWorkbook();
    },

    async 'sheets.rebuildDependencyGraph'(sheetId) {
      check(sheetId, String);
      const workbook = await rebuildSheetDependencyGraph(sheetId);
      if (!workbook) {
        throw new Meteor.Error('not-found', 'Workbook not found');
      }
      return { rebuilt: true };
    },

    async 'sheets.rebuildAllDependencyGraphs'() {
      return rebuildAllSheetDependencyGraphs();
    },

    async 'sheets.saveWorkbook'(sheetId, workbook) {
      check(sheetId, String);
      check(workbook, isPlainObject);

      const sheetDocument = await normalizeSheetDocument(sheetId);
      const previousWorkbook = decodeWorkbookDocument(
        (sheetDocument && sheetDocument.workbook) || {},
      );
      const nextWorkbook = mergeWorkbookForCompute(previousWorkbook, workbook);
      const changes = collectChangedDependencySignals(
        previousWorkbook,
        nextWorkbook,
      );
      const invalidatedWorkbook = decodeWorkbookDocument(
        invalidateWorkbookDependencies(nextWorkbook, changes),
      );
      const repairedWorkbook =
        rebuildWorkbookDependencyGraph(invalidatedWorkbook);
      const persistedWorkbook =
        stripWorkbookAttachmentInlineData(repairedWorkbook);

      await Sheets.updateAsync(
        { _id: sheetId },
        {
          $set: {
            workbook: encodeWorkbookForDocument(persistedWorkbook),
            updatedAt: new Date(),
          },
          $unset: {
            storage: '',
          },
        },
      );

      if (changes.length) {
        await notifyQueuedSheetDependenciesChanged(sheetId, changes);
      }
      await syncWorkbookSchedulesAfterPersist(
        {
          sheetDocumentId: sheetId,
          previousWorkbook,
          nextWorkbook: persistedWorkbook,
        },
        'Failed to sync workbook schedules after save',
      );
    },

    async 'sheets.computeGrid'(sheetId, activeSheetId, options) {
      check(sheetId, String);
      check(activeSheetId, String);
      check(options, Match.Maybe(isPlainObject));
      const profiler = createServerCellUpdateProfiler(
        options && options.traceId ? options.traceId : '',
        {
          sheetId,
          activeSheetId,
        },
      );
      if (profiler) profiler.step('computeGrid.start');

      const sheetDocument = await normalizeSheetDocument(sheetId);
      if (profiler) profiler.step('normalize.done');

      if (!sheetDocument) {
        throw new Meteor.Error('not-found', 'Workbook not found');
      }

      const persistedWorkbook = decodeWorkbookDocument(
        sheetDocument.workbook || {},
      );
      const sourceWorkbook =
        options &&
        options.workbookSnapshot &&
        typeof options.workbookSnapshot === 'object'
          ? mergeWorkbookForCompute(persistedWorkbook, options.workbookSnapshot)
          : persistedWorkbook;
      if (profiler) profiler.step('merge.done');
      const repairedWorkbook = isDependencyGraphAuthoritative(sourceWorkbook)
        ? sourceWorkbook
        : rebuildWorkbookDependencyGraph(sourceWorkbook);
      if (profiler)
        profiler.step('graph_repair.done', {
          repaired: !isDependencyGraphAuthoritative(sourceWorkbook),
        });
      const hydratedWorkbook =
        await hydrateWorkbookAttachmentArtifacts(repairedWorkbook);
      if (profiler) profiler.step('hydrate.done');
      const channelPayloads = await getActiveChannelPayloadMap();
      if (profiler) profiler.step('channel_payloads.done');
      const changedSignals = collectChangedDependencySignals(
        persistedWorkbook,
        sourceWorkbook,
      );

      const result = await computeSheetSnapshot({
        sheetDocumentId: sheetId,
        workbookData: hydratedWorkbook,
        activeSheetId,
        channelPayloads,
        forceRefreshAI: !!(options && options.forceRefreshAI),
        manualTriggerAI: !!(options && options.manualTriggerAI),
        changedSignals,
        persistWorkbook: async (nextWorkbook) => {
          const normalizedNextWorkbook = decodeWorkbookDocument(nextWorkbook);
          const latestSheetDocument = await Sheets.findOneAsync(
            { _id: sheetId },
            { fields: { workbook: 1 } },
          );
          const latestPersistedWorkbook = decodeWorkbookDocument(
            (latestSheetDocument && latestSheetDocument.workbook) || {},
          );
          const mergedPersistWorkbook = mergeWorkbookForCompute(
            normalizedNextWorkbook,
            latestPersistedWorkbook,
          );
          const changes = collectChangedDependencySignals(
            latestPersistedWorkbook,
            mergedPersistWorkbook,
          );
          const persistedNextWorkbook = stripWorkbookAttachmentInlineData(
            mergedPersistWorkbook,
          );
          if (profiler)
            profiler.step('persist.start', { changes: changes.length });
          await Sheets.updateAsync(
            { _id: sheetId },
            {
              $set: {
                workbook: encodeWorkbookForDocument(persistedNextWorkbook),
                updatedAt: new Date(),
              },
              $unset: {
                storage: '',
              },
            },
          );
          if (changes.length) {
            await notifyQueuedSheetDependenciesChanged(sheetId, changes);
          }
          await syncWorkbookSchedulesAfterPersist(
            {
              sheetDocumentId: sheetId,
              previousWorkbook: sourceWorkbook,
              nextWorkbook: persistedNextWorkbook,
            },
            'Failed to sync workbook schedules after compute persist',
          );
          if (profiler)
            profiler.step('persist.done', { changes: changes.length });
        },
      });
      const nextWorkbookAfterChannelHistory =
        result && result.workbook
          ? await (async () => {
              const mentionedLabels = [
                ...new Set(
                  Object.values(
                    (
                      decodeWorkbookDocument(result.workbook || {}).sheets || {}
                    ),
                  )
                    .flatMap((sheet) =>
                      Object.values((sheet && sheet.cells) || {}).flatMap(
                        (cell) =>
                          extractChannelMentionLabels(
                            String((cell && cell.source) || ''),
                          ),
                      ),
                    )
                    .map((label) => normalizeChannelLabel(label))
                    .filter(Boolean),
                ),
              ];
              let nextWorkbook = result.workbook;
              for (let i = 0; i < mentionedLabels.length; i += 1) {
                nextWorkbook = await runChannelBatchForWorkbook({
                  sheetDocumentId: sheetId,
                  workbook: nextWorkbook,
                  channelLabel: mentionedLabels[i],
                  channelPayloads,
                  historyOnly: true,
                });
              }
              return nextWorkbook;
            })()
          : result && result.workbook;
      if (nextWorkbookAfterChannelHistory && result) {
        const previousWorkbookBeforeChannelHistory = decodeWorkbookDocument(
          result.workbook || {},
        );
        result.workbook = nextWorkbookAfterChannelHistory;
        await Sheets.updateAsync(
          { _id: sheetId },
          {
            $set: {
              workbook: encodeWorkbookForDocument(
                stripWorkbookAttachmentInlineData(
                  decodeWorkbookDocument(nextWorkbookAfterChannelHistory),
                ),
              ),
              updatedAt: new Date(),
            },
            $unset: {
              storage: '',
            },
          },
        );
        await syncWorkbookSchedulesAfterPersist(
          {
            sheetDocumentId: sheetId,
            previousWorkbook: previousWorkbookBeforeChannelHistory,
            nextWorkbook: nextWorkbookAfterChannelHistory,
          },
          'Failed to sync workbook schedules after channel history persist',
        );
      }
      if (profiler)
        profiler.step('compute.done', {
          values:
            result && result.values ? Object.keys(result.values).length : 0,
        });

      if (result && result.workbook) {
        result.workbook = stripWorkbookAttachmentInlineData(result.workbook);
      }
      if (profiler) profiler.step('computeGrid.done');

      return result;
    },
  });
}
