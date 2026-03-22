import {
  buildWorkbookFromFlatStorage,
  decodeSheetDocumentStorage,
  decodeWorkbookDocument,
  encodeWorkbookForDocument,
} from './workbook-codec';
import { decodeStorageMap } from './storage-codec';
import {
  isDependencyGraphAuthoritative,
  rebuildWorkbookDependencyGraph,
} from './server/compute';

export async function normalizeSheetDocumentRuntime(Sheets, sheetId) {
  const sheetDocument = await Sheets.findOneAsync(
    { _id: sheetId },
    { fields: { workbook: 1, storage: 1 } },
  );
  if (!sheetDocument) return null;

  const existingWorkbook =
    sheetDocument.workbook && typeof sheetDocument.workbook === 'object'
      ? decodeWorkbookDocument(sheetDocument.workbook)
      : null;
  const legacyStorage =
    sheetDocument.storage && typeof sheetDocument.storage === 'object'
      ? decodeStorageMap(sheetDocument.storage)
      : null;

  let workbook = null;
  if (legacyStorage && Object.keys(legacyStorage).length) {
    workbook = buildWorkbookFromFlatStorage(legacyStorage, existingWorkbook);
  } else if (existingWorkbook) {
    workbook = existingWorkbook;
  } else {
    workbook = buildWorkbookFromFlatStorage(
      decodeSheetDocumentStorage(sheetDocument),
      null,
    );
  }

  if (!isDependencyGraphAuthoritative(workbook)) {
    workbook = rebuildWorkbookDependencyGraph(workbook);
  }

  const encodedWorkbook = encodeWorkbookForDocument(workbook);
  const shouldUpdateWorkbook =
    JSON.stringify(sheetDocument.workbook || null) !==
    JSON.stringify(encodedWorkbook);
  const shouldUnsetStorage = typeof sheetDocument.storage !== 'undefined';

  if (shouldUpdateWorkbook || shouldUnsetStorage) {
    await Sheets.updateAsync(
      { _id: sheetId },
      {
        $set: {
          workbook: encodedWorkbook,
          updatedAt: new Date(),
        },
        $unset: {
          storage: '',
        },
      },
    );
  }

  return {
    ...sheetDocument,
    workbook: encodedWorkbook,
  };
}

export async function migrateAllSheetsToWorkbookRuntime(Sheets) {
  const docs = await Sheets.find({}, { fields: { _id: 1 } }).fetchAsync();
  let migrated = 0;

  for (let i = 0; i < docs.length; i += 1) {
    const before = await Sheets.findOneAsync(
      { _id: docs[i]._id },
      { fields: { workbook: 1, storage: 1 } },
    );
    await normalizeSheetDocumentRuntime(Sheets, docs[i]._id);
    const after = await Sheets.findOneAsync(
      { _id: docs[i]._id },
      { fields: { workbook: 1, storage: 1 } },
    );

    const hadLegacyStorage = !!(
      before && typeof before.storage !== 'undefined'
    );
    const createdWorkbook = !before?.workbook && !!after?.workbook;
    const changedWorkbook =
      JSON.stringify(before?.workbook || null) !==
      JSON.stringify(after?.workbook || null);
    if (hadLegacyStorage || createdWorkbook || changedWorkbook) {
      migrated += 1;
    }
  }

  return {
    total: docs.length,
    migrated,
  };
}

export async function rebuildSheetDependencyGraphRuntime(Sheets, sheetId) {
  const sheetDocument = await normalizeSheetDocumentRuntime(Sheets, sheetId);
  if (!sheetDocument) return null;

  const workbook = decodeWorkbookDocument(sheetDocument.workbook || {});
  const rebuiltWorkbook = rebuildWorkbookDependencyGraph(workbook);
  await Sheets.updateAsync(
    { _id: sheetId },
    {
      $set: {
        workbook: encodeWorkbookForDocument(rebuiltWorkbook),
        updatedAt: new Date(),
      },
      $unset: {
        storage: '',
      },
    },
  );

  return rebuiltWorkbook;
}

export async function rebuildAllSheetDependencyGraphsRuntime(Sheets) {
  const docs = await Sheets.find({}, { fields: { _id: 1 } }).fetchAsync();
  let rebuilt = 0;

  for (let i = 0; i < docs.length; i += 1) {
    const nextWorkbook = await rebuildSheetDependencyGraphRuntime(
      Sheets,
      docs[i]._id,
    );
    if (nextWorkbook) rebuilt += 1;
  }

  return {
    total: docs.length,
    rebuilt,
  };
}
