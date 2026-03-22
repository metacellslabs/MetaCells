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
  bindFormulaBarEvents as bindFormulaBarEventsRuntime,
  commitFormulaBarValue as commitFormulaBarValueRuntime,
} from './formula-bar-runtime.js';
import {
  getAIModeUiState as getAIModeUiStateRuntime,
  syncAIModeUI as syncAIModeUIRuntime,
} from './toolbar-sync-runtime.js';
import {
  setupAIModeControls as setupAIModeControlsWiringRuntime,
  toggleAIModePicker as toggleAIModePickerWiringRuntime,
  toggleBgColorPicker as toggleBgColorPickerWiringRuntime,
  toggleCellBordersPicker as toggleCellBordersPickerWiringRuntime,
  toggleCellFontFamilyPicker as toggleCellFontFamilyPickerWiringRuntime,
  toggleCellFormatPicker as toggleCellFormatPickerWiringRuntime,
  toggleDisplayModePicker as toggleDisplayModePickerWiringRuntime,
} from './toolbar-wiring-runtime.js';
import {
  getNamedCellJumpUiState as getNamedCellJumpUiStateRuntime,
  navigateToNamedCell as navigateToNamedCellRuntime,
  refreshNamedCellJumpOptions as refreshNamedCellJumpOptionsRuntime,
  setNamedCellJumpActiveIndex as setNamedCellJumpActiveIndexRuntime,
  setupCellNameControls as setupCellNameControlsRuntime,
  syncCellNameInput as syncCellNameInputRuntime,
  toggleNamedCellJumpPicker as toggleNamedCellJumpPickerRuntime,
} from './named-cell-jump-runtime.js';
import { applyActiveCellName as applyActiveCellNameRuntime } from './toolbar-actions-runtime.js';
import {
  arrayBufferToBase64 as arrayBufferToBase64Runtime,
  ensureFloatingAttachmentPreview as ensureFloatingAttachmentPreviewRuntime,
  hideFloatingAttachmentPreview as hideFloatingAttachmentPreviewRuntime,
  positionFloatingAttachmentPreview as positionFloatingAttachmentPreviewRuntime,
  readAttachedFileContent as readAttachedFileContentRuntime,
  setupAttachmentControls as setupAttachmentControlsRuntime,
  setupAttachmentLinkPreview as setupAttachmentLinkPreviewRuntime,
  showFloatingAttachmentPreview as showFloatingAttachmentPreviewRuntime,
  syncChannelBindingControl as syncChannelBindingControlRuntime,
} from './attachment-runtime.js';
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
  getEditorSelectionRange as getEditorSelectionRangeRuntime,
  setEditorSelectionRange as setEditorSelectionRangeRuntime,
} from './editor-selection-runtime.js';
import {
  getDirectTypeValue as getDirectTypeValueRuntime,
  isDirectTypeKey as isDirectTypeKeyRuntime,
  isEditingCell as isEditingCellRuntime,
  startEditingCell as startEditingCellRuntime,
} from './selection-runtime.js';
import {
  findSheetIdByName as findSheetIdByNameRuntime,
} from './formula-mention-runtime.js';

