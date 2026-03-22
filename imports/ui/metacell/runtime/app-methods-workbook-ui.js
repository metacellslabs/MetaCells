import { AI_MODE } from './constants.js';
import {
  clearWorkbookCrossSheetPickContext as clearWorkbookCrossSheetPickContextRuntime,
  ensureWorkbookShellState as ensureWorkbookShellStateRuntime,
  findWorkbookTabById as findWorkbookTabByIdRuntime,
  getWorkbookCrossSheetPickContext as getWorkbookCrossSheetPickContextRuntime,
  getWorkbookEditingOwnerSheetId as getWorkbookEditingOwnerSheetIdRuntime,
  getWorkbookShellTabs as getWorkbookShellTabsRuntime,
  getWorkbookVisibleSheetId as getWorkbookVisibleSheetIdRuntime,
  initializeWorkbookVisibleSheetId as initializeWorkbookVisibleSheetIdRuntime,
  isWorkbookReportTab as isWorkbookReportTabRuntime,
  setWorkbookCrossSheetPickContext as setWorkbookCrossSheetPickContextRuntime,
  setWorkbookVisibleSheetId as setWorkbookVisibleSheetIdRuntime,
  syncWorkbookShellTabs as syncWorkbookShellTabsRuntime,
} from './workbook-shell-model.js';
import {
  addReportTab as addReportTabRuntime,
  addTab as addTabRuntime,
  deleteActiveTab as deleteActiveTabRuntime,
  finishWorkbookCrossSheetPickAndReturnToSource as finishCrossTabMentionAndReturnToSourceRuntime,
  isWorkbookCrossSheetPickProxyActive as isCrossTabMentionProxyActiveRuntime,
  onTabDragEnd as onTabDragEndRuntime,
  onTabDragOver as onTabDragOverRuntime,
  onTabDragStart as onTabDragStartRuntime,
  onTabDrop as onTabDropRuntime,
  onWorkbookTabButtonClick as onTabButtonClickRuntime,
  renameActiveTab as renameActiveTabRuntime,
  renameTabById as renameTabByIdRuntime,
  renderTabs as renderTabsRuntime,
  reorderTabs as reorderTabsRuntime,
  restoreWorkbookCrossSheetPickEditor as restoreCrossTabMentionEditorRuntime,
  shouldStartWorkbookCrossSheetPick as shouldStartCrossTabMentionRuntime,
  startWorkbookCrossSheetPick as startCrossTabMentionRuntime,
  switchWorkbookSheet as switchToSheetRuntime,
  syncWorkbookCrossSheetPickSourceValue as syncCrossTabMentionSourceValueRuntime,
} from './workbook-shell-runtime.js';
import { ensureReportUI as ensureReportUIRuntime } from './report-shell-runtime.js';
import {
  getAIModeUiState as getAIModeUiStateRuntime,
  getRecentBgColors as getRecentBgColorsRuntime,
  getToolbarPickerOpenState as getToolbarPickerOpenStateRuntime,
  syncCellFormatControl as syncCellFormatControlRuntime,
  syncCellPresentationControls as syncCellPresentationControlsRuntime,
} from './toolbar-sync-runtime.js';
import {
  getMentionAutocompleteContext as getMentionAutocompleteContextRuntime,
  getMentionAutocompleteItems as getMentionAutocompleteItemsRuntime,
} from './mention-runtime.js';
import {
  applyFormulaMentionPreview as applyFormulaMentionPreviewRuntime,
  buildMentionTokenForSelection as buildMentionTokenForSelectionRuntime,
  canInsertFormulaMention as canInsertFormulaMentionRuntime,
  getMentionSheetPrefix as getMentionSheetPrefixRuntime,
  insertTextIntoInputAtCursor as insertTextIntoInputAtCursorRuntime,
} from './formula-mention-runtime.js';
import {
  applyMentionAutocompleteSelection as applyMentionAutocompleteSelectionRuntime,
  ensureMentionAutocomplete as ensureMentionAutocompleteRuntime,
  hideMentionAutocomplete as hideMentionAutocompleteRuntime,
  hideMentionAutocompleteSoon as hideMentionAutocompleteSoonRuntime,
  positionMentionAutocomplete as positionMentionAutocompleteRuntime,
  renderMentionAutocompleteList as renderMentionAutocompleteListRuntime,
  setAvailableChannels as setAvailableChannelsRuntime,
  setupMentionAutocomplete as setupMentionAutocompleteRuntime,
  updateMentionAutocomplete as updateMentionAutocompleteRuntime,
} from './mention-controller-runtime.js';
import {
  ensureAddTabMenu as ensureAddTabMenuRuntime,
  ensureContextMenu as ensureContextMenuRuntime,
  getAddTabMenuUiState as getAddTabMenuUiStateRuntime,
  getContextMenuUiState as getContextMenuUiStateRuntime,
  hideAddTabMenu as hideAddTabMenuRuntime,
  hideContextMenu as hideContextMenuRuntime,
  openContextMenu as openContextMenuRuntime,
  prepareContextFromCell as prepareContextFromCellRuntime,
  setupContextMenu as setupContextMenuRuntime,
  toggleAddTabMenu as toggleAddTabMenuRuntime,
} from './keyboard-menu-runtime.js';
import { setupButtons as setupButtonsRuntime } from './keyboard-runtime.js';

