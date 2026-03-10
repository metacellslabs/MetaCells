import { Mongo } from "meteor/mongo";
import { Meteor } from "meteor/meteor";
import { check, Match } from "meteor/check";
import { computeSheetSnapshot } from "./server/compute";
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
      changes.push({ kind: "named-cells" });
    }
  });

  return changes;
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
      const nextWorkbook = decodeWorkbookDocument(workbook);

      await Sheets.updateAsync(
        { _id: sheetId },
        {
          $set: {
            workbook: encodeWorkbookForDocument(nextWorkbook),
            updatedAt: new Date(),
          },
          $unset: {
            storage: "",
          },
        },
      );

      const changes = collectChangedDependencySignals(previousWorkbook, nextWorkbook);
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
          ? decodeWorkbookDocument(options.workbookSnapshot)
          : persistedWorkbook;

      const result = await computeSheetSnapshot({
        sheetDocumentId: sheetId,
        workbookData: sourceWorkbook,
        activeSheetId,
        forceRefreshAI: !!(options && options.forceRefreshAI),
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
