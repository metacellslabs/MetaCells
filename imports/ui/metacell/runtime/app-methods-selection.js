import {
  applyHeaderSelectionRange as applyHeaderSelectionRangeRuntime,
  bindHeaderSelectionEvents as bindHeaderSelectionEventsRuntime,
  cellHasAnyRawValue as cellHasAnyRawValueRuntime,
  clearActiveInput as clearActiveInputRuntime,
  clearSelectionRange as clearSelectionRangeRuntime,
  collectDependencyHintsFromRaw as collectDependencyHintsFromRawRuntime,
  ensureActiveCell as ensureActiveCellRuntime,
  extendSelectionRangeTowardCell as extendSelectionRangeTowardCellRuntime,
  findAdjacentCellId as findAdjacentCellIdRuntime,
  findJumpTargetCellId as findJumpTargetCellIdRuntime,
  getSelectionEdgeInputForDirection as getSelectionEdgeInputForDirectionRuntime,
  moveSelectionByArrow as moveSelectionByArrowRuntime,
  moveToNextFilledCell as moveToNextFilledCellRuntime,
  onHeaderSelectionDragMove as onHeaderSelectionDragMoveRuntime,
  selectEntireColumn as selectEntireColumnRuntime,
  selectEntireRow as selectEntireRowRuntime,
  selectNearestValueRegionFromActive as selectNearestValueRegionFromActiveRuntime,
  selectWholeSheetRegion as selectWholeSheetRegionRuntime,
  setActiveInput as setActiveInputRuntime,
  setSelectionAnchor as setSelectionAnchorRuntime,
  setSelectionRange as setSelectionRangeRuntime,
  startHeaderSelectionDrag as startHeaderSelectionDragRuntime,
} from './selection-runtime.js';
import {
  applyPastedText as applyPastedTextRuntime,
  clearFillRangeHighlight as clearFillRangeHighlightRuntime,
  clearSelectedCells as clearSelectedCellsRuntime,
  copySelectedRangeDebugToClipboard as copySelectedRangeDebugToClipboardRuntime,
  copySelectedRangeToClipboard as copySelectedRangeToClipboardRuntime,
  copyTextFallback as copyTextFallbackRuntime,
  finishFillDrag as finishFillDragRuntime,
  finishSelectionDrag as finishSelectionDragRuntime,
  getSelectedCellIds as getSelectedCellIdsRuntime,
  getSelectedRangeText as getSelectedRangeTextRuntime,
  getSelectionStartCellId as getSelectionStartCellIdRuntime,
  highlightFillRange as highlightFillRangeRuntime,
  onFillDragMove as onFillDragMoveRuntime,
  onSelectionDragMove as onSelectionDragMoveRuntime,
  pasteFromClipboard as pasteFromClipboardRuntime,
  startFillDrag as startFillDragRuntime,
  startSelectionDrag as startSelectionDragRuntime,
  syncMentionPreviewToUi as syncMentionPreviewToUiRuntime,
} from './drag-clipboard-runtime.js';
import {
  deleteColumnsAtContext as deleteColumnsAtContextRuntime,
  deleteRowsAtContext as deleteRowsAtContextRuntime,
  getSelectedColumnBounds as getSelectedColumnBoundsRuntime,
  getSelectedRowBounds as getSelectedRowBoundsRuntime,
  insertColumnsAtContext as insertColumnsAtContextRuntime,
  insertRowsAtContext as insertRowsAtContextRuntime,
} from './structure-runtime.js';
import {
  clearSelectionRangeModel as clearSelectionRangeModelRuntime,
  getSelectionActiveCellId as getSelectionActiveCellIdRuntime,
  getSelectionAnchorCellId as getSelectionAnchorCellIdRuntime,
  getSelectionFillRange as getSelectionFillRangeRuntime,
  getSelectionRangeModel as getSelectionRangeModelRuntime,
  setSelectionActiveCellId as setSelectionActiveCellIdRuntime,
  setSelectionAnchorCellId as setSelectionAnchorCellIdRuntime,
  setSelectionFillRange as setSelectionFillRangeRuntime,
  setSelectionRangeModel as setSelectionRangeModelRuntime,
} from './selection-model.js';
import {
  clearSpillSheetState as clearSpillSheetStateRuntime,
  getSpillEntry as getSpillEntryRuntime,
  getSpillSourceForCell as getSpillSourceForCellRuntime,
  listSpillEntries as listSpillEntriesRuntime,
  setSpillEntry as setSpillEntryRuntime,
} from './spill-model.js';
import {
  applySpillVisualStateFromModel as applySpillVisualStateFromModelRuntime,
  clearSpillVisualState as clearSpillVisualStateRuntime,
} from './spill-runtime.js';
import {
  applyActiveCellVisualState as applyActiveCellVisualStateRuntime,
  applySelectionRangeVisualState as applySelectionRangeVisualStateRuntime,
  applySpillSelectionHighlight as applySpillSelectionHighlightRuntime,
  clearSelectionVisualState as clearSelectionVisualStateRuntime,
  clearSpillSelectionHighlight as clearSpillSelectionHighlightRuntime,
  clearHeaderSelectionHighlight as clearHeaderSelectionHighlightRuntime,
  highlightSelectionRange as highlightSelectionRangeRuntime,
  updateAxisHeaderHighlight as updateAxisHeaderHighlightVisualRuntime,
} from './selection-visual-runtime.js';
import {
  applyDependencyHighlight as applyDependencyHighlightVisualRuntime,
  clearDependencyHighlight as clearDependencyHighlightVisualRuntime,
} from './dependency-visual-runtime.js';