var REPORT_TAB_ID = 'report';

function normalizeFormulaBarBorders(borders) {
  var next = borders && typeof borders === 'object' ? borders : {};
  return {
    top: next.top === true,
    right: next.right === true,
    bottom: next.bottom === true,
    left: next.left === true,
  };
}

function getFormulaBarBordersPreset(borders) {
  var normalized = normalizeFormulaBarBorders(borders);
  if (
    normalized.top &&
    normalized.right &&
    normalized.bottom &&
    normalized.left
  ) {
    return 'all';
  }
  if (
    normalized.top &&
    !normalized.right &&
    !normalized.bottom &&
    !normalized.left
  ) {
    return 'top';
  }
  if (
    !normalized.top &&
    normalized.right &&
    !normalized.bottom &&
    !normalized.left
  ) {
    return 'right';
  }
  if (
    !normalized.top &&
    !normalized.right &&
    normalized.bottom &&
    !normalized.left
  ) {
    return 'bottom';
  }
  if (
    !normalized.top &&
    !normalized.right &&
    !normalized.bottom &&
    normalized.left
  ) {
    return 'left';
  }
  if (
    !normalized.top &&
    !normalized.right &&
    !normalized.bottom &&
    !normalized.left
  ) {
    return 'none';
  }
  return 'mixed';
}

