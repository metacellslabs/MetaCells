// Description: Grid/table rendering, resizing, keyboard navigation, fill-handle support, and markdown cell display.
import { getGridCellFocusProxy } from './grid-cell-runtime.js';
import {
  focusGridCellByArrow,
  setGridCellEditing,
} from './grid-navigation-runtime.js';
import {
  applyGridCellRender,
  renderGeneratedGridAttachmentCard,
  renderGridAttachmentValue,
  renderGridDownloadAttachmentLink,
} from './grid-render-runtime.js';
import {
  autoFitGridColumnWidth,
  hideGridColumnResizeGuide,
  measureGridCellPreferredWidth,
  moveGridColumnResizeGuide,
  setColumnWidthFromGuide,
  showGridColumnResizeGuide,
} from './grid-resize-runtime.js';
import {
  appendGridColumns,
  appendGridRows,
  buildGridSurface,
  fitGridRowHeaderColumnWidth,
  installGridResizeHandles,
  stabilizeGridHeaderMetrics,
} from './grid-surface-runtime.js';
import {
  applyGridSavedSizes,
  lockGridColumnWidths,
  resetGridColumnWidths,
  setGridColumnWidth,
  setGridRowHeight,
  updateGridTableSize,
} from './grid-size-runtime.js';

export class GridManager {
  constructor(tableElement, rows, cols, defaultColWidth, defaultRowHeight) {
    this.table = tableElement;
    this.rows = rows;
    this.cols = cols;
    this.defaultColWidth = defaultColWidth;
    this.defaultRowHeight = defaultRowHeight;
    this.columnResizeGuide = null;

    this.buildGrid();
    this.fitRowHeaderColumnWidth();
    this.stabilizeHeaderMetrics();
  }

  buildGrid() {
    buildGridSurface(this);
  }

  appendRows(startRowIndex, endRowIndex) {
    appendGridRows(this, startRowIndex, endRowIndex);
  }

  appendColumns(startColIndex, endColIndex) {
    appendGridColumns(this, startColIndex, endColIndex);
  }

  getInputs() {
    return [].slice.call(this.table.querySelectorAll('.cell-anchor-input'));
  }

  getInputByCoords(rowIndex, colIndex) {
    if (
      !this.table ||
      !this.table.rows ||
      !this.table.rows[rowIndex] ||
      !this.table.rows[rowIndex].cells[colIndex]
    ) {
      return null;
    }
    return this.table.rows[rowIndex].cells[colIndex].querySelector(
      '.cell-anchor-input',
    );
  }

  getGridBounds() {
    if (!this.table || !this.table.rows || !this.table.rows.length) {
      return { rows: 0, cols: 0 };
    }
    return {
      rows: Math.max(0, this.table.rows.length - 1),
      cols: Math.max(0, this.table.rows[0].cells.length - 1),
    };
  }

  getTableRow(rowIndex) {
    if (!this.table || !this.table.rows) return null;
    if (!Number.isFinite(rowIndex) || rowIndex < 0) return null;
    return this.table.rows[rowIndex] || null;
  }

  getHeaderCell(colIndex) {
    var headerRow = this.getTableRow(0);
    if (!headerRow || !headerRow.cells) return null;
    if (!Number.isFinite(colIndex) || colIndex < 0) return null;
    return headerRow.cells[colIndex] || null;
  }

  getRowHeaderCell(rowIndex) {
    var row = this.getTableRow(rowIndex);
    if (!row || !row.cells) return null;
    return row.cells[0] || null;
  }

  getFocusProxy(input) {
    return getGridCellFocusProxy(input);
  }

  fitRowHeaderColumnWidth() {
    fitGridRowHeaderColumnWidth(this);
  }

  stabilizeHeaderMetrics() {
    stabilizeGridHeaderMetrics(this);
  }

  setColumnWidth(colIndex, width) {
    return setGridColumnWidth(this, colIndex, width);
  }

  lockAllColumnWidths() {
    lockGridColumnWidths(this);
  }

  setColumnWidthFromGuide(colIndex, guideLeftX, columnLeftX) {
    return setColumnWidthFromGuide(this, colIndex, guideLeftX, columnLeftX);
  }

  setRowHeight(rowIndex, height) {
    return setGridRowHeight(this, rowIndex, height);
  }

  applySavedSizes(getColumnWidth, getRowHeight) {
    applyGridSavedSizes(this, getColumnWidth, getRowHeight);
  }

  resetColumnWidths(clearColumnWidth) {
    resetGridColumnWidths(this, clearColumnWidth);
  }

  installResizeHandles(onColumnResize, onRowResize, options) {
    installGridResizeHandles(this, onColumnResize, onRowResize, options);
  }

  autoFitColumnWidth(colIndex) {
    return autoFitGridColumnWidth(this, colIndex);
  }

  measureCellPreferredWidth(cell) {
    return measureGridCellPreferredWidth(cell);
  }

  showColumnResizeGuide(clientX) {
    showGridColumnResizeGuide(this, clientX);
  }

  moveColumnResizeGuide(clientX) {
    moveGridColumnResizeGuide(this, clientX);
  }

  hideColumnResizeGuide() {
    hideGridColumnResizeGuide(this);
  }

  updateTableSize() {
    updateGridTableSize(this);
  }

  setEditing(input, editing) {
    setGridCellEditing(this, input, editing);
  }

  focusCellByArrow(input, key) {
    return focusGridCellByArrow(this, input, key);
  }

  renderCellValue(input, value, isEditing, hasFormula, options) {
    applyGridCellRender(input, value, isEditing, hasFormula, {
      ...(options && typeof options === 'object' ? options : null),
      cellId: input && input.id ? input.id : '',
      cellContentStore: this.cellContentStore || null,
    });
  }

  renderAttachmentValue(attachment) {
    return renderGridAttachmentValue(attachment);
  }

  renderDownloadAttachmentLink(label, href) {
    return renderGridDownloadAttachmentLink(label, href);
  }

  renderGeneratedAttachmentCard(label, href, hasDirectFileUrl, type) {
    return renderGeneratedGridAttachmentCard(
      label,
      href,
      hasDirectFileUrl,
      type,
    );
  }
}
