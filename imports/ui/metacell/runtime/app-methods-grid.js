import {
  forEachInput as forEachInputRuntime,
  getFirstAvailableInput as getFirstAvailableInputRuntime,
  getMountedInputs as getMountedInputsRuntime,
  applyActiveSheetLayout as applyActiveSheetLayoutRuntime,
  ensureGridCapacityForStorage as ensureGridCapacityForStorageRuntime,
  getStorageGridBounds as getStorageGridBoundsRuntime,
  refreshGridReferences as refreshGridReferencesRuntime,
} from './grid-dom-runtime.js';
import {
  applyAutoResort as applyAutoResortRuntime,
  compareSortValues as compareSortValuesRuntime,
  getSortState as getSortStateRuntime,
  normalizeSortValue as normalizeSortValueRuntime,
  setupColumnSort as setupColumnSortRuntime,
  setupGridResizing as setupGridResizingRuntime,
  sortRowsByColumn as sortRowsByColumnRuntime,
  toggleSortByColumn as toggleSortByColumnRuntime,
  updateSortIcons as updateSortIconsRuntime,
} from './structure-runtime.js';
import {
  computeAll as computeAllRuntime,
  hasUncomputedCells as hasUncomputedCellsRuntime,
  startUncomputedMonitor as startUncomputedMonitorRuntime,
  renderCurrentSheetFromStorage as renderCurrentSheetFromStorageRuntime,
} from './compute-runtime.js';
import {
  applyRightOverflowText as applyRightOverflowTextRuntime,
  measureOutputRequiredWidth as measureOutputRequiredWidthRuntime,
} from './compute-layout-runtime.js';
import { getRenderTargetsForComputeResult as getRenderTargetsForComputeResultRuntime } from './compute-support-runtime.js';
import {
  getCellElementByCoords as getCellElementByCoordsRuntime,
  getCellElementById as getCellElementByIdRuntime,
  getCellInputByCoords as getCellInputByCoordsRuntime,
  getCellInputById as getCellInputByIdRuntime,
  getHeaderCellByIndex as getHeaderCellByIndexRuntime,
  getGridBounds as getGridBoundsRuntime,
  getRowHeaderCellByIndex as getRowHeaderCellByIndexRuntime,
  getTableRowElement as getTableRowElementRuntime,
} from './dom-cell-resolver-runtime.js';

