import {
  addReportTab,
  addTab,
  deleteActiveTab,
  onTabDragEnd,
  onTabDragOver,
  onTabDragStart,
  onTabDrop,
  renameActiveTab,
  renameTabById,
  renderTabs,
  reorderTabs,
} from './sheet-shell-runtime.js';
import {
  finishCrossSheetPickAndReturnToSource,
  isCrossSheetPickProxyActive,
  restoreCrossSheetPickEditor,
  startCrossSheetPick,
  syncCrossSheetPickSourceValue,
} from './cross-sheet-pick-runtime.js';

export {
  addReportTab,
  addTab,
  deleteActiveTab,
  onTabDragEnd,
  onTabDragOver,
  onTabDragStart,
  onTabDrop,
  renameActiveTab,
  renameTabById,
  renderTabs,
  reorderTabs,
};

export function switchWorkbookSheet(app, sheetId) {
  if (!app.findTabById(sheetId)) return;
  var crossSheetPickContext = app.getCrossSheetPickContext();
  var keepCrossMention = !!(
    crossSheetPickContext &&
    sheetId !== crossSheetPickContext.sourceSheetId &&
    !app.isReportTab(sheetId)
  );

  app.clearActiveInput();
  app.setVisibleSheetId(sheetId);

  app.renderTabs();
  app.applyViewMode();
  if (app.isReportActive()) {
    if (app.reportEditor) {
      app.reportEditor.innerHTML =
        app.storage.getReportContent(app.activeSheetId) || '<p></p>';
    }
    app.setReportMode('view');
    app.ensureActiveCell();
    if (keepCrossMention) app.restoreCrossTabMentionEditor();
    return;
  }
  app.applyActiveSheetLayout();
  app.updateSortIcons();
  app.syncCellNameInput();
  app.renderCurrentSheetFromStorage();
  app.ensureActiveCell();
  if (typeof app.restoreGridKeyboardFocusSoon === 'function') {
    app.restoreGridKeyboardFocusSoon();
  }
  setTimeout(function () {
    if (app.activeSheetId !== sheetId || app.isReportActive()) return;
    app.computeAll();
  }, 0);
  if (keepCrossMention) app.restoreCrossTabMentionEditor();
}

export function onWorkbookTabButtonClick(app, tabId) {
  if (!app.findTabById(tabId)) return;
  if (shouldStartWorkbookCrossSheetPick(app, tabId)) {
    startWorkbookCrossSheetPick(app, tabId);
    return;
  }
  app.clearCrossSheetPickContext();
  switchWorkbookSheet(app, tabId);
}

export function shouldStartWorkbookCrossSheetPick(app, tabId) {
  if (app.isReportTab(tabId)) return false;
  if (tabId === app.activeSheetId) return false;
  if (!app.activeInput) return false;
  var formulaRaw = String(app.formulaInput ? app.formulaInput.value : '');
  if (app.canInsertFormulaMention(formulaRaw)) return true;
  var editingTarget =
    typeof app.getActiveEditorInput === 'function'
      ? app.getActiveEditorInput()
      : app.activeInput;
  var editingRaw = String(
    editingTarget && editingTarget.value != null ? editingTarget.value : '',
  );
  if (
    app.isEditingCell(app.activeInput) &&
    app.canInsertFormulaMention(editingRaw)
  ) {
    return true;
  }
  return false;
}

export function startWorkbookCrossSheetPick(app, targetSheetId) {
  startCrossSheetPick(app, targetSheetId);
}

export function restoreWorkbookCrossSheetPickEditor(app) {
  restoreCrossSheetPickEditor(app);
}

export function syncWorkbookCrossSheetPickSourceValue(app, nextValue) {
  return syncCrossSheetPickSourceValue(app, nextValue);
}

export function isWorkbookCrossSheetPickProxyActive(app) {
  return isCrossSheetPickProxyActive(app);
}

export function finishWorkbookCrossSheetPickAndReturnToSource(app) {
  return finishCrossSheetPickAndReturnToSource(app);
}
