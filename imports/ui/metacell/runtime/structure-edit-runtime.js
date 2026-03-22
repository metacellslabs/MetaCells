export function getSelectedRowBounds(app) {
  var bounds =
    typeof app.getGridBounds === 'function'
      ? app.getGridBounds()
      : { cols: app.table.rows[0].cells.length - 1 };
  var maxCol = bounds.cols;
  if (
    app.selectionRange &&
    app.selectionRange.startCol === 1 &&
    app.selectionRange.endCol === maxCol
  ) {
    return {
      start: app.selectionRange.startRow,
      end: app.selectionRange.endRow,
    };
  }
  if (app.contextMenuState && app.contextMenuState.type === 'row') {
    return {
      start: app.contextMenuState.index,
      end: app.contextMenuState.index,
    };
  }
  if (app.activeInput) {
    var parsed = app.parseCellId(app.activeInput.id);
    if (parsed) return { start: parsed.row, end: parsed.row };
  }
  return null;
}

function remapIndexForStructureEdit(index, start, count, mode) {
  var value = Number(index) || 0;
  var anchor = Number(start) || 0;
  var size = Math.max(1, Number(count) || 1);
  if (mode === 'insert') {
    return value >= anchor ? value + size : value;
  }
  if (mode !== 'delete') return value;
  if (value < anchor) return value;
  if (value >= anchor + size) return value - size;
  return anchor;
}

function remapRangeForStructureDelete(startIndex, endIndex, deleteStart, count) {
  var rangeStart = Number(startIndex) || 0;
  var rangeEnd = Number(endIndex) || 0;
  var anchor = Number(deleteStart) || 0;
  var size = Math.max(1, Number(count) || 1);
  var deleteEnd = anchor + size - 1;

  if (rangeEnd < anchor) return { start: rangeStart, end: rangeEnd };
  if (rangeStart > deleteEnd) {
    return { start: rangeStart - size, end: rangeEnd - size };
  }

  var nextStart = rangeStart < anchor ? rangeStart : anchor;
  var nextEnd = rangeEnd > deleteEnd ? rangeEnd - size : anchor;
  if (nextEnd < nextStart) nextEnd = nextStart;
  return { start: nextStart, end: nextEnd };
}

function remapCellIdForStructureEdit(cellId, axis, start, count, mode, app) {
  if (!cellId || !app || typeof app.parseCellId !== 'function') return '';
  var parsed = app.parseCellId(cellId);
  if (!parsed || typeof app.formatCellId !== 'function') return '';
  var nextRow = parsed.row;
  var nextCol = parsed.col;
  if (String(axis || '') === 'row') {
    nextRow = remapIndexForStructureEdit(parsed.row, start, count, mode);
  } else {
    nextCol = remapIndexForStructureEdit(parsed.col, start, count, mode);
  }
  return app.formatCellId(nextCol, nextRow);
}

function moveStructuredCell(app, targetId, sourceId, axis, start, count, mode) {
  if (!app || !targetId) return;
  if (!sourceId) {
    app.setRawCellValue(targetId, '', { generatedBy: '' });
    return;
  }
  var rawValue = app.getRawCellValue(sourceId);
  var generatedBy =
    app.storage && typeof app.storage.getGeneratedCellSource === 'function'
      ? String(app.storage.getGeneratedCellSource(app.activeSheetId, sourceId) || '')
      : '';
  var meta = null;
  if (generatedBy) {
    meta = {
      generatedBy: remapCellIdForStructureEdit(
        generatedBy,
        axis,
        start,
        count,
        mode,
        app,
      ),
    };
  }
  if (meta && meta.generatedBy) {
    app.setRawCellValue(targetId, rawValue, meta);
    return;
  }
  app.setRawCellValue(targetId, rawValue, { generatedBy: '' });
}

