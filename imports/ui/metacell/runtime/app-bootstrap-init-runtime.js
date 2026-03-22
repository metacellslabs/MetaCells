import {
  GRID_ROWS,
  GRID_COLS,
  DEFAULT_COL_WIDTH,
  DEFAULT_ROW_HEIGHT,
} from './constants.js';
import { StorageService } from './storage-service.js';
import { AIService } from './ai-service.js';
import { FormulaEngine } from './formula-engine.js';
import { GridManager } from './grid-manager.js';
import { ensureSelectionModel } from './selection-model.js';
import { ensureSpillModel } from './spill-model.js';
import { ensureEditingSession } from './editing-session-runtime.js';

export function initializeSpreadsheetAppState(app, opts) {
  app.storage = new StorageService(opts.storage);
  app.tabs = app.storage.readTabs();
  app.syncWorkbookShellTabs(app.tabs);
  app.ensureReportTabExists();
  app.activeSheetId = app.initializeActiveSheetId();
  app.activeInput = null;
  app.activeCellId = '';
  app.selectionModel = ensureSelectionModel(app);
  app.spillModel = ensureSpillModel(app);
  app.editingSession = ensureEditingSession(app);
  app.fillDrag = null;
  app.selectionDrag = null;
  app.selectionDragJustFinished = false;
  app.sortStateBySheet = {};
  app.isResorting = false;
  app.dragTabId = null;
  app.editStartRawByCell = {};
  app.gridRows = GRID_ROWS;
  app.gridCols = GRID_COLS;
  app.grid = new GridManager(
    app.table,
    app.gridRows,
    app.gridCols,
    DEFAULT_COL_WIDTH,
    DEFAULT_ROW_HEIGHT,
  );
  app.grid.cellContentStore = app.cellContentStore || null;
  app.grid.onEditingStateChange = (input, editing) => {
    app.handleGridEditingStateChange(input, editing);
  };
  app.refreshGridReferences();
  app.selectionAnchorId = null;
  app.selectionRange = null;
  app.fillRange = null;
  app.extendSelectionNav = false;
  app.lastSelectAllShortcutTs = 0;
  app.formulaRefCursorId = null;
  app.formulaMentionPreview = null;
  app.aiService = new AIService(app.storage, () => app.computeAll(), {
    sheetDocumentId: app.sheetDocumentId,
    getActiveSheetId: () => app.activeSheetId,
  });
  app.formulaEngine = new FormulaEngine(
    app.storage,
    app.aiService,
    () => app.tabs,
    app.cellIds,
  );
  app.uncomputedMonitorMs = 2000;
  app.uncomputedMonitorId = null;
  app.backgroundComputeEnabled = false;
  app.fullscreenOverlay = null;
  app.fullscreenOverlayContent = null;
  app.editorOverlay = null;
  app.editorOverlayInput = null;
  app.editorOverlayUiState = null;
  app.editorOverlayPendingFocus = false;
  app.handleEditorOverlayViewportSync = null;
  app.reportMode = 'edit';
  app.calcProgressHideTimer = null;
  app.lastReportLiveHtml = '';
  app.addTabMenu = null;
  app.contextMenu = null;
  app.contextMenuState = null;
  app.headerSelectionDrag = null;
  app.mentionAutocomplete = null;
  app.mentionAutocompleteState = null;
  app.mentionAutocompleteUiState = null;
  app.suppressBlurCommitOnce = false;
  app.suppressFormulaBarBlurCommitOnce = false;
  app.computedValuesBySheet = {};
  app.computeRequestToken = 0;
  app.manualUpdateRequestToken = 0;
  app.isManualAIUpdating = false;
  app.currentServerEditLockKey = '';
  app.channelCommandInFlightByCell = {};
  app.channelCommandInFlightSignatureByCell = {};
  app.channelCommandQueuedByCell = {};
  app.channelCommandLastSettledByCell = {};
  app.displayMode =
    app.displayModeButton &&
    String(
      app.displayModeButton.getAttribute('data-display-mode-current') || '',
    )
      .trim()
      .toLowerCase() === 'formulas'
      ? 'formulas'
      : 'values';
  app.editLockOwnerId =
    'lock-' + Date.now() + '-' + Math.random().toString(36).slice(2);
  app.editLockSequence = 0;
  app.pendingAttachmentContext = null;
  app.floatingAttachmentPreview = null;
  app.attachmentPreviewTimer = null;
  app.attachmentPreviewAnchor = null;
  app.attachmentContentOverlay = null;
  app.attachmentContentTitle = null;
  app.attachmentContentBody = null;
  app.handleAttachmentContentOverlayKeydown = null;
  app.handleAttachmentPreviewMouseOver = null;
  app.handleAttachmentPreviewMouseOut = null;
  app.handleAttachmentPreviewScroll = null;
  app.undoStack = [];
  app.redoStack = [];
  app.maxHistoryEntries = 100;
  app.historyGroupKey = '';
  app.historyGroupAt = 0;
  app.historyGroupWindowMs = 1200;
  app.isApplyingHistory = false;
  app.regionRecordingState = null;
  app.regionRecordingGifUrl = '';
  app.regionRecordingFilename = '';
  app.regionRecordingDownloadReady = false;
  app.regionRecordingResultSelectionKey = '';
  app.regionRecordingLastSelectionKey = '';
  app.regionRecordingStatus = '';
  app.regionRecordingTimerId = null;
  app.handleToolbarOffsetSync = null;
  app.formulaBarResizeObserver = null;
  app.viewportRenderingEnabled = true;
  app.viewportOverscanRows = 12;
  app.viewportRenderThreshold = 160;
  app.viewportRenderFramePending = false;
  app.handleViewportRenderSync = null;
  app.viewportRenderingRuntimeBound = false;
}
