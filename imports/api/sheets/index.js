import { Mongo } from "meteor/mongo";
import { Meteor } from "meteor/meteor";
import { check, Match } from "meteor/check";
import { computeSheetSnapshot, invalidateWorkbookDependencies } from "./server/compute";
import { decodeStorageMap } from "./storage-codec";
import {
  buildWorkbookFromFlatStorage,
  decodeSheetDocumentStorage,
  decodeWorkbookDocument,
  encodeWorkbookForDocument,
  flattenWorkbook,
} from "./workbook-codec";
import {
  notifyQueuedSheetDependenciesChanged,
  registerAIQueueSheetRuntimeHooks,
} from "../ai/index.js";
import { extractChannelMentionLabels, normalizeChannelLabel } from "../channels/mentioning.js";
import { getActiveChannelPayloadMap } from "../channels/runtime-state.js";

export const Sheets = new Mongo.Collection("sheets");

const isPlainObject = Match.Where((value) => {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Match.Error("Expected a plain object");
  }
  return true;
});

async function normalizeSheetDocument(sheetId) {
  const sheetDocument = await Sheets.findOneAsync(
    { _id: sheetId },
    { fields: { workbook: 1, storage: 1 } },
  );
  if (!sheetDocument) return null;

  const existingWorkbook =
    sheetDocument.workbook && typeof sheetDocument.workbook === "object"
      ? decodeWorkbookDocument(sheetDocument.workbook)
      : null;
  const legacyStorage =
    sheetDocument.storage && typeof sheetDocument.storage === "object"
      ? decodeStorageMap(sheetDocument.storage)
      : null;

  let workbook = null;
  if (legacyStorage && Object.keys(legacyStorage).length) {
    workbook = buildWorkbookFromFlatStorage(legacyStorage, existingWorkbook);
  } else if (existingWorkbook) {
    workbook = existingWorkbook;
  } else {
    workbook = buildWorkbookFromFlatStorage(decodeSheetDocumentStorage(sheetDocument), null);
  }

  const encodedWorkbook = encodeWorkbookForDocument(workbook);
  const shouldUpdateWorkbook = JSON.stringify(sheetDocument.workbook || null) !== JSON.stringify(encodedWorkbook);
  const shouldUnsetStorage = typeof sheetDocument.storage !== "undefined";

  if (shouldUpdateWorkbook || shouldUnsetStorage) {
    await Sheets.updateAsync(
      { _id: sheetId },
      {
        $set: {
          workbook: encodedWorkbook,
          updatedAt: new Date(),
        },
        $unset: {
          storage: "",
        },
      },
    );
  }

  return {
    ...sheetDocument,
    workbook: encodedWorkbook,
  };
}

async function migrateAllSheetsToWorkbook() {
  const docs = await Sheets.find({}, { fields: { _id: 1 } }).fetchAsync();
  let migrated = 0;

  for (let i = 0; i < docs.length; i += 1) {
    const before = await Sheets.findOneAsync(
      { _id: docs[i]._id },
      { fields: { workbook: 1, storage: 1 } },
    );
    await normalizeSheetDocument(docs[i]._id);
    const after = await Sheets.findOneAsync(
      { _id: docs[i]._id },
      { fields: { workbook: 1, storage: 1 } },
    );

    const hadLegacyStorage = !!(before && typeof before.storage !== "undefined");
    const createdWorkbook = !before?.workbook && !!after?.workbook;
    const changedWorkbook = JSON.stringify(before?.workbook || null) !== JSON.stringify(after?.workbook || null);
    if (hadLegacyStorage || createdWorkbook || changedWorkbook) {
      migrated += 1;
    }
  }

  return {
    total: docs.length,
    migrated,
  };
}