export function installWorkbookUiMethods(SpreadsheetApp) {
  SpreadsheetApp.prototype.initializeActiveSheetId = function initializeActiveSheetId() {
    return initializeWorkbookVisibleSheetIdRuntime(this, {
      initialSheetId: this.initialSheetId,
      defaultSheetId: this.tabs[0] && this.tabs[0].id,
    });
  };

  SpreadsheetApp.prototype.ensureReportTabExists = function ensureReportTabExists() {
    for (var i = 0; i < this.tabs.length; i++) {
      if (this.tabs[i] && this.tabs[i].type === 'report') return;
      if (this.tabs[i] && this.tabs[i].id === REPORT_TAB_ID) {
        this.tabs[i].type = 'report';
        this.storage.saveTabs(this.tabs);
        this.syncWorkbookShellTabs(this.tabs);
        return;
      }
    }
    this.tabs.push({ id: REPORT_TAB_ID, name: 'Report', type: 'report' });
    this.storage.saveTabs(this.tabs);
    this.syncWorkbookShellTabs(this.tabs);
  };

  SpreadsheetApp.prototype.ensureReportUI = function ensureReportUI() {
    ensureReportUIRuntime(this);
  };

  SpreadsheetApp.prototype.isReportTab = function isReportTab(tabId) {
    return isWorkbookReportTabRuntime(this, tabId);
  };

  SpreadsheetApp.prototype.isReportActive = function isReportActive() {
    return this.isReportTab(this.activeSheetId);
  };

  SpreadsheetApp.prototype.findTabById = function findTabById(tabId) {
    return findWorkbookTabByIdRuntime(this, tabId);
  };

  SpreadsheetApp.prototype.ensureWorkbookShellState = function ensureWorkbookShellState() {
    return ensureWorkbookShellStateRuntime(this);
  };

  SpreadsheetApp.prototype.syncWorkbookShellTabs = function syncWorkbookShellTabs(tabs) {
    var result = syncWorkbookShellTabsRuntime(this, tabs);
    this.publishUiState();
    return result;
  };

  SpreadsheetApp.prototype.getWorkbookTabs = function getWorkbookTabs() {
    return getWorkbookShellTabsRuntime(this);
  };

  SpreadsheetApp.prototype.getVisibleSheetId = function getVisibleSheetId() {
    return getWorkbookVisibleSheetIdRuntime(this);
  };

  SpreadsheetApp.prototype.setVisibleSheetId = function setVisibleSheetId(sheetId, options) {
    var result = setWorkbookVisibleSheetIdRuntime(this, sheetId, options);
    this.publishUiState();
    return result;
  };

  SpreadsheetApp.prototype.getEditingOwnerSheetId = function getEditingOwnerSheetId() {
    return getWorkbookEditingOwnerSheetIdRuntime(this);
  };

  SpreadsheetApp.prototype.getCrossSheetPickContext = function getCrossSheetPickContext() {
    return getWorkbookCrossSheetPickContextRuntime(this);
  };

  SpreadsheetApp.prototype.setCrossSheetPickContext = function setCrossSheetPickContext(context) {
    var result = setWorkbookCrossSheetPickContextRuntime(this, context);
    this.publishUiState();
    return result;
  };

  SpreadsheetApp.prototype.clearCrossSheetPickContext = function clearCrossSheetPickContext() {
    var result = clearWorkbookCrossSheetPickContextRuntime(this);
    this.publishUiState();
    return result;
  };

  SpreadsheetApp.prototype.applyViewMode = function applyViewMode() {
    var report = this.isReportActive();
    document.body.classList.toggle('report-active', report);
    if (this.tableWrap) this.tableWrap.style.display = report ? 'none' : 'block';
    if (this.reportWrap) this.reportWrap.style.display = report ? 'block' : 'none';
    if (this.formulaBar) this.formulaBar.style.display = 'flex';
    if (this.nameBar) this.nameBar.style.display = 'flex';
    this.deleteTabButton.disabled = report;
    if (report && this.regionRecordingState && this.regionRecordingState.isRecording) {
      this.stopRegionRecording(true);
    }
    this.syncRegionRecordingControls();
  };

  SpreadsheetApp.prototype.setupButtons = function setupButtons() {
    setupButtonsRuntime(this);
  };

  SpreadsheetApp.prototype.ensureAddTabMenu = function ensureAddTabMenu() {
    return ensureAddTabMenuRuntime(this);
  };

  SpreadsheetApp.prototype.getAddTabMenuUiState = function getAddTabMenuUiState() {
    return getAddTabMenuUiStateRuntime(this);
  };

  SpreadsheetApp.prototype.toggleAddTabMenu = function toggleAddTabMenu() {
    toggleAddTabMenuRuntime(this);
  };

  SpreadsheetApp.prototype.hideAddTabMenu = function hideAddTabMenu() {
    hideAddTabMenuRuntime(this);
  };

  SpreadsheetApp.prototype.onTabButtonClick = function onTabButtonClick(tabId) {
    onTabButtonClickRuntime(this, tabId);
  };

  SpreadsheetApp.prototype.shouldStartCrossTabMention = function shouldStartCrossTabMention(tabId) {
    return shouldStartCrossTabMentionRuntime(this, tabId);
  };

  SpreadsheetApp.prototype.startCrossTabMention = function startCrossTabMention(targetSheetId) {
    startCrossTabMentionRuntime(this, targetSheetId);
  };

  SpreadsheetApp.prototype.restoreCrossTabMentionEditor = function restoreCrossTabMentionEditor() {
    restoreCrossTabMentionEditorRuntime(this);
  };

  SpreadsheetApp.prototype.syncCrossTabMentionSourceValue = function syncCrossTabMentionSourceValue(nextValue) {
    return syncCrossTabMentionSourceValueRuntime(this, nextValue);
  };

  SpreadsheetApp.prototype.isCrossTabMentionProxyActive = function isCrossTabMentionProxyActive() {
    return isCrossTabMentionProxyActiveRuntime(this);
  };

  SpreadsheetApp.prototype.finishCrossTabMentionAndReturnToSource = function finishCrossTabMentionAndReturnToSource() {
    return finishCrossTabMentionAndReturnToSourceRuntime(this);
  };

  SpreadsheetApp.prototype.ensureContextMenu = function ensureContextMenu() {
    return ensureContextMenuRuntime(this);
  };

  SpreadsheetApp.prototype.getContextMenuUiState = function getContextMenuUiState() {
    return getContextMenuUiStateRuntime(this);
  };

  SpreadsheetApp.prototype.setupContextMenu = function setupContextMenu() {
    setupContextMenuRuntime(this);
  };

  SpreadsheetApp.prototype.prepareContextFromCell = function prepareContextFromCell(td) {
    prepareContextFromCellRuntime(this, td);
  };

  SpreadsheetApp.prototype.openContextMenu = function openContextMenu(clientX, clientY) {
    openContextMenuRuntime(this, clientX, clientY);
  };

  SpreadsheetApp.prototype.hideContextMenu = function hideContextMenu() {
    hideContextMenuRuntime(this);
  };

  SpreadsheetApp.prototype.ensureMentionAutocomplete = function ensureMentionAutocomplete() {
    return ensureMentionAutocompleteRuntime(this);
  };

  SpreadsheetApp.prototype.setupMentionAutocomplete = function setupMentionAutocomplete() {
    setupMentionAutocompleteRuntime(this);
  };

  SpreadsheetApp.prototype.hideMentionAutocompleteSoon = function hideMentionAutocompleteSoon() {
    hideMentionAutocompleteSoonRuntime(this);
  };

  SpreadsheetApp.prototype.hideMentionAutocomplete = function hideMentionAutocomplete() {
    hideMentionAutocompleteRuntime(this);
  };

  SpreadsheetApp.prototype.updateMentionAutocomplete = function updateMentionAutocomplete(input) {
    updateMentionAutocompleteRuntime(this, input);
  };

  SpreadsheetApp.prototype.getMentionAutocompleteContext = function getMentionAutocompleteContext(input) {
    return getMentionAutocompleteContextRuntime(this, input);
  };

  SpreadsheetApp.prototype.getMentionAutocompleteItems = function getMentionAutocompleteItems(query, marker) {
    return getMentionAutocompleteItemsRuntime(this, query, marker);
  };

  SpreadsheetApp.prototype.renderMentionAutocompleteList = function renderMentionAutocompleteList() {
    renderMentionAutocompleteListRuntime(this);
  };

  SpreadsheetApp.prototype.positionMentionAutocomplete = function positionMentionAutocomplete(input) {
    positionMentionAutocompleteRuntime(this, input);
  };

  SpreadsheetApp.prototype.handleMentionAutocompleteKeydown = function handleMentionAutocompleteKeydown(e, input) {
    if (!this.mentionAutocompleteState) return false;
    var stateInputId = String(this.mentionAutocompleteState.inputId || '');
    var targetInputId = String((input && input.id) || '');
    if (
      this.mentionAutocompleteState.input !== input &&
      (!stateInputId || !targetInputId || stateInputId !== targetInputId)
    ) {
      return false;
    }
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      if (typeof e.stopPropagation === 'function') e.stopPropagation();
      if (typeof e.stopImmediatePropagation === 'function') {
        e.stopImmediatePropagation();
      }
      var next = this.mentionAutocompleteState.activeIndex + 1;
      if (next >= this.mentionAutocompleteState.items.length) next = 0;
      this.mentionAutocompleteState.activeIndex = next;
      this.renderMentionAutocompleteList();
      return true;
    }
    if (e.key === 'ArrowUp') {
      e.preventDefault();
      if (typeof e.stopPropagation === 'function') e.stopPropagation();
      if (typeof e.stopImmediatePropagation === 'function') {
        e.stopImmediatePropagation();
      }
      var prev = this.mentionAutocompleteState.activeIndex - 1;
      if (prev < 0) prev = this.mentionAutocompleteState.items.length - 1;
      this.mentionAutocompleteState.activeIndex = prev;
      this.renderMentionAutocompleteList();
      return true;
    }
    if (e.key === 'Enter' || e.key === 'Tab') {
      e.preventDefault();
      if (typeof e.stopPropagation === 'function') e.stopPropagation();
      if (typeof e.stopImmediatePropagation === 'function') {
        e.stopImmediatePropagation();
      }
      this.applyMentionAutocompleteSelection(this.mentionAutocompleteState.activeIndex);
      return true;
    }
    if (e.key === 'Escape') {
      e.preventDefault();
      if (typeof e.stopPropagation === 'function') e.stopPropagation();
      if (typeof e.stopImmediatePropagation === 'function') {
        e.stopImmediatePropagation();
      }
      this.hideMentionAutocomplete();
      return true;
    }
    return false;
  };

  SpreadsheetApp.prototype.applyMentionAutocompleteSelection = function applyMentionAutocompleteSelection(index) {
    applyMentionAutocompleteSelectionRuntime(this, index);
  };

  SpreadsheetApp.prototype.setAvailableChannels = function setAvailableChannels(channels) {
    setAvailableChannelsRuntime(this, channels);
  };

  SpreadsheetApp.prototype.canInsertFormulaMention = function canInsertFormulaMention(raw) {
    return canInsertFormulaMentionRuntime(this, raw);
  };

  SpreadsheetApp.prototype.getFormulaMentionBaseCellId = function getFormulaMentionBaseCellId(fallbackCellId, key) {
    if (!this.getSelectionRange()) return this.formulaRefCursorId || fallbackCellId;
    var baseInput =
      this.inputById[this.formulaRefCursorId || fallbackCellId] ||
      this.inputById[fallbackCellId];
    var edgeInput = this.getSelectionEdgeInputForDirection(
      baseInput || this.inputById[fallbackCellId],
      key,
    );
    return edgeInput ? edgeInput.id : this.formulaRefCursorId || fallbackCellId;
  };

  SpreadsheetApp.prototype.buildMentionTokenForSelection = function buildMentionTokenForSelection(fallbackCellId, isRangeMode) {
    return buildMentionTokenForSelectionRuntime(this, fallbackCellId, isRangeMode);
  };

  SpreadsheetApp.prototype.getMentionSheetPrefix = function getMentionSheetPrefix() {
    return getMentionSheetPrefixRuntime(this);
  };

  SpreadsheetApp.prototype.insertTextIntoInputAtCursor = function insertTextIntoInputAtCursor(input, text) {
    insertTextIntoInputAtCursorRuntime(this, input, text);
  };

  SpreadsheetApp.prototype.applyFormulaMentionPreview = function applyFormulaMentionPreview(input, token) {
    applyFormulaMentionPreviewRuntime(this, input, token);
  };

  SpreadsheetApp.prototype.getPreferredMentionLabel = function getPreferredMentionLabel(cellId) {
    var name = this.storage.getCellNameFor(
      this.activeSheetId,
      String(cellId || '').toUpperCase(),
    );
    return name ? name : String(cellId).toUpperCase();
  };

  SpreadsheetApp.prototype.syncCellFormatControl = function syncCellFormatControl() {
    syncCellFormatControlRuntime(this);
    this.publishUiState();
  };

  SpreadsheetApp.prototype.syncCellPresentationControls = function syncCellPresentationControls() {
    syncCellPresentationControlsRuntime(this);
    this.publishUiState();
  };

  SpreadsheetApp.prototype.collectFormulaBarUiState = function collectFormulaBarUiState() {
    var activeCellId = String(this.activeCellId || '');
    var disabled = !activeCellId || this.isReportActive();
    var currentFormat = disabled
      ? 'text'
      : String(this.getCellFormat(activeCellId) || 'text');
    var presentation = disabled
      ? {
          align: 'left',
          wrapText: false,
          bold: false,
          italic: false,
          backgroundColor: '',
          fontFamily: 'default',
          fontSize: 14,
          decimalPlaces: null,
          borders: { top: false, right: false, bottom: false, left: false },
        }
      : this.getCellPresentation(activeCellId);
    var bordersPreset = disabled
      ? 'none'
      : this.cellBordersButton
        ? String(
            this.cellBordersButton.getAttribute('data-border-preset') ||
              getFormulaBarBordersPreset(presentation.borders),
          )
        : getFormulaBarBordersPreset(presentation.borders);
    return {
      disabled: disabled,
      currentFormat: currentFormat,
      align: String(presentation.align || 'left'),
      wrapText: !!presentation.wrapText,
      bold: !!presentation.bold,
      italic: !!presentation.italic,
      backgroundColor: String(presentation.backgroundColor || ''),
      recentBgColors: getRecentBgColorsRuntime(this),
      customBgColorValue: String(presentation.backgroundColor || '#fff7cc'),
      bordersPreset: bordersPreset,
      aiModePickerOpen:
        !!(
          this.aiModePopover &&
          this.getAIModeUiState &&
          this.getAIModeUiState().pickerOpen
        ),
      displayModePickerOpen: getToolbarPickerOpenStateRuntime(
        this,
        'displayMode',
        this.displayModePopover,
      ),
      formatPickerOpen: getToolbarPickerOpenStateRuntime(
        this,
        'format',
        this.cellFormatPopover,
      ),
      bordersPickerOpen: getToolbarPickerOpenStateRuntime(
        this,
        'borders',
        this.cellBordersPopover,
      ),
      bgColorPickerOpen: getToolbarPickerOpenStateRuntime(
        this,
        'bgColor',
        this.cellBgColorPopover,
      ),
      fontFamily: String(presentation.fontFamily || 'default'),
      fontFamilyPickerOpen: getToolbarPickerOpenStateRuntime(
        this,
        'fontFamily',
        this.cellFontFamilyPopover,
      ),
      fontSize: Number(presentation.fontSize || 14),
      decimalsDisabled: disabled,
      fontSizeDisabled: disabled,
    };
  };

  SpreadsheetApp.prototype.renderTabs = function renderTabs() {
    renderTabsRuntime(this);
    this.publishUiState();
  };

  SpreadsheetApp.prototype.onTabDragStart = function onTabDragStart(event, tabId) {
    onTabDragStartRuntime(this, event, tabId);
  };

  SpreadsheetApp.prototype.onTabDragEnd = function onTabDragEnd() {
    onTabDragEndRuntime(this);
  };

  SpreadsheetApp.prototype.onTabDragOver = function onTabDragOver(event, targetTabId) {
    onTabDragOverRuntime(this, event, targetTabId);
  };

  SpreadsheetApp.prototype.onTabDrop = function onTabDrop(event, targetTabId) {
    onTabDropRuntime(this, event, targetTabId);
  };

  SpreadsheetApp.prototype.reorderTabs = function reorderTabs(dragId, targetId) {
    reorderTabsRuntime(this, dragId, targetId);
  };

  SpreadsheetApp.prototype.addTab = function addTab() {
    addTabRuntime(this);
  };

  SpreadsheetApp.prototype.addReportTab = function addReportTab() {
    addReportTabRuntime(this);
  };

  SpreadsheetApp.prototype.addPerformanceTestTab = function addPerformanceTestTab() {
    addTabRuntime(this, { template: 'performance' });
  };

  SpreadsheetApp.prototype.renameActiveTab = function renameActiveTab() {
    renameActiveTabRuntime(this);
  };

  SpreadsheetApp.prototype.renameTabById = function renameTabById(tabId) {
    renameTabByIdRuntime(this, tabId);
  };

  SpreadsheetApp.prototype.deleteActiveTab = function deleteActiveTab() {
    deleteActiveTabRuntime(this);
  };

  SpreadsheetApp.prototype.switchToSheet = function switchToSheet(sheetId) {
    switchToSheetRuntime(this, sheetId);
  };

  SpreadsheetApp.prototype.runManualAIUpdate = function runManualAIUpdate(options) {
    var opts = options && typeof options === 'object' ? options : {};
    if (!this.aiService || this.aiService.getMode() !== AI_MODE.manual) return;
    if (this.hasPendingLocalEdit()) {
      this.commitFormulaBarValue();
    }
    this.computeAll({
      bypassPendingEdit: true,
      manualTriggerAI: true,
      forceRefreshAI: !!opts.forceRefreshAI,
    });
  };
}
