import { Meteor } from "meteor/meteor";
import { WorkbookStorageAdapter } from "./runtime/workbook-storage-adapter.js";

class SheetDocStorageCore extends WorkbookStorageAdapter {
  constructor(sheetId, initialWorkbook) {
    super(initialWorkbook);
    this.sheetId = sheetId;
    this.flushTimer = null;
    this.flushDelayMs = 250;
  }

  scheduleFlush() {
    if (this.flushTimer) {
      clearTimeout(this.flushTimer);
    }

    this.flushTimer = setTimeout(() => {
      this.flushTimer = null;
      Meteor.callAsync("sheets.saveWorkbook", this.sheetId, this.snapshot()).catch((error) => {
        console.error("Failed to save workbook", error);
      });
    }, this.flushDelayMs);
  }

  replaceAll(nextWorkbook) {
    super.replaceAll(nextWorkbook);
  }

  setCellSource(sheetId, cellId, value, meta) {
    super.setCellSource(sheetId, cellId, value, meta);
    this.scheduleFlush();
  }

  setComputedCellValue(sheetId, cellId, value, state) {
    super.setComputedCellValue(sheetId, cellId, value, state);
    this.scheduleFlush();
  }

  setCellRuntimeState(sheetId, cellId, updates) {
    super.setCellRuntimeState(sheetId, cellId, updates);
    this.scheduleFlush();
  }

  setCellDependencies(sheetId, cellId, dependencies) {
    super.setCellDependencies(sheetId, cellId, dependencies);
    this.scheduleFlush();
  }

  clearCellDependencies(sheetId, cellId) {
    super.clearCellDependencies(sheetId, cellId);
    this.scheduleFlush();
  }

  setColumnWidth(sheetId, colIndex, width) {
    super.setColumnWidth(sheetId, colIndex, width);
    this.scheduleFlush();
  }

  clearColumnWidth(sheetId, colIndex) {
    super.clearColumnWidth(sheetId, colIndex);
    this.scheduleFlush();
  }

  setRowHeight(sheetId, rowIndex, height) {
    super.setRowHeight(sheetId, rowIndex, height);
    this.scheduleFlush();
  }

  setTabs(tabs) {
    super.setTabs(tabs);
    this.scheduleFlush();
  }

  setActiveTabId(sheetId) {
    super.setActiveTabId(sheetId);
    this.scheduleFlush();
  }

  setAIMode(mode) {
    super.setAIMode(mode);
    this.scheduleFlush();
  }

  setReportContent(tabId, content) {
    super.setReportContent(tabId, content);
    this.scheduleFlush();
  }

  setNamedCells(namedCells) {
    super.setNamedCells(namedCells);
    this.scheduleFlush();
  }

  setCacheValue(key, value) {
    super.setCacheValue(key, value);
    this.scheduleFlush();
  }

  removeCacheValue(key) {
    super.removeCacheValue(key);
    this.scheduleFlush();
  }

  clearSheet(sheetId) {
    super.clearSheet(sheetId);
    this.scheduleFlush();
  }
}

export function createSheetDocStorage(sheetId, initialWorkbook) {
  return new SheetDocStorageCore(sheetId, initialWorkbook);
}
