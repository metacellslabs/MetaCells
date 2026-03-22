import { deepClone, isPlainObject, normalizeTabs } from './workbook-storage-core.js';

export function installWorkbookStorageSheetMethods(WorkbookStorageAdapter) {
  Object.assign(WorkbookStorageAdapter.prototype, {
    getColumnWidth(sheetId, colIndex) {
      var sheet = this.ensureSheet(sheetId);
      var value = sheet ? parseFloat(sheet.columnWidths[String(colIndex)]) : NaN;
      return isNaN(value) ? null : value;
    },

    setColumnWidth(sheetId, colIndex, width) {
      var sheet = this.ensureSheet(sheetId);
      if (!sheet) return;
      sheet.columnWidths[String(colIndex)] = String(width);
    },

    clearColumnWidth(sheetId, colIndex) {
      var sheet = this.ensureSheet(sheetId);
      if (!sheet) return;
      delete sheet.columnWidths[String(colIndex)];
    },

    getRowHeight(sheetId, rowIndex) {
      var sheet = this.ensureSheet(sheetId);
      var value = sheet ? parseFloat(sheet.rowHeights[String(rowIndex)]) : NaN;
      return isNaN(value) ? null : value;
    },

    setRowHeight(sheetId, rowIndex, height) {
      var sheet = this.ensureSheet(sheetId);
      if (!sheet) return;
      sheet.rowHeights[String(rowIndex)] = String(height);
    },

    getSheetGridSize(sheetId) {
      var sheet = this.ensureSheet(sheetId);
      if (!sheet) return { rows: 0, cols: 0 };
      var rows = Number(sheet.rows && sheet.rows.count) || 0;
      var cols = Number(sheet.cols && sheet.cols.count) || 0;
      return {
        rows: rows > 0 ? rows : 0,
        cols: cols > 0 ? cols : 0,
      };
    },

    setSheetGridSize(sheetId, size) {
      var sheet = this.ensureSheet(sheetId);
      if (!sheet) return;
      var next = size && typeof size === 'object' ? size : {};
      var rows = Math.max(0, Number(next.rows) || 0);
      var cols = Math.max(0, Number(next.cols) || 0);
      sheet.rows = rows ? { count: rows } : {};
      sheet.cols = cols ? { count: cols } : {};
    },

    getTabs() {
      return normalizeTabs(this.workbook.tabs);
    },

    setTabs(tabs) {
      this.workbook.tabs = normalizeTabs(tabs);
    },

    getActiveTabId(defaultSheetId) {
      return String(this.workbook.activeTabId || defaultSheetId || '');
    },

    setActiveTabId(sheetId) {
      this.workbook.activeTabId = String(sheetId || '');
    },

    getAIMode() {
      return this.workbook.aiMode === 'auto' ? 'auto' : 'manual';
    },

    setAIMode(mode) {
      this.workbook.aiMode = mode === 'auto' ? 'auto' : 'manual';
    },

    getReportContent(tabId) {
      var id = String(tabId || '');
      if (!id) id = 'report';
      var sheet = this.ensureSheet(id);
      return sheet ? String(sheet.reportContent || '') : '';
    },

    setReportContent(tabId, content) {
      var id = String(tabId || '');
      if (!id) id = 'report';
      var sheet = this.ensureSheet(id);
      if (!sheet) return;
      sheet.reportContent = String(content == null ? '' : content);
    },

    getNamedCells() {
      return deepClone(this.workbook.namedCells || {});
    },

    setNamedCells(namedCells) {
      this.workbook.namedCells = isPlainObject(namedCells)
        ? deepClone(namedCells)
        : {};
    },

    getCacheValue(key) {
      return Object.prototype.hasOwnProperty.call(this.workbook.caches, key)
        ? this.workbook.caches[key]
        : undefined;
    },

    setCacheValue(key, value) {
      this.workbook.caches[String(key)] = String(value == null ? '' : value);
    },

    removeCacheValue(key) {
      delete this.workbook.caches[String(key)];
    },

    clearSheet(sheetId) {
      delete this.workbook.sheets[String(sheetId || '')];
    },
  });
}
