// Description: Application controller that wires UI, storage, grid rendering, tabs, formulas, and AI updates.
import { Meteor } from 'meteor/meteor';
import { installAssistantMethods } from './app-methods-assistant.js';
import {
  initializeSpreadsheetAppRuntime as initializeSpreadsheetAppRuntimeRuntime,
  setupSpreadsheetAppRuntime as setupSpreadsheetAppRuntimeRuntime,
} from './app-bootstrap-runtime.js';
import { installChannelMethods } from './app-methods-channel.js';
import { destroySpreadsheetAppRuntime as destroySpreadsheetAppRuntimeRuntime } from './app-cleanup-runtime.js';
import { cacheSpreadsheetAppDomRefs as cacheSpreadsheetAppDomRefsRuntime } from './app-dom-runtime.js';
import { installEditorMethods } from './app-methods-editor.js';
import { installFullscreenMethods } from './app-methods-fullscreen.js';
import { installGridMethods } from './app-methods-grid.js';
import { installRecomputeMethods } from './app-methods-recompute.js';
import { installReportMethods } from './app-methods-report.js';
import { installSelectionMethods } from './app-methods-selection.js';
import { installWorkbookUiMethods } from './app-methods-workbook-ui.js';
import { collectAppUiStateSnapshot as collectAppUiStateSnapshotRuntime } from './ui-snapshot-runtime.js';
import { renderMarkdown as renderMarkdownRuntime } from './cell-content-renderer.js';
import {
  createCellUpdateTrace,
  shouldProfileCellUpdatesClient,
  traceCellUpdateClient,
} from '../../../lib/cell-update-profile.js';
import {
  applyDependencyHighlight as applyDependencyHighlightVisualRuntime,
  clearDependencyHighlight as clearDependencyHighlightVisualRuntime,
} from './dependency-visual-runtime.js';
import {
  applyWorkbookHistorySnapshot as applyWorkbookHistorySnapshotRuntime,
  captureHistorySnapshot as captureHistorySnapshotRuntime,
  createHistoryEntry as createHistoryEntryRuntime,
  redo as redoRuntime,
  resetHistoryGrouping as resetHistoryGroupingRuntime,
  undo as undoRuntime,
} from './history-runtime.js';
import {
  bindFormulaBarEvents as bindFormulaBarEventsRuntime,
  commitFormulaBarValue as commitFormulaBarValueRuntime,
} from './formula-bar-runtime.js';
import {
  syncDisplayModeControl as syncDisplayModeControlRuntime,
  syncAIModeUI as syncAIModeUIRuntime,
} from './toolbar-sync-runtime.js';
import {
  setupAIModeControls as setupAIModeControlsWiringRuntime,
  setupCellFormatControls as setupCellFormatControlsWiringRuntime,
  setupCellPresentationControls as setupCellPresentationControlsWiringRuntime,
  setupDisplayModeControls as setupDisplayModeControlsWiringRuntime,
  toggleAIModePicker as toggleAIModePickerWiringRuntime,
  toggleBgColorPicker as toggleBgColorPickerWiringRuntime,
  toggleCellBordersPicker as toggleCellBordersPickerWiringRuntime,
  toggleCellFontFamilyPicker as toggleCellFontFamilyPickerWiringRuntime,
  toggleCellFormatPicker as toggleCellFormatPickerWiringRuntime,
  toggleDisplayModePicker as toggleDisplayModePickerWiringRuntime,
} from './toolbar-wiring-runtime.js';
import { applyActiveCellName as applyActiveCellNameRuntime } from './toolbar-actions-runtime.js';
import {
  getNamedCellJumpUiState as getNamedCellJumpUiStateRuntime,
  navigateToNamedCell as navigateToNamedCellRuntime,
  refreshNamedCellJumpOptions as refreshNamedCellJumpOptionsRuntime,
  setNamedCellJumpActiveIndex as setNamedCellJumpActiveIndexRuntime,
  setupCellNameControls as setupCellNameControlsRuntime,
  syncCellNameInput as syncCellNameInputRuntime,
  toggleNamedCellJumpPicker as toggleNamedCellJumpPickerRuntime,
} from './named-cell-jump-runtime.js';
import {
  findSheetIdByName as findSheetIdByNameRuntime,
} from './formula-mention-runtime.js';
import {
  applyActiveSheetLayout as applyActiveSheetLayoutRuntime,
  ensureGridCapacityForStorage as ensureGridCapacityForStorageRuntime,
  getStorageGridBounds as getStorageGridBoundsRuntime,
  refreshGridReferences as refreshGridReferencesRuntime,
} from './grid-dom-runtime.js';
import {
  getEditorSelectionRange as getEditorSelectionRangeRuntime,
  setEditorSelectionRange as setEditorSelectionRangeRuntime,
} from './editor-selection-runtime.js';
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
  arrayBufferToBase64 as arrayBufferToBase64Runtime,
  ensureFloatingAttachmentPreview as ensureFloatingAttachmentPreviewRuntime,
  hideFloatingAttachmentPreview as hideFloatingAttachmentPreviewRuntime,
  positionFloatingAttachmentPreview as positionFloatingAttachmentPreviewRuntime,
  readAttachedFileContent as readAttachedFileContentRuntime,
  setupAttachmentControls as setupAttachmentControlsRuntime,
  syncChannelBindingControl as syncChannelBindingControlRuntime,
  setupAttachmentLinkPreview as setupAttachmentLinkPreviewRuntime,
  showFloatingAttachmentPreview as showFloatingAttachmentPreviewRuntime,
} from './attachment-runtime.js';
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
  applyRenderedRowHeights as applyRenderedRowHeightsRuntime,
  captureRenderedRowHeights as captureRenderedRowHeightsRuntime,
} from './grid-view-layout-runtime.js';
import {
  setupToolbarOffsetSync as setupToolbarOffsetSyncRuntime,
  syncToolbarOffset as syncToolbarOffsetRuntime,
} from './toolbar-layout-runtime.js';
import { bindGridInputEvents as bindGridInputEventsRuntime } from './keyboard-grid-runtime.js';
import {
  focusEditorOverlayInput as focusEditorOverlayInputRuntime,
  hideEditorOverlay as hideEditorOverlayRuntime,
  setupEditorOverlay as setupEditorOverlayRuntime,
  syncEditorOverlay as syncEditorOverlayRuntime,
} from './editor-overlay-runtime.js';
import {
  focusActiveEditor as focusActiveEditorRuntime,
  focusCellProxy as focusCellProxyRuntime,
  restoreGridKeyboardFocusSoon as restoreGridKeyboardFocusSoonRuntime,
} from './grid-focus-runtime.js';
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
  updateAxisHeaderHighlight as updateAxisHeaderHighlightVisualRuntime,
} from './selection-visual-runtime.js';
import {
  clearScheduleDialog as clearScheduleDialogRuntime,
  getScheduleDialogUiState as getScheduleDialogUiStateRuntime,
  hideScheduleDialog as hideScheduleDialogRuntime,
  saveScheduleDialog as saveScheduleDialogRuntime,
  setupScheduleDialog as setupScheduleDialogRuntime,
  showScheduleDialogForCell as showScheduleDialogForCellRuntime,
  showScheduleDialogForContextCell as showScheduleDialogForContextCellRuntime,
  updateScheduleDialogDraft as updateScheduleDialogDraftRuntime,
} from './schedule-runtime.js';
import {
  cancelCellEditing as cancelCellEditingRuntime,
  commitFormulaBarEditing as commitFormulaBarEditingRuntime,
  commitCellEditing as commitCellEditingRuntime,
  enterCellEditing as enterCellEditingRuntime,
  enterFormulaBarEditing as enterFormulaBarEditingRuntime,
  ensureCellEditing as ensureCellEditingRuntime,
  handleCellEditingBlur as handleCellEditingBlurRuntime,
  handleCellDirectType as handleCellDirectTypeRuntime,
  handleCellEditingEnter as handleCellEditingEnterRuntime,
  handleCellEditingEscape as handleCellEditingEscapeRuntime,
  handleCellInputDraft as handleCellInputDraftRuntime,
  handleCellMentionNavigation as handleCellMentionNavigationRuntime,
  resolveCellEditingExit as resolveCellEditingExitRuntime,
  restoreFocusAfterEditingExit as restoreFocusAfterEditingExitRuntime,
  syncCellDraft as syncCellDraftRuntime,
} from './editor-controller-runtime.js';
import {
  beginEditingSession as beginEditingSessionRuntime,
  clearEditingSession as clearEditingSessionRuntime,
  getEditingSessionDraft as getEditingSessionDraftRuntime,
  syncEditingSessionWithGridState as syncEditingSessionWithGridStateRuntime,
  updateEditingSessionDraft as updateEditingSessionDraftRuntime,
} from './editing-session-runtime.js';
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
  getDirectTypeValue as getDirectTypeValueRuntime,
  getSelectionEdgeInputForDirection as getSelectionEdgeInputForDirectionRuntime,
  isDirectTypeKey as isDirectTypeKeyRuntime,
  isEditingCell as isEditingCellRuntime,
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
  startEditingCell as startEditingCellRuntime,
  startHeaderSelectionDrag as startHeaderSelectionDragRuntime,
} from './selection-runtime.js';
import {
  downloadRegionRecording as downloadRegionRecordingRuntime,
  setupRegionRecordingControls as setupRegionRecordingControlsRuntime,
  startRegionRecording as startRegionRecordingRuntime,
  stopRegionRecording as stopRegionRecordingRuntime,
  syncRegionRecordingControls as syncRegionRecordingControlsRuntime,
} from './region-recording-runtime.js';

