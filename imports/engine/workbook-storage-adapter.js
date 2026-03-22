import {
  createEmptyWorkbookCore,
  deepClone,
  isPlainObject,
  normalizeWorkbook,
} from './workbook-storage-core.js';
import { installWorkbookStorageCellMethods } from './workbook-storage-cell-runtime.js';
import { installWorkbookStorageDependencyMethods } from './workbook-storage-dependency-runtime.js';
import { installWorkbookStorageSheetMethods } from './workbook-storage-sheet-runtime.js';

export class WorkbookStorageAdapter {
  constructor(workbook) {
    this.workbook = normalizeWorkbook(workbook);
  }

  snapshot() {
    return deepClone(this.workbook);
  }

  replaceAll(nextWorkbook) {
    this.workbook = normalizeWorkbook(nextWorkbook);
  }

  ensureSheet(sheetId) {
    var id = String(sheetId || '');
    if (!id) return null;
    if (!isPlainObject(this.workbook.sheets[id])) {
      this.workbook.sheets[id] = {
        cells: {},
        columnWidths: {},
        rowHeights: {},
        rows: {},
        cols: {},
        reportContent: '',
      };
    }
    var sheet = this.workbook.sheets[id];
    if (!isPlainObject(sheet.cells)) sheet.cells = {};
    if (!isPlainObject(sheet.columnWidths)) sheet.columnWidths = {};
    if (!isPlainObject(sheet.rowHeights)) sheet.rowHeights = {};
    if (!isPlainObject(sheet.rows)) sheet.rows = {};
    if (!isPlainObject(sheet.cols)) sheet.cols = {};
    if (typeof sheet.reportContent !== 'string')
      sheet.reportContent = String(sheet.reportContent || '');
    return sheet;
  }

}

export function createEmptyWorkbook() {
  return createEmptyWorkbookCore();
}

installWorkbookStorageDependencyMethods(WorkbookStorageAdapter);
installWorkbookStorageCellMethods(WorkbookStorageAdapter);
installWorkbookStorageSheetMethods(WorkbookStorageAdapter);
