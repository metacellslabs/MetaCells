export function setupColumnSort(app) {
  var bounds =
    typeof app.getGridBounds === 'function'
      ? app.getGridBounds()
      : { cols: app.table.rows[0].cells.length - 1 };
  for (var colIndex = 1; colIndex <= bounds.cols; colIndex++) {
    var cell =
      typeof app.getHeaderCell === 'function'
        ? app.getHeaderCell(colIndex)
        : app.table.rows[0].cells[colIndex];
    if (!cell || cell.dataset.sortBound === 'true') continue;
    var text = cell.textContent;
    cell.textContent = '';
    var label = document.createElement('span');
    label.textContent = text;
    var sortBtn = document.createElement('button');
    sortBtn.type = 'button';
    sortBtn.className = 'sort-button';
    sortBtn.textContent = '⇅';
    sortBtn.dataset.colIndex = String(colIndex);
    sortBtn.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      var idx = parseInt(e.currentTarget.dataset.colIndex, 10);
      app.toggleSortByColumn(idx);
    });
    cell.appendChild(label);
    cell.appendChild(sortBtn);
    cell.dataset.sortBound = 'true';
  }
}

export function getSortState(app) {
  if (!app.sortStateBySheet[app.activeSheetId]) {
    app.sortStateBySheet[app.activeSheetId] = {};
  }
  return app.sortStateBySheet[app.activeSheetId];
}

export function normalizeSortValue(app, value) {
  if (value == null || value === '')
    return { empty: true, type: 'string', value: '' };
  if (typeof value === 'number' && !isNaN(value))
    return { empty: false, type: 'number', value: value };
  var n = parseFloat(value);
  if (!isNaN(n) && String(value).trim() !== '')
    return { empty: false, type: 'number', value: n };
  return { empty: false, type: 'string', value: String(value).toLowerCase() };
}

export function compareSortValues(app, a, b, direction) {
  if (a.empty && b.empty) return 0;
  if (a.empty) return 1;
  if (b.empty) return -1;

  var multiplier = direction === 'desc' ? -1 : 1;
  if (a.type === 'number' && b.type === 'number') {
    if (a.value === b.value) return 0;
    return a.value < b.value ? -1 * multiplier : 1 * multiplier;
  }

  var left = String(a.value);
  var right = String(b.value);
  var cmp = left.localeCompare(right, undefined, {
    numeric: true,
    sensitivity: 'base',
  });
  if (cmp === 0) return 0;
  return cmp < 0 ? -1 * multiplier : 1 * multiplier;
}

function readCellTransferState(app, cellId) {
  if (!cellId) return null;
  return {
    raw: app.getRawCellValue(cellId),
    schedule: app.getCellSchedule(cellId),
  };
}

function writeCellTransferState(app, cellId, state) {
  var next = state && typeof state === 'object' ? state : null;
  app.setCellSchedule(cellId, next ? next.schedule || null : null);
  app.setRawCellValue(
    cellId,
    next ? next.raw || '' : '',
    { preserveSchedule: true },
  );
}

export function toggleSortByColumn(app, colIndex) {
  var state = app.getSortState();
  var current = state[colIndex];
  var next = current === 'asc' ? 'desc' : 'asc';
  state.colIndex = colIndex;
  state[colIndex] = next;
  app.captureHistorySnapshot('sort:' + app.activeSheetId);

  app.runWithAISuppressed(() => {
    app.sortRowsByColumn(colIndex, next);
  });
  app.updateSortIcons();
}

export function sortRowsByColumn(app, colIndex, direction, skipCompute) {
  var rows = [];
  var bounds =
    typeof app.getGridBounds === 'function'
      ? app.getGridBounds()
      : {
          rows: app.table.rows.length - 1,
          cols: app.table.rows[0].cells.length - 1,
        };
  var rowCount = bounds.rows + 1;
  var colCount = bounds.cols + 1;

  for (var rowIndex = 1; rowIndex < rowCount; rowIndex++) {
    var keyCellId = app.cellIdFrom(colIndex, rowIndex);
    var keyValue;
    try {
      var cache = app.computedValuesBySheet[app.activeSheetId] || {};
      keyValue = Object.prototype.hasOwnProperty.call(cache, keyCellId)
        ? cache[keyCellId]
        : app.getRawCellValue(keyCellId);
    } catch (e) {
      keyValue = app.getRawCellValue(keyCellId);
    }

    var raw = {};
    for (var c = 1; c < colCount; c++) {
      var cellId = app.cellIdFrom(c, rowIndex);
      raw[c] = readCellTransferState(app, cellId);
    }

    rows.push({
      sourceRowIndex: rowIndex,
      sortValue: app.normalizeSortValue(keyValue),
      raw: raw,
    });
  }

  rows.sort((a, b) =>
    app.compareSortValues(a.sortValue, b.sortValue, direction),
  );

  for (var targetRow = 1; targetRow < rowCount; targetRow++) {
    var source = rows[targetRow - 1];
    var dRow = targetRow - source.sourceRowIndex;
    for (var col = 1; col < colCount; col++) {
      var targetCellId = app.cellIdFrom(col, targetRow);
      var sourceState = source.raw[col] || null;
      var rawValue = sourceState && typeof sourceState.raw === 'string'
        ? sourceState.raw
        : '';
      var nextValue =
        rawValue.charAt(0) === '='
          ? app.shiftFormulaReferences(rawValue, dRow, 0)
          : rawValue;
      writeCellTransferState(app, targetCellId, {
        raw: nextValue,
        schedule: sourceState ? sourceState.schedule || null : null,
      });
    }
  }

  if (!skipCompute) app.computeAll();
}

export function updateSortIcons(app) {
  var state = app.getSortState();
  var activeCol = state.colIndex;
  var bounds =
    typeof app.getGridBounds === 'function'
      ? app.getGridBounds()
      : { cols: app.table.rows[0].cells.length - 1 };

  for (var colIndex = 1; colIndex <= bounds.cols; colIndex++) {
    var headerCell =
      typeof app.getHeaderCell === 'function'
        ? app.getHeaderCell(colIndex)
        : app.table.rows[0].cells[colIndex];
    var btn = headerCell ? headerCell.querySelector('.sort-button') : null;
    if (!btn) continue;
    var isActive = colIndex === activeCol && !!state[colIndex];
    btn.classList.toggle('sort-active', isActive);
    if (isActive && state[colIndex] === 'asc') btn.textContent = '↑';
    else if (isActive && state[colIndex] === 'desc') btn.textContent = '↓';
    else btn.textContent = '⇅';
  }
}

export function applyAutoResort(app) {
  if (app.isResorting) return;
  var state = app.getSortState();
  var colIndex = state.colIndex;
  var direction = colIndex ? state[colIndex] : null;
  if (!colIndex || !direction) return false;

  app.isResorting = true;
  try {
    app.runWithAISuppressed(() => {
      app.sortRowsByColumn(colIndex, direction, true);
    });
    return true;
  } finally {
    app.isResorting = false;
  }
}