export function installSelectionMethods(SpreadsheetApp) {
  SpreadsheetApp.prototype.getSelectionActiveCellId = function () {
    return getSelectionActiveCellIdRuntime(this);
  };

  SpreadsheetApp.prototype.setSelectionActiveCellId = function (cellId) {
    var result = setSelectionActiveCellIdRuntime(this, cellId);
    this.publishUiState();
    return result;
  };

  SpreadsheetApp.prototype.getSelectionAnchorCellId = function () {
    return getSelectionAnchorCellIdRuntime(this);
  };

  SpreadsheetApp.prototype.setSelectionAnchorCellId = function (cellId) {
    var result = setSelectionAnchorCellIdRuntime(this, cellId);
    this.publishUiState();
    return result;
  };

  SpreadsheetApp.prototype.getSelectionRange = function () {
    return getSelectionRangeModelRuntime(this);
  };

  SpreadsheetApp.prototype.setSelectionRangeState = function (range) {
    var result = setSelectionRangeModelRuntime(this, range);
    this.publishUiState();
    return result;
  };

  SpreadsheetApp.prototype.clearSelectionRangeState = function () {
    var result = clearSelectionRangeModelRuntime(this);
    this.publishUiState();
    return result;
  };

  SpreadsheetApp.prototype.getSelectionFillRange = function () {
    return getSelectionFillRangeRuntime(this);
  };

  SpreadsheetApp.prototype.setSelectionFillRange = function (range) {
    var result = setSelectionFillRangeRuntime(this, range);
    this.publishUiState();
    return result;
  };

  SpreadsheetApp.prototype.getSelectionStartCellId = function () {
    return getSelectionStartCellIdRuntime(this);
  };

  SpreadsheetApp.prototype.getSelectedCellIds = function () {
    return getSelectedCellIdsRuntime(this);
  };

  SpreadsheetApp.prototype.copySelectedRangeToClipboard = function () {
    copySelectedRangeToClipboardRuntime(this);
  };

  SpreadsheetApp.prototype.copySelectedRangeDebugToClipboard = function () {
    copySelectedRangeDebugToClipboardRuntime(this);
  };

  SpreadsheetApp.prototype.pasteFromClipboard = function () {
    pasteFromClipboardRuntime(this);
  };

  SpreadsheetApp.prototype.getSelectedRangeText = function () {
    return getSelectedRangeTextRuntime(this);
  };

  SpreadsheetApp.prototype.copyTextFallback = function (text, previouslyFocused) {
    copyTextFallbackRuntime(this, text, previouslyFocused);
  };

  SpreadsheetApp.prototype.applyPastedText = function (text) {
    applyPastedTextRuntime(this, text);
  };

  SpreadsheetApp.prototype.clearSelectedCells = function () {
    clearSelectedCellsRuntime(this);
  };

  SpreadsheetApp.prototype.getSelectedRowBounds = function () {
    return getSelectedRowBoundsRuntime(this);
  };

  SpreadsheetApp.prototype.getSelectedColumnBounds = function () {
    return getSelectedColumnBoundsRuntime(this);
  };

  SpreadsheetApp.prototype.insertRowsAtContext = function (position) {
    insertRowsAtContextRuntime(this, position);
  };

  SpreadsheetApp.prototype.deleteRowsAtContext = function () {
    deleteRowsAtContextRuntime(this);
  };

  SpreadsheetApp.prototype.insertColumnsAtContext = function (position) {
    insertColumnsAtContextRuntime(this, position);
  };

  SpreadsheetApp.prototype.deleteColumnsAtContext = function () {
    deleteColumnsAtContextRuntime(this);
  };

  SpreadsheetApp.prototype.clearSpillSheetState = function (sheetId) {
    return clearSpillSheetStateRuntime(this, sheetId || this.activeSheetId);
  };

  SpreadsheetApp.prototype.setSpillEntry = function (sheetId, sourceCellId, payload) {
    return setSpillEntryRuntime(
      this,
      sheetId || this.activeSheetId,
      sourceCellId,
      payload,
    );
  };

  SpreadsheetApp.prototype.getSpillEntry = function (sheetId, sourceCellId) {
    return getSpillEntryRuntime(
      this,
      sheetId || this.activeSheetId,
      sourceCellId,
    );
  };

  SpreadsheetApp.prototype.getSpillSourceForCell = function (sheetId, cellId) {
    return getSpillSourceForCellRuntime(
      this,
      sheetId || this.activeSheetId,
      cellId,
    );
  };

  SpreadsheetApp.prototype.listSpillEntries = function (sheetId) {
    return listSpillEntriesRuntime(this, sheetId || this.activeSheetId);
  };

  SpreadsheetApp.prototype.clearSpillVisualState = function () {
    return clearSpillVisualStateRuntime(this);
  };

  SpreadsheetApp.prototype.applySpillVisualStateFromModel = function (sheetId) {
    return applySpillVisualStateFromModelRuntime(
      this,
      sheetId || this.activeSheetId,
    );
  };

  SpreadsheetApp.prototype.clearSpillSelectionHighlight = function () {
    return clearSpillSelectionHighlightRuntime(this);
  };

  SpreadsheetApp.prototype.applySpillSelectionHighlight = function () {
    return applySpillSelectionHighlightRuntime(this);
  };

  SpreadsheetApp.prototype.clearSelectionVisualState = function () {
    return clearSelectionVisualStateRuntime(this);
  };

  SpreadsheetApp.prototype.applyActiveCellVisualState = function () {
    return applyActiveCellVisualStateRuntime(this);
  };

  SpreadsheetApp.prototype.applySelectionRangeVisualState = function () {
    return applySelectionRangeVisualStateRuntime(this);
  };

  SpreadsheetApp.prototype.updateAxisHeaderVisualHighlight = function () {
    return updateAxisHeaderHighlightVisualRuntime(this);
  };

  SpreadsheetApp.prototype.getCellElement = function (inputOrCellId) {
    var input =
      typeof inputOrCellId === 'string'
        ? this.inputById[String(inputOrCellId || '').toUpperCase()] || null
        : inputOrCellId || null;
    return input && input.parentElement ? input.parentElement : null;
  };

  SpreadsheetApp.prototype.ensureActiveCell = function () {
    ensureActiveCellRuntime(this);
  };

  SpreadsheetApp.prototype.setSelectionAnchor = function (cellId) {
    setSelectionAnchorRuntime(this, cellId);
  };

  SpreadsheetApp.prototype.clearSelectionRange = function () {
    clearSelectionRangeRuntime(this);
  };

  SpreadsheetApp.prototype.clearSelectionHighlight = function () {
    clearSelectionVisualStateRuntime(this);
  };

  SpreadsheetApp.prototype.clearHeaderSelectionHighlight = function () {
    return clearHeaderSelectionHighlightRuntime(this);
  };

  SpreadsheetApp.prototype.clearDependencyHighlight = function () {
    clearDependencyHighlightVisualRuntime(this);
  };

  SpreadsheetApp.prototype.applyDependencyHighlight = function () {
    applyDependencyHighlightVisualRuntime(this);
  };

  SpreadsheetApp.prototype.collectDependencyHintsFromRaw = function (
    rawValue,
    sheetIdOverride,
  ) {
    return collectDependencyHintsFromRawRuntime(this, rawValue, sheetIdOverride);
  };

  SpreadsheetApp.prototype.setSelectionRange = function (anchorId, targetId) {
    setSelectionRangeRuntime(this, anchorId, targetId);
  };

  SpreadsheetApp.prototype.highlightSelectionRange = function () {
    return highlightSelectionRangeRuntime(this);
  };

  SpreadsheetApp.prototype.updateAxisHeaderHighlight = function () {
    return updateAxisHeaderHighlightVisualRuntime(this);
  };

  SpreadsheetApp.prototype.bindHeaderSelectionEvents = function () {
    bindHeaderSelectionEventsRuntime(this);
  };

  SpreadsheetApp.prototype.startHeaderSelectionDrag = function (mode, anchorIndex) {
    startHeaderSelectionDragRuntime(this, mode, anchorIndex);
  };

  SpreadsheetApp.prototype.onHeaderSelectionDragMove = function (event) {
    onHeaderSelectionDragMoveRuntime(this, event);
  };

  SpreadsheetApp.prototype.applyHeaderSelectionRange = function (
    mode,
    fromIndex,
    toIndex,
  ) {
    applyHeaderSelectionRangeRuntime(this, mode, fromIndex, toIndex);
  };

  SpreadsheetApp.prototype.selectEntireRow = function (startRow, endRow) {
    selectEntireRowRuntime(this, startRow, endRow);
  };

  SpreadsheetApp.prototype.selectEntireColumn = function (startCol, endCol) {
    selectEntireColumnRuntime(this, startCol, endCol);
  };

  SpreadsheetApp.prototype.moveSelectionByArrow = function (currentInput, key) {
    moveSelectionByArrowRuntime(this, currentInput, key);
  };

  SpreadsheetApp.prototype.moveToNextFilledCell = function (currentInput, key) {
    return moveToNextFilledCellRuntime(this, currentInput, key);
  };

  SpreadsheetApp.prototype.getSelectionEdgeInputForDirection = function (
    currentInput,
    key,
  ) {
    return getSelectionEdgeInputForDirectionRuntime(this, currentInput, key);
  };

  SpreadsheetApp.prototype.extendSelectionRangeTowardCell = function (
    targetCellId,
    key,
  ) {
    extendSelectionRangeTowardCellRuntime(this, targetCellId, key);
  };

  SpreadsheetApp.prototype.findJumpTargetCellId = function (startCellId, key) {
    return findJumpTargetCellIdRuntime(this, startCellId, key);
  };

  SpreadsheetApp.prototype.findAdjacentCellId = function (startCellId, key) {
    return findAdjacentCellIdRuntime(this, startCellId, key);
  };

  SpreadsheetApp.prototype.selectNearestValueRegionFromActive = function (input) {
    selectNearestValueRegionFromActiveRuntime(this, input);
  };

  SpreadsheetApp.prototype.selectWholeSheetRegion = function () {
    selectWholeSheetRegionRuntime(this);
  };

  SpreadsheetApp.prototype.cellHasAnyRawValue = function (cellId) {
    return cellHasAnyRawValueRuntime(this, cellId);
  };

  SpreadsheetApp.prototype.setActiveInput = function (input) {
    setActiveInputRuntime(this, input);
    this.publishUiState();
  };

  SpreadsheetApp.prototype.clearActiveInput = function () {
    clearActiveInputRuntime(this);
    this.publishUiState();
  };

  SpreadsheetApp.prototype.clearFillRangeHighlight = function () {
    clearFillRangeHighlightRuntime(this);
  };

  SpreadsheetApp.prototype.highlightFillRange = function (sourceId, targetId) {
    highlightFillRangeRuntime(this, sourceId, targetId);
  };

  SpreadsheetApp.prototype.startFillDrag = function (sourceInput, event) {
    startFillDragRuntime(this, sourceInput, event);
  };

  SpreadsheetApp.prototype.startSelectionDrag = function (sourceInput, event) {
    startSelectionDragRuntime(this, sourceInput, event);
  };

  SpreadsheetApp.prototype.onSelectionDragMove = function (event) {
    onSelectionDragMoveRuntime(this, event);
  };

  SpreadsheetApp.prototype.finishSelectionDrag = function () {
    finishSelectionDragRuntime(this);
  };

  SpreadsheetApp.prototype.syncMentionPreviewToUi = function (mentionInput) {
    syncMentionPreviewToUiRuntime(this, mentionInput);
  };

  SpreadsheetApp.prototype.onFillDragMove = function (event) {
    onFillDragMoveRuntime(this, event);
  };

  SpreadsheetApp.prototype.finishFillDrag = function () {
    finishFillDragRuntime(this);
  };
}