export function remapNamedCellsForStructureEdit(
  namedCells,
  axis,
  start,
  count,
  mode,
  helpers,
) {
  var source = namedCells && typeof namedCells === 'object' ? namedCells : {};
  var result = {};
  var direction = axis === 'col' ? 'col' : 'row';
  var parseCellId =
    helpers && typeof helpers.parseCellId === 'function'
      ? helpers.parseCellId
      : null;
  var formatCellId =
    helpers && typeof helpers.formatCellId === 'function'
      ? helpers.formatCellId
      : null;
  if (!parseCellId || !formatCellId) return { ...source };

  Object.keys(source).forEach((name) => {
    var ref = source[name];
    if (!ref || typeof ref !== 'object' || !ref.sheetId) {
      result[name] = ref;
      return;
    }

    if (ref.cellId) {
      var parsed = parseCellId(ref.cellId);
      if (!parsed) {
        result[name] = ref;
        return;
      }
      var nextRow = parsed.row;
      var nextCol = parsed.col;
      if (direction === 'row') {
        nextRow = remapIndexForStructureEdit(parsed.row, start, count, mode);
      } else {
        nextCol = remapIndexForStructureEdit(parsed.col, start, count, mode);
      }
      result[name] = {
        sheetId: ref.sheetId,
        cellId: formatCellId(nextCol, nextRow),
      };
      return;
    }

    if (ref.startCellId && ref.endCellId) {
      var parsedStart = parseCellId(ref.startCellId);
      var parsedEnd = parseCellId(ref.endCellId);
      if (!parsedStart || !parsedEnd) {
        result[name] = ref;
        return;
      }
      var nextStartRow = parsedStart.row;
      var nextEndRow = parsedEnd.row;
      var nextStartCol = parsedStart.col;
      var nextEndCol = parsedEnd.col;

      if (direction === 'row') {
        if (mode === 'delete') {
          var nextRows = remapRangeForStructureDelete(
            parsedStart.row,
            parsedEnd.row,
            start,
            count,
          );
          nextStartRow = nextRows.start;
          nextEndRow = nextRows.end;
        } else {
          nextStartRow = remapIndexForStructureEdit(
            parsedStart.row,
            start,
            count,
            mode,
          );
          nextEndRow = remapIndexForStructureEdit(
            parsedEnd.row,
            start,
            count,
            mode,
          );
        }
      } else if (mode === 'delete') {
        var nextCols = remapRangeForStructureDelete(
          parsedStart.col,
          parsedEnd.col,
          start,
          count,
        );
        nextStartCol = nextCols.start;
        nextEndCol = nextCols.end;
      } else {
        nextStartCol = remapIndexForStructureEdit(
          parsedStart.col,
          start,
          count,
          mode,
        );
        nextEndCol = remapIndexForStructureEdit(
          parsedEnd.col,
          start,
          count,
          mode,
        );
      }

      result[name] = {
        sheetId: ref.sheetId,
        startCellId: formatCellId(nextStartCol, nextStartRow),
        endCellId: formatCellId(nextEndCol, nextEndRow),
      };
      return;
    }

    result[name] = ref;
  });

  return result;
}

function applyNamedCellRelinkForStructureEdit(app, axis, start, count, mode) {
  if (
    !app ||
    !app.storage ||
    typeof app.storage.readNamedCells !== 'function' ||
    typeof app.storage.saveNamedCells !== 'function' ||
    typeof app.parseCellId !== 'function' ||
    typeof app.formatCellId !== 'function'
  ) {
    return;
  }

  var current = app.storage.readNamedCells();
  var next = remapNamedCellsForStructureEdit(
    current,
    axis,
    start,
    count,
    mode,
    {
      parseCellId: app.parseCellId.bind(app),
      formatCellId: app.formatCellId.bind(app),
    },
  );
  app.storage.saveNamedCells(next);
}

export function getSelectedColumnBounds(app) {
  var bounds =
    typeof app.getGridBounds === 'function'
      ? app.getGridBounds()
      : { rows: app.table.rows.length - 1 };
  var maxRow = bounds.rows;
  if (
    app.selectionRange &&
    app.selectionRange.startRow === 1 &&
    app.selectionRange.endRow === maxRow
  ) {
    return {
      start: app.selectionRange.startCol,
      end: app.selectionRange.endCol,
    };
  }
  if (app.contextMenuState && app.contextMenuState.type === 'col') {
    return {
      start: app.contextMenuState.index,
      end: app.contextMenuState.index,
    };
  }
  if (app.activeInput) {
    var parsed = app.parseCellId(app.activeInput.id);
    if (parsed) return { start: parsed.col, end: parsed.col };
  }
  return null;
}

export function insertRowsAtContext(app, position) {
  var bounds = app.getSelectedRowBounds();
  if (!bounds) return;
  app.captureHistorySnapshot('rows:' + app.activeSheetId);
  var gridBounds = app.getGridBounds();
  var maxRow = gridBounds.rows;
  var maxCol = gridBounds.cols;
  var count = Math.max(1, bounds.end - bounds.start + 1);
  var insertAfter = String(position || 'before') === 'after';
  var anchor = insertAfter ? bounds.end + 1 : bounds.start;
  var start = Math.max(1, Math.min(anchor, maxRow + 1));

  if (
    typeof app.ensureGridCapacityForStorage === 'function' &&
    typeof app.formatCellId === 'function'
  ) {
    var probeWorkbook = { sheets: {} };
    probeWorkbook.sheets[app.activeSheetId] = { cells: {} };
    probeWorkbook.sheets[app.activeSheetId].cells[
      app.formatCellId(Math.max(1, maxCol), maxRow + count)
    ] = {};
    app.ensureGridCapacityForStorage(probeWorkbook);
    gridBounds = app.getGridBounds();
    maxRow = gridBounds.rows;
    maxCol = gridBounds.cols;
  }

  applyNamedCellRelinkForStructureEdit(app, 'row', start, count, 'insert');

  for (var row = maxRow; row >= start; row--) {
    for (var col = 1; col <= maxCol; col++) {
      var targetId = app.formatCellId(col, row);
      var sourceRow = row - count;
      var sourceId =
        sourceRow >= start ? app.formatCellId(col, sourceRow) : null;
      moveStructuredCell(app, targetId, sourceId, 'row', start, count, 'insert');
    }
  }

  app.selectEntireRow(start, start + count - 1);
  app.aiService.notifyActiveCellChanged();
  app.computeAll();
}