export function installGridMethods(SpreadsheetApp) {
  SpreadsheetApp.prototype.setupGridResizing = function () {
    setupGridResizingRuntime(this);
  };

  SpreadsheetApp.prototype.setupColumnSort = function () {
    setupColumnSortRuntime(this);
  };

  SpreadsheetApp.prototype.getSortState = function () {
    return getSortStateRuntime(this);
  };

  SpreadsheetApp.prototype.cellIdFrom = function (colIndex, rowIndex) {
    return this.columnIndexToLabel(colIndex) + rowIndex;
  };

  SpreadsheetApp.prototype.normalizeSortValue = function (value) {
    return normalizeSortValueRuntime(this, value);
  };

  SpreadsheetApp.prototype.compareSortValues = function (a, b, direction) {
    return compareSortValuesRuntime(this, a, b, direction);
  };

  SpreadsheetApp.prototype.toggleSortByColumn = function (colIndex) {
    toggleSortByColumnRuntime(this, colIndex);
  };

  SpreadsheetApp.prototype.sortRowsByColumn = function (
    colIndex,
    direction,
    skipCompute,
  ) {
    sortRowsByColumnRuntime(this, colIndex, direction, skipCompute);
  };

  SpreadsheetApp.prototype.updateSortIcons = function () {
    updateSortIconsRuntime(this);
  };

  SpreadsheetApp.prototype.applyAutoResort = function () {
    return applyAutoResortRuntime(this);
  };

  SpreadsheetApp.prototype.applyActiveSheetLayout = function () {
    applyActiveSheetLayoutRuntime(this);
  };

  SpreadsheetApp.prototype.refreshGridReferences = function () {
    refreshGridReferencesRuntime(this);
  };

  SpreadsheetApp.prototype.getMountedInputs = function () {
    return getMountedInputsRuntime(this);
  };

  SpreadsheetApp.prototype.forEachInput = function (callback, options) {
    forEachInputRuntime(this, callback, options);
  };

  SpreadsheetApp.prototype.getFirstAvailableInput = function (options) {
    return getFirstAvailableInputRuntime(this, options);
  };

  SpreadsheetApp.prototype.getStorageGridBounds = function (workbookSnapshot) {
    return getStorageGridBoundsRuntime(this, workbookSnapshot);
  };

  SpreadsheetApp.prototype.ensureGridCapacityForStorage = function (
    workbookSnapshot,
  ) {
    ensureGridCapacityForStorageRuntime(this, workbookSnapshot);
  };

  SpreadsheetApp.prototype.renderCurrentSheetFromStorage = function () {
    renderCurrentSheetFromStorageRuntime(this);
  };

  SpreadsheetApp.prototype.getRenderTargetsForComputeResult = function (
    computedValues,
    didResort,
  ) {
    return getRenderTargetsForComputeResultRuntime(
      this,
      computedValues,
      didResort,
    );
  };

  SpreadsheetApp.prototype.computeAll = function () {
    return computeAllRuntime(this, arguments.length > 0 ? arguments[0] : {});
  };

  SpreadsheetApp.prototype.applyRightOverflowText = function () {
    applyRightOverflowTextRuntime(this);
  };

  SpreadsheetApp.prototype.measureOutputRequiredWidth = function (output) {
    return measureOutputRequiredWidthRuntime(this, output);
  };

  SpreadsheetApp.prototype.getCellInput = function (cellId) {
    return getCellInputByIdRuntime(this, cellId);
  };

  SpreadsheetApp.prototype.getCellElement = function (cellId) {
    return getCellElementByIdRuntime(this, cellId);
  };

  SpreadsheetApp.prototype.getCellInputByCoords = function (rowIndex, colIndex) {
    return getCellInputByCoordsRuntime(this, rowIndex, colIndex);
  };

  SpreadsheetApp.prototype.getCellElementByCoords = function (
    rowIndex,
    colIndex,
  ) {
    return getCellElementByCoordsRuntime(this, rowIndex, colIndex);
  };

  SpreadsheetApp.prototype.getGridBounds = function () {
    return getGridBoundsRuntime(this);
  };

  SpreadsheetApp.prototype.getTableRowElement = function (rowIndex) {
    return getTableRowElementRuntime(this, rowIndex);
  };

  SpreadsheetApp.prototype.getHeaderCell = function (colIndex) {
    return getHeaderCellByIndexRuntime(this, colIndex);
  };

  SpreadsheetApp.prototype.getRowHeaderCell = function (rowIndex) {
    return getRowHeaderCellByIndexRuntime(this, rowIndex);
  };

  SpreadsheetApp.prototype.hasUncomputedCells = function () {
    return hasUncomputedCellsRuntime(this);
  };

  SpreadsheetApp.prototype.startUncomputedMonitor = function () {
    startUncomputedMonitorRuntime(this);
  };

  SpreadsheetApp.prototype.parseCellId = function (cellId) {
    var match = /^([A-Za-z]+)([0-9]+)$/.exec(String(cellId || ''));
    if (!match) return null;
    return {
      col: this.columnLabelToIndex(match[1].toUpperCase()),
      row: parseInt(match[2], 10),
    };
  };

  SpreadsheetApp.prototype.columnLabelToIndex = function (label) {
    var result = 0;
    for (var i = 0; i < label.length; i++) {
      result = result * 26 + (label.charCodeAt(i) - 64);
    }
    return result;
  };

  SpreadsheetApp.prototype.columnIndexToLabel = function (index) {
    var n = Math.max(1, index);
    var label = '';
    while (n > 0) {
      var rem = (n - 1) % 26;
      label = String.fromCharCode(65 + rem) + label;
      n = Math.floor((n - 1) / 26);
    }
    return label;
  };

  SpreadsheetApp.prototype.formatCellId = function (col, row) {
    return this.columnIndexToLabel(col) + row;
  };

  SpreadsheetApp.prototype.shiftFormulaReferences = function (
    rawValue,
    dRow,
    dCol,
  ) {
    if (!rawValue) return rawValue;
    var prefix = rawValue.charAt(0);
    if (prefix !== '=' && prefix !== "'" && prefix !== '>' && prefix !== '#')
      return rawValue;
    var body = prefix === '=' ? rawValue.substring(1) : rawValue;
    var replaced = body.replace(
      /((?:'[^']+'|[A-Za-z][A-Za-z0-9 _-]*)!)?(\$?)([A-Za-z]+)(\$?)([0-9]+)(:(\$?)([A-Za-z]+)(\$?)([0-9]+))?/g,
      (
        _,
        qualifier,
        colDollar1,
        col1,
        rowDollar1,
        row1,
        rangePart,
        colDollar2,
        col2,
        rowDollar2,
        row2,
      ) => {
        var shiftRef = (colDollar, col, rowDollar, row) => {
          var parsed = this.parseCellId(col + row);
          if (!parsed) return colDollar + col + rowDollar + row;
          var nextCol = colDollar
            ? parsed.col
            : Math.max(1, parsed.col + dCol);
          var nextRow = rowDollar
            ? parsed.row
            : Math.max(1, parsed.row + dRow);
          return (
            colDollar +
            this.columnIndexToLabel(nextCol) +
            rowDollar +
            nextRow
          );
        };

        var left = shiftRef(colDollar1, col1, rowDollar1, row1);
        if (rangePart && col2) {
          return (
            (qualifier || '') +
            left +
            ':' +
            shiftRef(colDollar2, col2, rowDollar2, row2)
          );
        }
        return (qualifier || '') + left;
      },
    );
    return prefix === '=' ? '=' + replaced : replaced;
  };
}
