import {
  applyFullscreenMarkdownCommand as applyFullscreenMarkdownCommandRuntime,
  closeFullscreenCell as closeFullscreenCellRuntime,
  copyCellValue as copyCellValueRuntime,
  openFullscreenCell as openFullscreenCellRuntime,
  runFormulaForCell as runFormulaForCellRuntime,
  saveFullscreenDraft as saveFullscreenDraftRuntime,
  startFullscreenEditing as startFullscreenEditingRuntime,
  setFullscreenDraft as setFullscreenDraftRuntime,
  setFullscreenMode as setFullscreenModeRuntime,
  setupFullscreenOverlay as setupFullscreenOverlayRuntime,
} from './fullscreen-runtime.js';

export function installFullscreenMethods(SpreadsheetApp) {
  SpreadsheetApp.prototype.setupFullscreenOverlay = function () {
    setupFullscreenOverlayRuntime(this);
  };

  SpreadsheetApp.prototype.copyCellValue = function (input) {
    copyCellValueRuntime(this, input);
  };

  SpreadsheetApp.prototype.runFormulaForCell = function (input) {
    runFormulaForCellRuntime(this, input);
  };

  SpreadsheetApp.prototype.openFullscreenCell = function (input) {
    openFullscreenCellRuntime(this, input);
  };

  SpreadsheetApp.prototype.setFullscreenDraft = function (value) {
    setFullscreenDraftRuntime(this, value);
  };

  SpreadsheetApp.prototype.startFullscreenEditing = function (mode) {
    startFullscreenEditingRuntime(this, mode);
  };

  SpreadsheetApp.prototype.setFullscreenMode = function (mode) {
    setFullscreenModeRuntime(this, mode);
  };

  SpreadsheetApp.prototype.applyFullscreenMarkdownCommand = function (command) {
    applyFullscreenMarkdownCommandRuntime(this, command);
  };

  SpreadsheetApp.prototype.saveFullscreenDraft = function () {
    saveFullscreenDraftRuntime(this);
  };

  SpreadsheetApp.prototype.closeFullscreenCell = function () {
    closeFullscreenCellRuntime(this);
  };
}