export function deleteRowsAtContext(app) {
  var bounds = app.getSelectedRowBounds();
  if (!bounds) return;
  app.captureHistorySnapshot('rows:' + app.activeSheetId);
  var gridBounds = app.getGridBounds();
  var maxRow = gridBounds.rows;
  var maxCol = gridBounds.cols;
  var start = Math.max(1, Math.min(bounds.start, maxRow));
  var count = Math.max(
    1,
    Math.min(maxRow - start + 1, bounds.end - bounds.start + 1),
  );
  if (count < 1) return;

  applyNamedCellRelinkForStructureEdit(app, 'row', start, count, 'delete');

  for (var row = start; row <= maxRow; row++) {
    for (var col = 1; col <= maxCol; col++) {
      var targetId = app.formatCellId(col, row);
      var sourceRow = row + count;
      var sourceId =
        sourceRow <= maxRow ? app.formatCellId(col, sourceRow) : null;
      moveStructuredCell(app, targetId, sourceId, 'row', start, count, 'delete');
    }
  }

  app.selectEntireRow(start, Math.min(maxRow, start + count - 1));
  app.aiService.notifyActiveCellChanged();
  app.computeAll();
}

export function insertColumnsAtContext(app, position) {
  var bounds = app.getSelectedColumnBounds();
  if (!bounds) return;
  app.captureHistorySnapshot('cols:' + app.activeSheetId);
  var gridBounds = app.getGridBounds();
  var maxRow = gridBounds.rows;
  var maxCol = gridBounds.cols;
  var insertAfter = String(position || 'before') === 'after';
  var anchor = insertAfter ? bounds.end + 1 : bounds.start;
  var start = Math.max(1, Math.min(anchor, maxCol + 1));
  var count = Math.max(1, bounds.end - bounds.start + 1);
  if (count < 1) return;

  if (
    typeof app.ensureGridCapacityForStorage === 'function' &&
    typeof app.formatCellId === 'function'
  ) {
    var probeWorkbook = { sheets: {} };
    probeWorkbook.sheets[app.activeSheetId] = { cells: {} };
    probeWorkbook.sheets[app.activeSheetId].cells[
      app.formatCellId(maxCol + count, Math.max(1, maxRow))
    ] = {};
    app.ensureGridCapacityForStorage(probeWorkbook);
    gridBounds = app.getGridBounds();
    maxRow = gridBounds.rows;
    maxCol = gridBounds.cols;
  }

  applyNamedCellRelinkForStructureEdit(app, 'col', start, count, 'insert');

  for (var col = maxCol; col >= start; col--) {
    for (var row = 1; row <= maxRow; row++) {
      var targetId = app.formatCellId(col, row);
      var sourceCol = col - count;
      var sourceId =
        sourceCol >= start ? app.formatCellId(sourceCol, row) : null;
      moveStructuredCell(app, targetId, sourceId, 'col', start, count, 'insert');
    }
  }

  app.selectEntireColumn(start, start + count - 1);
  app.aiService.notifyActiveCellChanged();
  app.computeAll();
}

export function deleteColumnsAtContext(app) {
  var bounds = app.getSelectedColumnBounds();
  if (!bounds) return;
  app.captureHistorySnapshot('cols:' + app.activeSheetId);
  var gridBounds = app.getGridBounds();
  var maxRow = gridBounds.rows;
  var maxCol = gridBounds.cols;
  var start = Math.max(1, Math.min(bounds.start, maxCol));
  var count = Math.max(
    1,
    Math.min(maxCol - start + 1, bounds.end - bounds.start + 1),
  );
  if (count < 1) return;

  applyNamedCellRelinkForStructureEdit(app, 'col', start, count, 'delete');

  for (var col = start; col <= maxCol; col++) {
    for (var row = 1; row <= maxRow; row++) {
      var targetId = app.formatCellId(col, row);
      var sourceCol = col + count;
      var sourceId =
        sourceCol <= maxCol ? app.formatCellId(sourceCol, row) : null;
      moveStructuredCell(app, targetId, sourceId, 'col', start, count, 'delete');
    }
  }

  app.selectEntireColumn(start, Math.min(maxCol, start + count - 1));
  app.aiService.notifyActiveCellChanged();
  app.computeAll();
}