function collectChangedDependencySignals(previousWorkbook, nextWorkbook) {
  const before = flattenWorkbook(previousWorkbook);
  const after = flattenWorkbook(nextWorkbook);
  const keys = new Set([...Object.keys(before), ...Object.keys(after)]);
  const changes = [];
  const namedRefChanges = {};

  keys.forEach((key) => {
    const prevValue = Object.prototype.hasOwnProperty.call(before, key) ? before[key] : undefined;
    const nextValue = Object.prototype.hasOwnProperty.call(after, key) ? after[key] : undefined;
    if (prevValue === nextValue) return;

    const cellMatch = /^SHEET:([^:]+):CELL:([A-Za-z]+[0-9]+)$/.exec(String(key || ""));
    if (cellMatch) {
      changes.push({
        kind: "cell",
        sheetId: cellMatch[1],
        cellId: String(cellMatch[2]).toUpperCase(),
      });
      return;
    }

    if (String(key) === "NAMED_CELLS") {
      const previousNamedCells = previousWorkbook && previousWorkbook.namedCells && typeof previousWorkbook.namedCells === "object"
        ? previousWorkbook.namedCells
        : {};
      const nextNamedCells = nextWorkbook && nextWorkbook.namedCells && typeof nextWorkbook.namedCells === "object"
        ? nextWorkbook.namedCells
        : {};
      const allNames = new Set([...Object.keys(previousNamedCells), ...Object.keys(nextNamedCells)]);
      allNames.forEach((name) => {
        if (JSON.stringify(previousNamedCells[name] || null) === JSON.stringify(nextNamedCells[name] || null)) return;
        namedRefChanges[String(name)] = true;
      });
    }
  });

  Object.keys(namedRefChanges).forEach((name) => {
    changes.push({ kind: "named-ref", name });
  });

  return changes;
}

function mergeWorkbookForCompute(persistedWorkbookValue, clientWorkbookValue) {
  const persistedWorkbook = decodeWorkbookDocument(persistedWorkbookValue || {});
  const clientWorkbook = decodeWorkbookDocument(clientWorkbookValue || {});
  const mergedWorkbook = decodeWorkbookDocument(clientWorkbookValue || persistedWorkbookValue || {});

  mergedWorkbook.caches = {
    ...(persistedWorkbook.caches || {}),
    ...(clientWorkbook.caches || {}),
  };
  mergedWorkbook.globals = {
    ...(persistedWorkbook.globals || {}),
    ...(clientWorkbook.globals || {}),
  };

  const persistedDependencyGraph = persistedWorkbook.dependencyGraph && typeof persistedWorkbook.dependencyGraph === "object"
    ? persistedWorkbook.dependencyGraph
    : { byCell: {} };
  const clientDependencyGraph = clientWorkbook.dependencyGraph && typeof clientWorkbook.dependencyGraph === "object"
    ? clientWorkbook.dependencyGraph
    : { byCell: {} };
  const persistedByCell = persistedDependencyGraph.byCell && typeof persistedDependencyGraph.byCell === "object"
    ? persistedDependencyGraph.byCell
    : {};
  const clientByCell = clientDependencyGraph.byCell && typeof clientDependencyGraph.byCell === "object"
    ? clientDependencyGraph.byCell
    : {};
  mergedWorkbook.dependencyGraph = {
    byCell: {
      ...persistedByCell,
      ...clientByCell,
    },
  };

  const sheetIds = new Set([
    ...Object.keys(persistedWorkbook.sheets || {}),
    ...Object.keys(clientWorkbook.sheets || {}),
  ]);

  sheetIds.forEach((sheetId) => {
    const persistedSheet = persistedWorkbook.sheets && persistedWorkbook.sheets[sheetId];
    const clientSheet = clientWorkbook.sheets && clientWorkbook.sheets[sheetId];
    const mergedSheet = mergedWorkbook.sheets && mergedWorkbook.sheets[sheetId];
    if (!mergedSheet || typeof mergedSheet !== "object") return;

    const persistedCells = persistedSheet && typeof persistedSheet.cells === "object" ? persistedSheet.cells : {};
    const clientCells = clientSheet && typeof clientSheet.cells === "object" ? clientSheet.cells : {};
    const mergedCells = mergedSheet && typeof mergedSheet.cells === "object" ? mergedSheet.cells : {};
    const cellIds = new Set([
      ...Object.keys(persistedCells),
      ...Object.keys(clientCells),
    ]);

    cellIds.forEach((cellId) => {
      const persistedCell = persistedCells[cellId] && typeof persistedCells[cellId] === "object" ? persistedCells[cellId] : null;
      const clientCell = clientCells[cellId] && typeof clientCells[cellId] === "object" ? clientCells[cellId] : null;
      const mergedCell = mergedCells[cellId] && typeof mergedCells[cellId] === "object" ? mergedCells[cellId] : null;
      if (!mergedCell) return;

      const sourceMatches = persistedCell
        && clientCell
        && String(persistedCell.source || "") === String(clientCell.source || "");

      if (!sourceMatches) return;

      if (persistedCell) {
        mergedCell.value = String(persistedCell.value == null ? "" : persistedCell.value);
        mergedCell.state = String(persistedCell.state || mergedCell.state || "");
        mergedCell.error = String(persistedCell.error || "");
      }
    });
  });

  return mergedWorkbook;
}

