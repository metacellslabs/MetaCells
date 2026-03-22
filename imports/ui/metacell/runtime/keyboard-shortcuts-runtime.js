import { applyPresentationToSelection } from './toolbar-actions-runtime.js';

export function handleWorkbookGlobalClick(app, e) {
  if (!app.addTabMenuUiState || app.addTabMenuUiState.open !== true) return;
  if (e.target === app.addTabButton) return;
  if (
    app.addTabButton &&
    app.addTabButton.contains &&
    app.addTabButton.contains(e.target)
  ) {
    return;
  }
  if (e.target && e.target.closest && e.target.closest('.add-tab-menu')) return;
  app.hideAddTabMenu();
}

export function handleWorkbookGlobalKeydown(app, e) {
  var activeEl = document.activeElement;
  if (
    app.mentionAutocompleteState &&
    (e.key === 'ArrowDown' ||
      e.key === 'ArrowUp' ||
      e.key === 'Enter' ||
      e.key === 'Tab' ||
      e.key === 'Escape')
  ) {
    var mentionInput =
      app.mentionAutocompleteState.input ||
      (typeof app.getActiveEditorInput === 'function'
        ? app.getActiveEditorInput()
        : null) ||
      app.formulaInput ||
      app.activeInput;
    if (mentionInput && app.handleMentionAutocompleteKeydown(e, mentionInput)) {
      return true;
    }
  }
  var isEditableTarget = !!(
    activeEl &&
    ((activeEl.tagName === 'INPUT' && !activeEl.readOnly && !activeEl.disabled) ||
      activeEl === app.formulaInput ||
      activeEl === app.cellNameInput ||
      activeEl === app.reportEditor ||
      (activeEl.tagName === 'TEXTAREA' &&
        activeEl !== app.activeInput &&
        activeEl !== app.formulaInput) ||
      (activeEl.tagName === 'INPUT' &&
        activeEl !== app.activeInput &&
        activeEl !== app.formulaInput &&
        activeEl !== app.cellNameInput) ||
      activeEl.isContentEditable)
  );
  if (
    !e.metaKey &&
    !e.ctrlKey &&
    (e.key === 'Delete' || e.key === 'Backspace') &&
    !isEditableTarget &&
    !app.isReportActive() &&
    app.activeInput
  ) {
    e.preventDefault();
    app.clearSelectedCells();
    return true;
  }

  if ((e.metaKey || e.ctrlKey) && !e.altKey) {
    var key = String(e.key || '').toLowerCase();
    var isReportEditing = !!(
      activeEl &&
      app.reportEditor &&
      activeEl === app.reportEditor &&
      app.reportMode === 'edit'
    );
    var shouldUseWorkbookHistory = !app.hasPendingLocalEdit() && !isReportEditing;
    var isDisplayModeShortcut =
      key === '/' ||
      key === '?' ||
      e.code === 'Slash' ||
      e.code === 'NumpadDivide';
    if (shouldUseWorkbookHistory && key === 'z') {
      e.preventDefault();
      if (e.shiftKey) app.redo();
      else app.undo();
      return true;
    }
    if (shouldUseWorkbookHistory && key === 'y') {
      e.preventDefault();
      app.redo();
      return true;
    }
    if (!isReportEditing && isDisplayModeShortcut) {
      e.preventDefault();
      app.setDisplayMode(app.displayMode === 'formulas' ? 'values' : 'formulas');
      return true;
    }
    if (!isReportEditing && key === 'k' && !app.isReportActive()) {
      e.preventDefault();
      if (typeof app.runManualAIUpdate === 'function') {
        app.runManualAIUpdate();
      }
      return true;
    }
    if (!isReportEditing && key === '7' && !app.isReportActive()) {
      e.preventDefault();
      if (typeof app.copySelectedRangeDebugToClipboard === 'function') {
        app.copySelectedRangeDebugToClipboard();
      }
      return true;
    }
    if (!isReportEditing && key === 'b' && app.activeInput && !app.isReportActive()) {
      e.preventDefault();
      var currentBold = app.storage.getCellPresentation(
        app.activeSheetId,
        app.activeInput.id,
      );
      applyPresentationToSelection(
        app,
        { bold: !currentBold.bold },
        'cell-bold',
      );
      return true;
    }
    if (!isReportEditing && key === 'i' && app.activeInput && !app.isReportActive()) {
      e.preventDefault();
      var currentItalic = app.storage.getCellPresentation(
        app.activeSheetId,
        app.activeInput.id,
      );
      applyPresentationToSelection(
        app,
        { italic: !currentItalic.italic },
        'cell-italic',
      );
      return true;
    }
  }
  if (e.key !== 'Escape') return false;
  app.hideAddTabMenu();
  app.hideFormulaTrackerPanel();
  return false;
}