export class SpreadsheetApp {
  constructor(options) {
    var opts = options || {};
    if (!opts.storage) {
      throw new Error('SpreadsheetApp requires a storage adapter');
    }
    this.uiStore = opts.uiStore || null;
    this.cellContentStore = opts.cellContentStore || null;
    this.useReactShellTabs = opts.useReactShellTabs === true;
    this.useReactShellControls = opts.useReactShellControls === true;
    this.sheetDocumentId = String(opts.sheetDocumentId || '');
    this.renderMarkdown = renderMarkdownRuntime;
    this.initialSheetId = String(opts.initialSheetId || '');
    this.onActiveSheetChange =
      typeof opts.onActiveSheetChange === 'function'
        ? opts.onActiveSheetChange
        : null;
    this.availableChannels = Array.isArray(opts.availableChannels)
      ? opts.availableChannels
          .map(function (channel) {
            return channel && typeof channel === 'object'
              ? {
                  id: String(channel.id || ''),
                  label: String(channel.label || '').trim(),
                }
              : null;
          })
          .filter(Boolean)
      : [];
    if (!this.sheetDocumentId) {
      throw new Error('SpreadsheetApp requires sheetDocumentId');
    }
    cacheSpreadsheetAppDomRefsRuntime(this);
    this.ensureReportUI();
    initializeSpreadsheetAppRuntimeRuntime(this, opts);
    setupSpreadsheetAppRuntimeRuntime(this);
  }

