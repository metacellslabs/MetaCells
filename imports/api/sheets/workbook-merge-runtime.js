import { decodeWorkbookDocument, flattenWorkbook } from './workbook-codec';

export function collectChangedDependencySignals(previousWorkbook, nextWorkbook) {
  const before = flattenWorkbook(previousWorkbook);
  const after = flattenWorkbook(nextWorkbook);
  const keys = new Set([...Object.keys(before), ...Object.keys(after)]);
  const changes = [];
  const namedRefChanges = {};

  keys.forEach((key) => {
    const prevValue = Object.prototype.hasOwnProperty.call(before, key)
      ? before[key]
      : undefined;
    const nextValue = Object.prototype.hasOwnProperty.call(after, key)
      ? after[key]
      : undefined;
    if (prevValue === nextValue) return;

    const cellMatch = /^SHEET:([^:]+):CELL:([A-Za-z]+[0-9]+)$/.exec(
      String(key || ''),
    );
    if (cellMatch) {
      changes.push({
        kind: 'cell',
        sheetId: cellMatch[1],
        cellId: String(cellMatch[2]).toUpperCase(),
      });
      return;
    }

    if (String(key) === 'NAMED_CELLS') {
      const previousNamedCells =
        previousWorkbook &&
        previousWorkbook.namedCells &&
        typeof previousWorkbook.namedCells === 'object'
          ? previousWorkbook.namedCells
          : {};
      const nextNamedCells =
        nextWorkbook &&
        nextWorkbook.namedCells &&
        typeof nextWorkbook.namedCells === 'object'
          ? nextWorkbook.namedCells
          : {};
      const allNames = new Set([
        ...Object.keys(previousNamedCells),
        ...Object.keys(nextNamedCells),
      ]);
      allNames.forEach((name) => {
        if (
          JSON.stringify(previousNamedCells[name] || null) ===
          JSON.stringify(nextNamedCells[name] || null)
        ) {
          return;
        }
        namedRefChanges[String(name)] = true;
      });
    }
  });

  Object.keys(namedRefChanges).forEach((name) => {
    changes.push({ kind: 'named-ref', name });
  });

  return changes;
}