export function workbookMentionsChannel(workbookValue, channelLabel) {
  const workbook = decodeWorkbookDocument(workbookValue || {});
  const target = normalizeChannelLabel(channelLabel);
  if (!target) return false;

  const sheets = workbook && workbook.sheets && typeof workbook.sheets === "object" ? workbook.sheets : {};
  return Object.keys(sheets).some((sheetId) => {
    const sheet = sheets[sheetId];
    const cells = sheet && sheet.cells && typeof sheet.cells === "object" ? sheet.cells : {};
    return Object.keys(cells).some((cellId) => {
      const cell = cells[cellId];
      const source = String(cell && cell.source || "");
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
    const workbook = decodeWorkbookDocument(doc && doc.workbook || {});
    if (!workbookMentionsChannel(workbook, target)) continue;
    matched += 1;

    const tabs = Array.isArray(workbook.tabs) ? workbook.tabs : [];
    const defaultActiveSheetId =
      String(workbook.activeTabId || "")
      || String((tabs.find((tab) => tab && tab.type === "sheet") || {}).id || "sheet-1");

    await computeSheetSnapshot({
      sheetDocumentId: doc._id,
      workbookData: workbook,
      activeSheetId: defaultActiveSheetId,
      channelPayloads,
      changedSignals: [{ kind: "channel", label: target }],
      persistWorkbook: async (nextWorkbook) => {
        await Sheets.updateAsync(
          { _id: doc._id },
          {
            $set: {
              workbook: encodeWorkbookForDocument(decodeWorkbookDocument(nextWorkbook)),
              updatedAt: new Date(),
            },
            $unset: {
              storage: "",
            },
          },
        );
      },
    });
    recomputed += 1;
  }

  return { matched, recomputed };
}

registerAIQueueSheetRuntimeHooks({
  loadSheetDocumentStorage: async (sheetId) => {
    const sheetDocument = await normalizeSheetDocument(sheetId);
    if (!sheetDocument) return null;
    return decodeWorkbookDocument(sheetDocument.workbook || {});
  },
});

if (Meteor.isServer) {
  Meteor.startup(async () => {
    const result = await migrateAllSheetsToWorkbook();
    console.log("[sheets] workbook migration complete", result);
  });

  Meteor.publish("sheets.list", function publishSheetsList() {
    return Sheets.find(
      {},
      {
        fields: { name: 1, createdAt: 1, updatedAt: 1 },
        sort: { updatedAt: -1, createdAt: -1 },
      },
    );
  });

  Meteor.publish("sheets.one", function publishSheet(sheetId) {
    check(sheetId, String);

    return Sheets.find(
      { _id: sheetId },
      {
        fields: { name: 1, workbook: 1, createdAt: 1, updatedAt: 1 },
      },
    );
  });

  Meteor.methods({
    async "sheets.create"(name) {
      check(name, Match.Maybe(String));

      const now = new Date();
      const count = (await Sheets.find().countAsync()) + 1;
      const sheetName = String(name || "").trim() || `Metacell ${count}`;
      const workbook = buildWorkbookFromFlatStorage({});

      return Sheets.insertAsync({
        name: sheetName,
        workbook: encodeWorkbookForDocument(workbook),
        createdAt: now,
        updatedAt: now,
      });
    },

    async "sheets.rename"(sheetId, name) {
      check(sheetId, String);
      check(name, String);

      const nextName = String(name || "").trim();
      if (!nextName) {
        throw new Meteor.Error("invalid-name", "Workbook name is required");
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

    async "sheets.remove"(sheetId) {
      check(sheetId, String);
      await Sheets.removeAsync({ _id: sheetId });
    },

    async "sheets.migrateAllToWorkbook"() {
      return migrateAllSheetsToWorkbook();
    },

    async "sheets.saveWorkbook"(sheetId, workbook) {
      check(sheetId, String);
      check(workbook, isPlainObject);

      const sheetDocument = await normalizeSheetDocument(sheetId);
      const previousWorkbook = decodeWorkbookDocument((sheetDocument && sheetDocument.workbook) || {});
      const nextWorkbook = mergeWorkbookForCompute(previousWorkbook, workbook);
      const changes = collectChangedDependencySignals(previousWorkbook, nextWorkbook);
      const invalidatedWorkbook = decodeWorkbookDocument(
        invalidateWorkbookDependencies(nextWorkbook, changes),
      );

      await Sheets.updateAsync(
        { _id: sheetId },
        {
          $set: {
            workbook: encodeWorkbookForDocument(invalidatedWorkbook),
            updatedAt: new Date(),
          },
          $unset: {
            storage: "",
          },
        },
      );

      if (changes.length) {
        await notifyQueuedSheetDependenciesChanged(sheetId, changes);
      }
    },

    async "sheets.computeGrid"(sheetId, activeSheetId, options) {
      check(sheetId, String);
      check(activeSheetId, String);
      check(options, Match.Maybe(isPlainObject));

      const sheetDocument = await normalizeSheetDocument(sheetId);

      if (!sheetDocument) {
        throw new Meteor.Error("not-found", "Workbook not found");
      }

      const persistedWorkbook = decodeWorkbookDocument(sheetDocument.workbook || {});
      const sourceWorkbook =
        options && options.workbookSnapshot && typeof options.workbookSnapshot === "object"
          ? mergeWorkbookForCompute(persistedWorkbook, options.workbookSnapshot)
          : persistedWorkbook;
      const channelPayloads = await getActiveChannelPayloadMap();

      const result = await computeSheetSnapshot({
        sheetDocumentId: sheetId,
        workbookData: sourceWorkbook,
        activeSheetId,
        channelPayloads,
        forceRefreshAI: !!(options && options.forceRefreshAI),
        changedSignals: collectChangedDependencySignals(persistedWorkbook, sourceWorkbook),
        persistWorkbook: async (nextWorkbook) => {
          const normalizedNextWorkbook = decodeWorkbookDocument(nextWorkbook);
          const changes = collectChangedDependencySignals(sourceWorkbook, normalizedNextWorkbook);
          await Sheets.updateAsync(
            { _id: sheetId },
            {
              $set: {
                workbook: encodeWorkbookForDocument(normalizedNextWorkbook),
                updatedAt: new Date(),
              },
              $unset: {
                storage: "",
              },
            },
          );
          if (changes.length) {
            await notifyQueuedSheetDependenciesChanged(sheetId, changes);
          }
        },
      });

      return result;
    },
  });
}