  captureRenderedRowHeights() {
    return captureRenderedRowHeightsRuntime(this);
  }

  applyRenderedRowHeights(heights) {
    applyRenderedRowHeightsRuntime(this, heights);
  }

  setDisplayMode(mode) {
    var previousMode = this.displayMode === 'formulas' ? 'formulas' : 'values';
    var preservedHeights =
      previousMode === 'values' && mode === 'formulas'
        ? this.captureRenderedRowHeights()
        : null;
    this.displayMode = mode === 'formulas' ? 'formulas' : 'values';
    syncDisplayModeControlRuntime(this);
    this.renderCurrentSheetFromStorage();
    if (preservedHeights) {
      this.applyRenderedRowHeights(preservedHeights);
    }
    this.publishUiState();
  }

  setupDisplayModeControls() {
    setupDisplayModeControlsWiringRuntime(this);
  }
  setupCellFormatControls() {
    setupCellFormatControlsWiringRuntime(this);
  }
  setupCellPresentationControls() {
    setupCellPresentationControlsWiringRuntime(this);
  }
  setupRegionRecordingControls() {
    setupRegionRecordingControlsRuntime(this);
  }

  hasPendingLocalEdit() {
    var activeInput = this.getActiveCellInput();
    if (activeInput && this.isEditingCell(activeInput)) return true;
    if (!activeInput || !this.formulaInput) return false;
    if (!this.isFormulaBarFocused() && !this.isOverlayEditorFocused()) {
      return false;
    }

    var currentEditor = this.getActiveEditorInput();
    var currentFormulaValue = String(
      currentEditor && currentEditor.value != null ? currentEditor.value : '',
    );
    var storedRawValue = String(this.getRawCellValue(activeInput.id) || '');
    return currentFormulaValue !== storedRawValue;
  }

  isEditorElementFocused(target) {
    return document.activeElement === target;
  }