export function mergeWorkbookForCompute(
  persistedWorkbookValue,
  clientWorkbookValue,
) {
  const persistedWorkbook = decodeWorkbookDocument(
    persistedWorkbookValue || {},
  );
  const clientWorkbook = decodeWorkbookDocument(clientWorkbookValue || {});
  const mergedWorkbook = decodeWorkbookDocument(
    clientWorkbookValue || persistedWorkbookValue || {},
  );

  mergedWorkbook.caches = {
    ...(persistedWorkbook.caches || {}),
    ...(clientWorkbook.caches || {}),
  };
  mergedWorkbook.globals = {
    ...(persistedWorkbook.globals || {}),
    ...(clientWorkbook.globals || {}),
  };

  const persistedDependencyGraph =
    persistedWorkbook.dependencyGraph &&
    typeof persistedWorkbook.dependencyGraph === 'object'
      ? persistedWorkbook.dependencyGraph
      : {
          byCell: {},
          dependentsByCell: {},
          dependentsByNamedRef: {},
          dependentsByChannel: {},
          dependentsByAttachment: {},
        };
  const clientDependencyGraph =
    clientWorkbook.dependencyGraph &&
    typeof clientWorkbook.dependencyGraph === 'object'
      ? clientWorkbook.dependencyGraph
      : {
          byCell: {},
          dependentsByCell: {},
          dependentsByNamedRef: {},
          dependentsByChannel: {},
          dependentsByAttachment: {},
        };
  const persistedByCell =
    persistedDependencyGraph.byCell &&
    typeof persistedDependencyGraph.byCell === 'object'
      ? persistedDependencyGraph.byCell
      : {};
  const clientByCell =
    clientDependencyGraph.byCell &&
    typeof clientDependencyGraph.byCell === 'object'
      ? clientDependencyGraph.byCell
      : {};
  mergedWorkbook.dependencyGraph = {
    byCell: {
      ...persistedByCell,
      ...clientByCell,
    },
    dependentsByCell:
      clientDependencyGraph.dependentsByCell ||
      persistedDependencyGraph.dependentsByCell ||
      {},
    dependentsByNamedRef:
      clientDependencyGraph.dependentsByNamedRef ||
      persistedDependencyGraph.dependentsByNamedRef ||
      {},
    dependentsByChannel:
      clientDependencyGraph.dependentsByChannel ||
      persistedDependencyGraph.dependentsByChannel ||
      {},
    dependentsByAttachment:
      clientDependencyGraph.dependentsByAttachment ||
      persistedDependencyGraph.dependentsByAttachment ||
      {},
    meta: {
      authoritative: false,
      version: 1,
      repairedAt: '',
      reason: 'merged-snapshots',
    },
  };

  const sheetIds = new Set([
    ...Object.keys(persistedWorkbook.sheets || {}),
    ...Object.keys(clientWorkbook.sheets || {}),
  ]);

  sheetIds.forEach((sheetId) => {
    const persistedSheet =
      persistedWorkbook.sheets && persistedWorkbook.sheets[sheetId];
    const clientSheet = clientWorkbook.sheets && clientWorkbook.sheets[sheetId];
    const mergedSheet = mergedWorkbook.sheets && mergedWorkbook.sheets[sheetId];
    if (!mergedSheet || typeof mergedSheet !== 'object') return;

    mergedSheet.rows = {
      ...((persistedSheet && persistedSheet.rows) || {}),
      ...((clientSheet && clientSheet.rows) || {}),
    };
    mergedSheet.cols = {
      ...((persistedSheet && persistedSheet.cols) || {}),
      ...((clientSheet && clientSheet.cols) || {}),
    };
    mergedSheet.cells = {
      ...((persistedSheet && persistedSheet.cells) || {}),
      ...((clientSheet && clientSheet.cells) || {}),
    };

    const persistedCells =
      persistedSheet && typeof persistedSheet.cells === 'object'
        ? persistedSheet.cells
        : {};
    const clientCells =
      clientSheet && typeof clientSheet.cells === 'object'
        ? clientSheet.cells
        : {};
    const mergedCells =
      mergedSheet && typeof mergedSheet.cells === 'object'
        ? mergedSheet.cells
        : {};
    const cellIds = new Set([
      ...Object.keys(persistedCells),
      ...Object.keys(clientCells),
    ]);

    cellIds.forEach((cellId) => {
      const persistedCell =
        persistedCells[cellId] && typeof persistedCells[cellId] === 'object'
          ? persistedCells[cellId]
          : null;
      const clientCell =
        clientCells[cellId] && typeof clientCells[cellId] === 'object'
          ? clientCells[cellId]
          : null;
      const mergedCell =
        mergedCells[cellId] && typeof mergedCells[cellId] === 'object'
          ? mergedCells[cellId]
          : null;
      const persistedSourceVersion = Number(
        persistedCell &&
          (persistedCell.sourceVersion != null
            ? persistedCell.sourceVersion
            : persistedCell.version),
      ) || 0;
      const clientSourceVersion = Number(
        clientCell &&
          (clientCell.sourceVersion != null
            ? clientCell.sourceVersion
            : clientCell.version),
      ) || 0;
      const persistedHasNewerSource =
        !!persistedCell &&
        !!clientCell &&
        persistedSourceVersion > clientSourceVersion;
      if (!mergedCell) {
        const generatedBy = persistedCell
          ? String(persistedCell.generatedBy || '').toUpperCase()
          : '';
        if (persistedCell && generatedBy && !clientCell) {
          const persistedSourceCell =
            persistedCells[generatedBy] &&
            typeof persistedCells[generatedBy] === 'object'
              ? persistedCells[generatedBy]
              : null;
          const clientSourceCell =
            clientCells[generatedBy] &&
            typeof clientCells[generatedBy] === 'object'
              ? clientCells[generatedBy]
              : null;
          const persistedSourceRaw = String(
            (persistedSourceCell && persistedSourceCell.source) || '',
          );
          const clientSourceRaw = String(
            (clientSourceCell && clientSourceCell.source) || '',
          );
          if (!persistedSourceRaw || persistedSourceRaw !== clientSourceRaw) {
            return;
          }
          mergedCells[cellId] = JSON.parse(JSON.stringify(persistedCell));
        }
        return;
      }

      if (persistedHasNewerSource) {
        mergedCells[cellId] = JSON.parse(JSON.stringify(persistedCell));
        return;
      }

      const sourceMatches =
        persistedCell &&
        clientCell &&
        String(persistedCell.source || '') === String(clientCell.source || '');

      if (!sourceMatches) return;

      if (persistedCell) {
        mergedCell.value = String(
          persistedCell.value == null ? '' : persistedCell.value,
        );
        mergedCell.displayValue = String(
          persistedCell.displayValue == null ? '' : persistedCell.displayValue,
        );
        mergedCell.state = String(
          persistedCell.state || mergedCell.state || '',
        );
        mergedCell.error = String(persistedCell.error || '');
      }
    });
  });

  return mergedWorkbook;
}
