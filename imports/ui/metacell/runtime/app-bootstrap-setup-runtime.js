import { setupViewportRendering as setupViewportRenderingRuntime } from './viewport-render-runtime.js';

export function setupSpreadsheetAppBehavior(app) {
  app.setupColumnSort();
  app.setupGridResizing();
  app.setupButtons();
  app.setupAIModeControls();
  app.setupDisplayModeControls();
  app.setupCellFormatControls();
  app.setupCellPresentationControls();
  app.setupRegionRecordingControls();
  app.setupCellNameControls();
  app.setupAttachmentControls();
  app.setupReportControls();
  app.bindGridInputEvents();
  app.bindHeaderSelectionEvents();
  app.bindFormulaBarEvents();
  app.setupMentionAutocomplete();
  app.setupEditorOverlay();
  app.setupFullscreenOverlay();
  app.setupContextMenu();
  app.setupScheduleDialog();
  app.setupAssistantPanel();
  app.setupFormulaTrackerPanel();
  app.setupAttachmentLinkPreview();
  app.setupToolbarOffsetSync();
  setupViewportRenderingRuntime(app);
  app.startUncomputedMonitor();
  app.renderTabs();
  app.applyViewMode();
  app.applyActiveSheetLayout();
  app.renderCurrentSheetFromStorage();
  app.ensureActiveCell();
  app.restoreGridKeyboardFocusSoon();
  app.publishUiState();
}