  isFormulaBarFocused() {
    return this.isEditorElementFocused(this.formulaInput);
  }

  isOverlayEditorFocused() {
    return this.isEditorElementFocused(this.editorOverlayInput);
  }

  syncAIDraftLock() {
    if (
      !this.aiService ||
      typeof this.aiService.setEditDraftLock !== 'function'
    )
      return;
    var locked = this.hasPendingLocalEdit();
    this.aiService.setEditDraftLock(locked);
    this.syncServerEditLock(locked);
  }

  hasSingleSelectedCell() {
    if (!this.activeInput) return false;
    var selectionRange = this.getSelectionRange();
    if (!selectionRange) return true;
    return (
      selectionRange.startCol === selectionRange.endCol &&
      selectionRange.startRow === selectionRange.endRow
    );
  }

  hasRegionSelection() {
    if (!this.activeInput || !this.getSelectionRange()) return false;
    return !this.hasSingleSelectedCell();
  }

  syncAttachButtonState() {
    if (!this.attachFileButton) return;
    this.attachFileButton.disabled =
      this.isReportActive() || !this.hasSingleSelectedCell();
    this.syncChannelBindingControl();
  }

  syncChannelBindingControl() {
    syncChannelBindingControlRuntime(this);
  }

  syncRegionRecordingControls() {
    syncRegionRecordingControlsRuntime(this);
  }

  startRegionRecording() {
    startRegionRecordingRuntime(this);
  }

  stopRegionRecording(shouldDownload) {
    stopRegionRecordingRuntime(this, shouldDownload);
  }

  downloadRegionRecording() {
    downloadRegionRecordingRuntime(this);
  }

  parseAttachmentSource(rawValue) {
    var raw = String(rawValue == null ? '' : rawValue);
    if (raw.indexOf('__ATTACHMENT__:') !== 0) return null;
    try {
      var parsed = JSON.parse(raw.substring('__ATTACHMENT__:'.length));
      if (!parsed || typeof parsed !== 'object') return null;
      return parsed;
    } catch (e) {
      return null;
    }
  }

  buildAttachmentSource(payload) {
    return (
      '__ATTACHMENT__:' +
      JSON.stringify({
        name: String((payload && payload.name) || ''),
        type: String((payload && payload.type) || ''),
        content: String((payload && payload.content) || ''),
        contentArtifactId: String((payload && payload.contentArtifactId) || ''),
        binaryArtifactId: String((payload && payload.binaryArtifactId) || ''),
        downloadUrl: String((payload && payload.downloadUrl) || ''),
        previewUrl: String((payload && payload.previewUrl) || ''),
        pending: !!(payload && payload.pending),
        converting: !!(payload && payload.converting),
      })
    );
  }

  syncServerEditLock(locked) {
    var nextKey = '';
    var activeCellId = this.getSelectionActiveCellId();
    if (
      locked &&
      this.sheetDocumentId &&
      this.activeSheetId &&
      activeCellId
    ) {
      nextKey = [
        String(this.sheetDocumentId || ''),
        String(this.activeSheetId || ''),
        String(activeCellId || '').toUpperCase(),
      ].join(':');
    }

    if (nextKey === this.currentServerEditLockKey) return;

    var releaseKey = this.currentServerEditLockKey;
    this.currentServerEditLockKey = nextKey;

    if (releaseKey) {
      var releaseParts = releaseKey.split(':');
      this.editLockSequence += 1;
      Meteor.callAsync(
        'ai.setSourceEditLock',
        releaseParts[0],
        releaseParts[1],
        releaseParts.slice(2).join(':'),
        false,
        this.editLockOwnerId,
        this.editLockSequence,
      ).catch(() => {});
    }

    if (nextKey) {
      var lockParts = nextKey.split(':');
      this.editLockSequence += 1;
      Meteor.callAsync(
        'ai.setSourceEditLock',
        lockParts[0],
        lockParts[1],
        lockParts.slice(2).join(':'),
        true,
        this.editLockOwnerId,
        this.editLockSequence,
      ).catch(() => {});
    }
  }

  getRawCellValue(cellId) {
    var sheetId =
      typeof this.getVisibleSheetId === 'function'
        ? this.getVisibleSheetId()
        : this.activeSheetId;
    return this.storage.getCellValue(sheetId, cellId);
  }