export function installEditorMethods(SpreadsheetApp) {
  SpreadsheetApp.prototype.setupAIModeControls = function () {
    setupAIModeControlsWiringRuntime(this);
  };
  SpreadsheetApp.prototype.setupScheduleDialog = function () {
    setupScheduleDialogRuntime(this);
  };
  SpreadsheetApp.prototype.getScheduleDialogUiState = function () {
    return getScheduleDialogUiStateRuntime(this);
  };
  SpreadsheetApp.prototype.showScheduleDialogForCell = function (cellId) {
    showScheduleDialogForCellRuntime(this, cellId);
  };
  SpreadsheetApp.prototype.showScheduleDialogForContextCell = function () {
    showScheduleDialogForContextCellRuntime(this);
  };
  SpreadsheetApp.prototype.hideScheduleDialog = function () {
    hideScheduleDialogRuntime(this);
  };
  SpreadsheetApp.prototype.updateScheduleDialogDraft = function (patch) {
    updateScheduleDialogDraftRuntime(this, patch);
  };
  SpreadsheetApp.prototype.saveScheduleDialog = function () {
    saveScheduleDialogRuntime(this);
  };
  SpreadsheetApp.prototype.clearScheduleDialog = function () {
    clearScheduleDialogRuntime(this);
  };
  SpreadsheetApp.prototype.setupAttachmentControls = function () {
    setupAttachmentControlsRuntime(this);
  };
  SpreadsheetApp.prototype.readAttachedFileContent = function (
    file,
    preparedBase64,
  ) {
    return readAttachedFileContentRuntime(this, file, preparedBase64);
  };
  SpreadsheetApp.prototype.arrayBufferToBase64 = function (buffer) {
    return arrayBufferToBase64Runtime(this, buffer);
  };
  SpreadsheetApp.prototype.syncChannelBindingControl = function () {
    syncChannelBindingControlRuntime(this);
  };
  SpreadsheetApp.prototype.syncAIModeUI = function () {
    var opts = arguments.length > 0 ? arguments[0] || {} : {};
    syncAIModeUIRuntime(this);
    if (opts.publish !== false) this.publishUiState();
  };
  SpreadsheetApp.prototype.getAIModeUiState = function () {
    return getAIModeUiStateRuntime(this);
  };
  SpreadsheetApp.prototype.commitFormulaBarValue = function (options) {
    commitFormulaBarValueRuntime(this, options);
  };
  SpreadsheetApp.prototype.bindFormulaBarEvents = function () {
    bindFormulaBarEventsRuntime(this);
  };
  SpreadsheetApp.prototype.bindGridInputEvents = function () {
    bindGridInputEventsRuntime(this);
  };
  SpreadsheetApp.prototype.ensureCellEditing = function (input, options) {
    ensureCellEditingRuntime(this, input, options);
  };
  SpreadsheetApp.prototype.enterCellEditing = function (input, options) {
    return enterCellEditingRuntime(this, input, options);
  };
  SpreadsheetApp.prototype.enterFormulaBarEditing = function (input, options) {
    return enterFormulaBarEditingRuntime(this, input, options);
  };
  SpreadsheetApp.prototype.syncCellDraft = function (input, rawValue, options) {
    syncCellDraftRuntime(this, input, rawValue, options);
  };
  SpreadsheetApp.prototype.cancelCellEditing = function (input, options) {
    return cancelCellEditingRuntime(this, input, options);
  };
  SpreadsheetApp.prototype.commitCellEditing = function (input, options) {
    return commitCellEditingRuntime(this, input, options);
  };
  SpreadsheetApp.prototype.commitFormulaBarEditing = function (input, options) {
    return commitFormulaBarEditingRuntime(this, input, options);
  };
  SpreadsheetApp.prototype.handleCellEditingBlur = function (input, options) {
    return handleCellEditingBlurRuntime(this, input, options);
  };
  SpreadsheetApp.prototype.handleCellDirectType = function (input, key, options) {
    return handleCellDirectTypeRuntime(this, input, key, options);
  };
  SpreadsheetApp.prototype.handleCellEditingEnter = function (input, options) {
    return handleCellEditingEnterRuntime(this, input, options);
  };
  SpreadsheetApp.prototype.handleCellEditingEscape = function (input, options) {
    return handleCellEditingEscapeRuntime(this, input, options);
  };
  SpreadsheetApp.prototype.resolveCellEditingExit = function (input, options) {
    return resolveCellEditingExitRuntime(this, input, options);
  };
  SpreadsheetApp.prototype.restoreFocusAfterEditingExit = function (options) {
    return restoreFocusAfterEditingExitRuntime(this, options);
  };
  SpreadsheetApp.prototype.handleCellMentionNavigation = function (
    input,
    key,
    options,
  ) {
    return handleCellMentionNavigationRuntime(this, input, key, options);
  };
  SpreadsheetApp.prototype.handleCellInputDraft = function (input, options) {
    return handleCellInputDraftRuntime(this, input, options);
  };
  SpreadsheetApp.prototype.setupEditorOverlay = function () {
    setupEditorOverlayRuntime(this);
  };
  SpreadsheetApp.prototype.syncEditorOverlay = function () {
    syncEditorOverlayRuntime(this);
  };
  SpreadsheetApp.prototype.focusEditorOverlayInput = function () {
    focusEditorOverlayInputRuntime(this);
  };
  SpreadsheetApp.prototype.focusActiveEditor = function () {
    return focusActiveEditorRuntime(this);
  };
  SpreadsheetApp.prototype.restoreGridKeyboardFocusSoon = function () {
    restoreGridKeyboardFocusSoonRuntime(this);
  };
  SpreadsheetApp.prototype.focusCellProxy = function (input) {
    return focusCellProxyRuntime(this, input);
  };
  SpreadsheetApp.prototype.getActiveCellInput = function () {
    var activeCellId = this.getSelectionActiveCellId();
    if (
      activeCellId &&
      this.inputById &&
      Object.prototype.hasOwnProperty.call(this.inputById, activeCellId)
    ) {
      return this.inputById[activeCellId] || null;
    }
    return this.activeInput || null;
  };
  SpreadsheetApp.prototype.getActiveEditorInput = function () {
    var activeInput = this.getActiveCellInput();
    if (this.editorOverlayInput && this.isOverlayEditorFocused()) {
      return this.editorOverlayInput;
    }
    if (this.formulaInput && this.isFormulaBarFocused()) {
      return this.formulaInput;
    }
    if (
      activeInput &&
      this.isEditingCell(activeInput) &&
      this.editorOverlayInput &&
      this.editorOverlayUiState &&
      this.editorOverlayUiState.visible === true
    ) {
      return this.editorOverlayInput;
    }
    return activeInput || null;
  };
  SpreadsheetApp.prototype.getEditorSelectionRange = function (input) {
    return getEditorSelectionRangeRuntime(this, input);
  };
  SpreadsheetApp.prototype.setEditorSelectionRange = function (start, end, input) {
    setEditorSelectionRangeRuntime(this, start, end, input);
  };
  SpreadsheetApp.prototype.syncActiveEditorValue = function (value, options) {
    var opts = options || {};
    var nextValue = String(value == null ? '' : value);
    if (this.activeInput) {
      this.activeInput.value = nextValue;
    }
    if (opts.syncFormula !== false && this.formulaInput) {
      this.formulaInput.value = nextValue;
    }
    if (
      opts.syncOverlay !== false &&
      this.editorOverlayInput &&
      (this.isEditingCell(this.activeInput) || this.isOverlayEditorFocused())
    ) {
      this.editorOverlayInput.value = nextValue;
    }
  };
  SpreadsheetApp.prototype.hideEditorOverlay = function () {
    hideEditorOverlayRuntime(this);
  };
  SpreadsheetApp.prototype.isEditingCell = function (input) {
    return isEditingCellRuntime(this, input);
  };
  SpreadsheetApp.prototype.beginEditingSession = function (input, options) {
    beginEditingSessionRuntime(this, input, options);
    if (!options || options.publish !== false) this.publishUiState();
  };
  SpreadsheetApp.prototype.updateEditingSessionDraft = function (value, options) {
    updateEditingSessionDraftRuntime(this, value, options);
    if (!options || options.publish !== false) this.publishUiState();
  };
  SpreadsheetApp.prototype.getEditingSessionDraft = function (cellId) {
    return getEditingSessionDraftRuntime(this, cellId);
  };
  SpreadsheetApp.prototype.clearEditingSession = function (cellId, sheetId) {
    clearEditingSessionRuntime(this, { cellId: cellId, sheetId: sheetId });
    this.publishUiState();
  };
  SpreadsheetApp.prototype.handleGridEditingStateChange = function (input, editing) {
    syncEditingSessionWithGridStateRuntime(this, input, editing);
    this.syncEditorOverlay();
    this.publishUiState();
  };
  SpreadsheetApp.prototype.isDirectTypeKey = function (event) {
    return isDirectTypeKeyRuntime(this, event);
  };
  SpreadsheetApp.prototype.getDirectTypeValue = function (event) {
    return getDirectTypeValueRuntime(this, event);
  };
  SpreadsheetApp.prototype.startEditingCell = function (input) {
    startEditingCellRuntime(this, input);
  };
  SpreadsheetApp.prototype.ensureFloatingAttachmentPreview = function () {
    return ensureFloatingAttachmentPreviewRuntime(this);
  };
  SpreadsheetApp.prototype.setupAttachmentLinkPreview = function () {
    setupAttachmentLinkPreviewRuntime(this);
  };
  SpreadsheetApp.prototype.showFloatingAttachmentPreview = function (anchor) {
    showFloatingAttachmentPreviewRuntime(this, anchor);
  };
  SpreadsheetApp.prototype.positionFloatingAttachmentPreview = function (anchor) {
    positionFloatingAttachmentPreviewRuntime(this, anchor);
  };
  SpreadsheetApp.prototype.hideFloatingAttachmentPreview = function () {
    hideFloatingAttachmentPreviewRuntime(this);
  };
  SpreadsheetApp.prototype.setupCellNameControls = function () {
    setupCellNameControlsRuntime(this);
  };
  SpreadsheetApp.prototype.findSheetIdByName = function (sheetName) {
    return findSheetIdByNameRuntime(this, sheetName);
  };
  SpreadsheetApp.prototype.readCellComputedValue = function (sheetId, cellId) {
    var normalizedId = String(cellId).toUpperCase();
    var raw = this.storage.getCellValue(sheetId, normalizedId);
    if (
      raw &&
      raw.charAt(0) !== '=' &&
      raw.charAt(0) !== '>' &&
      raw.charAt(0) !== '#' &&
      raw.charAt(0) !== "'"
    ) {
      return String(raw);
    }
    var cache = this.computedValuesBySheet[sheetId];
    if (cache && Object.prototype.hasOwnProperty.call(cache, normalizedId)) {
      return String(cache[normalizedId] == null ? '' : cache[normalizedId]);
    }
    try {
      var value = this.formulaEngine.evaluateCell(sheetId, normalizedId, {});
      return String(value == null ? '' : value);
    } catch (e) {
      return String(raw == null ? '' : raw);
    }
  };
  SpreadsheetApp.prototype.readCellMentionValue = function (sheetId, cellId) {
    try {
      var value = this.formulaEngine.getMentionValue(
        sheetId,
        String(cellId).toUpperCase(),
        {},
      );
      return String(value == null ? '' : value);
    } catch (e) {
      return this.readCellComputedValue(sheetId, cellId);
    }
  };
  SpreadsheetApp.prototype.syncCellNameInput = function () {
    syncCellNameInputRuntime(this);
    this.publishUiState();
  };
  SpreadsheetApp.prototype.toggleCellBordersPicker = function () {
    toggleCellBordersPickerWiringRuntime(this);
  };
  SpreadsheetApp.prototype.toggleBgColorPicker = function () {
    toggleBgColorPickerWiringRuntime(this);
  };
  SpreadsheetApp.prototype.toggleCellFormatPicker = function () {
    toggleCellFormatPickerWiringRuntime(this);
  };
  SpreadsheetApp.prototype.toggleCellFontFamilyPicker = function () {
    toggleCellFontFamilyPickerWiringRuntime(this);
  };
  SpreadsheetApp.prototype.toggleAIModePicker = function () {
    toggleAIModePickerWiringRuntime(this);
  };
  SpreadsheetApp.prototype.toggleDisplayModePicker = function () {
    toggleDisplayModePickerWiringRuntime(this);
  };
  SpreadsheetApp.prototype.toggleNamedCellJumpPicker = function () {
    toggleNamedCellJumpPickerRuntime(this);
  };
  SpreadsheetApp.prototype.getNamedCellJumpUiState = function () {
    return getNamedCellJumpUiStateRuntime(this);
  };
  SpreadsheetApp.prototype.applyActiveCellName = function () {
    applyActiveCellNameRuntime(this);
  };
  SpreadsheetApp.prototype.refreshNamedCellJumpOptions = function () {
    refreshNamedCellJumpOptionsRuntime(this);
  };
  SpreadsheetApp.prototype.navigateToNamedCell = function (name) {
    navigateToNamedCellRuntime(this, name);
  };
  SpreadsheetApp.prototype.setNamedCellJumpActiveIndex = function (nextIndex) {
    setNamedCellJumpActiveIndexRuntime(this, nextIndex);
  };
}