  syncCellDependencyHints(sheetId, cellId, rawValue) {
    var targetSheetId = String(sheetId || '');
    var normalizedCellId = String(cellId || '').toUpperCase();
    var raw = String(rawValue == null ? '' : rawValue);
    if (!targetSheetId || !normalizedCellId) return;
    this.storage.setCellDependencies(
      targetSheetId,
      normalizedCellId,
      collectDependencyHintsFromRawRuntime(this, raw, targetSheetId),
    );
  }

  getCellFormat(cellId) {
    var sheetId =
      typeof this.getVisibleSheetId === 'function'
        ? this.getVisibleSheetId()
        : this.activeSheetId;
    return this.storage.getCellFormat(sheetId, cellId);
  }

  getCellPresentation(cellId) {
    var sheetId =
      typeof this.getVisibleSheetId === 'function'
        ? this.getVisibleSheetId()
        : this.activeSheetId;
    return this.storage.getCellPresentation(sheetId, cellId);
  }

  setRawCellValue(cellId, value, meta) {
    var normalizedCellId = String(cellId || '').toUpperCase();
    var nextRaw = String(value == null ? '' : value);
    var sheetId =
      typeof this.getVisibleSheetId === 'function'
        ? this.getVisibleSheetId()
        : this.activeSheetId;
    var previousRaw = String(
      this.storage.getCellValue(sheetId, normalizedCellId) || '',
    );

    if (
      this.isGeneratedAIResultSourceRaw(previousRaw) &&
      previousRaw !== nextRaw
    ) {
      this.clearGeneratedResultCellsForSource(
        sheetId,
        normalizedCellId,
        previousRaw,
      );
    }

    this.storage.setCellValue(sheetId, normalizedCellId, nextRaw, meta);
    this.syncCellDependencyHints(sheetId, normalizedCellId, nextRaw);
    var attachment = this.parseAttachmentSource(nextRaw);
    if (!attachment || (!attachment.pending && !attachment.converting)) {
      this.dispatchDependentChannelCommandsForSource(
        sheetId,
        normalizedCellId,
      );
    }
  }

  getCellSchedule(cellId) {
    return this.storage.getCellSchedule(this.activeSheetId, cellId);
  }

  setCellFormat(cellId, format) {
    this.storage.setCellFormat(this.activeSheetId, cellId, format);
    this.syncCellFormatControl();
  }

  setCellPresentation(cellId, presentation) {
    this.storage.setCellPresentation(this.activeSheetId, cellId, presentation);
    this.syncCellPresentationControls();
  }

  setCellSchedule(cellId, schedule) {
    this.storage.setCellSchedule(this.activeSheetId, cellId, schedule);
  }

  getWorkbookAdapter() {
    return this.storage && this.storage.storage ? this.storage.storage : null;
  }

  getWorkbookSnapshot() {
    var adapter = this.getWorkbookAdapter();
    if (!adapter || typeof adapter.snapshot !== 'function') return null;
    return adapter.snapshot();
  }

  createHistoryEntry() {
    return createHistoryEntryRuntime(this);
  }

  captureHistorySnapshot(groupKey) {
    captureHistorySnapshotRuntime(this, groupKey);
  }

  resetHistoryGrouping() {
    resetHistoryGroupingRuntime(this);
  }

  applyWorkbookHistorySnapshot(serialized) {
    applyWorkbookHistorySnapshotRuntime(this, serialized);
  }

  undo() {
    undoRuntime(this);
  }

  redo() {
    redoRuntime(this);
  }

  hasRawCellChanged(cellId, nextRawValue) {
    var next = String(nextRawValue == null ? '' : nextRawValue);
    var start = Object.prototype.hasOwnProperty.call(
      this.editStartRawByCell,
      cellId,
    )
      ? this.editStartRawByCell[cellId]
      : this.getRawCellValue(cellId);
    return start !== next;
  }

  isFormulaLikeRawValue(rawValue) {
    var raw = String(rawValue == null ? '' : rawValue);
    return (
      !!raw &&
      (raw.charAt(0) === '=' ||
        raw.charAt(0) === '>' ||
        raw.charAt(0) === '#' ||
        raw.charAt(0) === "'")
    );
  }

  normalizeCommittedRawValue(rawValue) {
    var raw = String(rawValue == null ? '' : rawValue);
    if (raw.charAt(0) !== '=') return raw;
    return '=' + raw.substring(1).replace(/^\s+/, '');
  }

  beginCellUpdateTrace(cellId, rawValue) {
    if (!shouldProfileCellUpdatesClient()) return null;
    var trace = createCellUpdateTrace({
      sheetId: this.activeSheetId,
      cellId: String(cellId || '').toUpperCase(),
      rawKind: this.isFormulaLikeRawValue(rawValue) ? 'formula' : 'value',
    });
    traceCellUpdateClient(trace, 'edit.commit.start');
    return trace;
  }

  getDependentSourceKeysForActiveCell(cellId) {
    var graph = this.storage.getDependencyGraph();
    var key =
      String(this.activeSheetId || '') +
      ':' +
      String(cellId || '').toUpperCase();
    var results = [];
    var seen = Object.create(null);
    var addKeys = function (keys) {
      var list = Array.isArray(keys) ? keys : [];
      for (var i = 0; i < list.length; i++) {
        var item = String(list[i] || '');
        if (!item || seen[item]) continue;
        seen[item] = true;
        results.push(item);
      }
    };

    addKeys(graph && graph.dependentsByCell ? graph.dependentsByCell[key] : []);

    var namedCells = this.storage.readNamedCells();
    for (var name in namedCells) {
      if (!Object.prototype.hasOwnProperty.call(namedCells, name)) continue;
      var ref = namedCells[name];
      if (!ref || ref.sheetId !== this.activeSheetId) continue;
      if (
        String(ref.cellId || '').toUpperCase() !==
        String(cellId || '').toUpperCase()
      )
        continue;
      addKeys(
        graph && graph.dependentsByNamedRef
          ? graph.dependentsByNamedRef[String(name)]
          : [],
      );
    }

    var scanned = this.scanDependentSourceKeys(key);
    addKeys(scanned);

    return results;
  }

  commitRawCellEdit(cellId, rawValue, trace) {
    var normalizedCellId = String(cellId || '').toUpperCase();
    var raw = this.normalizeCommittedRawValue(rawValue);
    var storedRaw = String(this.getRawCellValue(normalizedCellId) || '');
    var activeCellId = this.getSelectionActiveCellId();
    if (storedRaw === raw) {
      this.clearEditingSession(normalizedCellId);
      this.renderCurrentSheetFromStorage();
      return;
    }
    this.captureHistorySnapshot(
      'cell:' + this.activeSheetId + ':' + normalizedCellId,
    );
    if (this.runChannelSendCommandForCell(normalizedCellId, raw)) {
      var activeCommandInput =
        activeCellId === normalizedCellId
          ? this.getActiveCellInput()
          : this.inputById && this.inputById[normalizedCellId]
            ? this.inputById[normalizedCellId]
            : null;
      if (activeCommandInput && this.grid) {
        this.grid.setEditing(activeCommandInput, false);
        this.clearEditingSession(normalizedCellId);
        this.renderCurrentSheetFromStorage();
      }
      traceCellUpdateClient(trace, 'channel_send.dispatched', {
        cellId: normalizedCellId,
      });
      return;
    }
    this.setRawCellValue(normalizedCellId, raw);
    this.clearEditingSession(normalizedCellId);
    this.aiService.notifyActiveCellChanged();
    if (activeCellId === normalizedCellId) {
      this.formulaInput.value = raw;
    }
    var recomputePlan = this.collectLocalSyncRecomputePlan(
      normalizedCellId,
      raw,
    );
    var localTargets =
      recomputePlan && Array.isArray(recomputePlan.localTargets)
        ? recomputePlan.localTargets
        : [];
    var serverTargets =
      recomputePlan && Array.isArray(recomputePlan.serverTargets)
        ? recomputePlan.serverTargets
        : [];
    var needsServer = !!(recomputePlan && recomputePlan.needsServer);
    if (localTargets.length) {
      this.recomputeLocalSyncTargets(localTargets);
      traceCellUpdateClient(trace, 'local_sync_recompute.done', {
        targets: localTargets.length,
      });
    }
    if (serverTargets.length) {
      this.markServerRecomputeTargetsStale(serverTargets);
    }
    this.renderCurrentSheetFromStorage();
    traceCellUpdateClient(trace, 'edit.local_render.done', {
      hasDownstreamDependents: this.hasDownstreamDependents(normalizedCellId),
      localTargets: localTargets.length,
      serverTargets: serverTargets.length,
      needsServer: needsServer,
    });
    if (
      needsServer ||
      this.isFormulaLikeRawValue(raw) ||
      (serverTargets.length > 0 && !localTargets.length)
    ) {
      this.computeAll({ trace: trace, bypassPendingEdit: true });
      return;
    }
    traceCellUpdateClient(trace, 'edit.complete.no_server');
  }

  runWithAISuppressed(fn) {
    if (
      this.aiService &&
      typeof this.aiService.withRequestsSuppressed === 'function'
    ) {
      return this.aiService.withRequestsSuppressed(fn);
    }
    return fn();
  }

  updateCalcProgress(current, total) {
    if (!this.calcProgress) return;
    if (!total || total < 1) {
      this.calcProgress.textContent = '';
      this.calcProgress.classList.remove('active');
      return;
    }
    if (this.calcProgressHideTimer) {
      clearTimeout(this.calcProgressHideTimer);
      this.calcProgressHideTimer = null;
    }
    this.calcProgress.textContent = Math.min(current, total) + '/' + total;
    this.calcProgress.classList.add('active');
  }

  finishCalcProgress(total) {
    if (!this.calcProgress) return;
    if (!total || total < 1) {
      this.updateCalcProgress(0, 0);
      return;
    }
    this.updateCalcProgress(total, total);
    this.calcProgressHideTimer = setTimeout(() => {
      this.updateCalcProgress(0, 0);
    }, 800);
  }

  runContextMenuAction(action) {
    if (!action || this.isReportActive()) return;
    if (action === 'recalc') {
      this.recalcContextCell();
      return;
    }
    if (action === 'copy') {
      this.copySelectedRangeToClipboard();
      return;
    }
    if (action === 'paste') {
      this.pasteFromClipboard();
      return;
    }
    if (action === 'schedule') {
      this.showScheduleDialogForContextCell();
      return;
    }

    if (action === 'insert-row-before') {
      this.insertRowsAtContext('before');
      return;
    }
    if (action === 'insert-row-after') {
      this.insertRowsAtContext('after');
      return;
    }
    if (action === 'delete-row') {
      this.deleteRowsAtContext();
      return;
    }
    if (action === 'insert-col-before') {
      this.insertColumnsAtContext('before');
      return;
    }
    if (action === 'insert-col-after') {
      this.insertColumnsAtContext('after');
      return;
    }
    if (action === 'delete-col') {
      this.deleteColumnsAtContext();
    }
  }

  recalcContextCell() {
    if (!this.contextMenuState || this.contextMenuState.type !== 'cell') return;
    var cellId = this.cellIdFrom(
      this.contextMenuState.col,
      this.contextMenuState.row,
    );
    var input = this.inputById[cellId];
    if (!input) return;
    var raw = String(this.getRawCellValue(cellId) || '');
    if (
      !raw ||
      (raw.charAt(0) !== '=' &&
        raw.charAt(0) !== '>' &&
        raw.charAt(0) !== '#' &&
        raw.charAt(0) !== "'")
    ) {
      return;
    }
    this.setActiveInput(input);
    this.focusActiveEditor();
    this.runManualAIUpdate({ forceRefreshAI: true });
  }

  collectUiStateSnapshot() {
    return collectAppUiStateSnapshotRuntime(this);
  }

  publishUiState() {
    this.syncToolbarOffset();
    if (!this.uiStore || typeof this.uiStore.publish !== 'function') return null;
    return this.uiStore.publish(this.collectUiStateSnapshot());
  }

  syncToolbarOffset() {
    syncToolbarOffsetRuntime(this);
  }

  setupToolbarOffsetSync() {
    setupToolbarOffsetSyncRuntime(this);
  }

  destroy() {
    destroySpreadsheetAppRuntimeRuntime(this);
  }

}

installFullscreenMethods(SpreadsheetApp);
installAssistantMethods(SpreadsheetApp);
installChannelMethods(SpreadsheetApp);
installGridMethods(SpreadsheetApp);
installEditorMethods(SpreadsheetApp);
installRecomputeMethods(SpreadsheetApp);
installSelectionMethods(SpreadsheetApp);
installReportMethods(SpreadsheetApp);
installWorkbookUiMethods(SpreadsheetApp);

export function mountSpreadsheetApp() {
  var options = arguments.length > 0 ? arguments[0] : {};
  return new SpreadsheetApp(options);
}
