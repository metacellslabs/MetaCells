function getVisibleSheetId(app) {
  return typeof app.getVisibleSheetId === 'function'
    ? String(app.getVisibleSheetId() || '')
    : String(app.activeSheetId || '');
}

function getEditingOwnerSheetId(app) {
  return typeof app.getEditingOwnerSheetId === 'function'
    ? String(app.getEditingOwnerSheetId() || '')
    : getVisibleSheetId(app);
}

function getCrossSheetPickContext(app) {
  return typeof app.getCrossSheetPickContext === 'function'
    ? app.getCrossSheetPickContext()
    : null;
}

function setCrossSheetPickContext(app, context) {
  if (typeof app.setCrossSheetPickContext === 'function') {
    return app.setCrossSheetPickContext(context);
  }
  return context && typeof context === 'object' ? context : null;
}

function clearCrossSheetPickContext(app) {
  if (typeof app.clearCrossSheetPickContext === 'function') {
    return app.clearCrossSheetPickContext();
  }
  return null;
}

export function startCrossSheetPick(app, targetSheetId) {
  if (!app.activeInput) return app.switchToSheet(targetSheetId);
  var sourceCellId = app.activeInput.id;
  var sourceSheetId = getEditingOwnerSheetId(app);
  var activeEditor =
    typeof app.getActiveEditorInput === 'function'
      ? app.getActiveEditorInput()
      : null;
  var sourceValue = String(
    activeEditor && activeEditor.value != null
      ? activeEditor.value
      : app.getRawCellValue(sourceCellId) || '',
  );

  setCrossSheetPickContext(app, {
    sourceSheetId: sourceSheetId,
    sourceCellId: sourceCellId,
    value: sourceValue,
  });

  app.storage.setCellValue(sourceSheetId, sourceCellId, sourceValue);
  app.suppressBlurCommitOnce = true;
  app.switchToSheet(targetSheetId);
  restoreCrossSheetPickEditor(app);
}

export function restoreCrossSheetPickEditor(app) {
  var context = getCrossSheetPickContext(app);
  if (!context) return;
  if (getVisibleSheetId(app) === context.sourceSheetId) return;
  if (app.isReportActive()) return;

  var targetInput =
    (typeof app.getCellInput === 'function'
      ? app.getCellInput(context.sourceCellId)
      : app.inputById[context.sourceCellId]) ||
    app.activeInput ||
    (typeof app.getCellInput === 'function'
      ? app.getCellInput('A1')
      : app.inputById['A1']);
  if (!targetInput) return;
  app.setActiveInput(targetInput);
  app.startEditingCell(targetInput);
  app.editStartRawByCell[targetInput.id] = context.value;
  app.syncActiveEditorValue(context.value);
}

export function syncCrossSheetPickSourceValue(app, nextValue) {
  var context = getCrossSheetPickContext(app);
  if (!context) return false;
  setCrossSheetPickContext(app, {
    ...context,
    value: String(nextValue == null ? '' : nextValue),
  });
  return true;
}

export function isCrossSheetPickProxyActive(app) {
  var context = getCrossSheetPickContext(app);
  return !!(
    context &&
    getVisibleSheetId(app) !== context.sourceSheetId
  );
}

export function finishCrossSheetPickAndReturnToSource(app) {
  var context = getCrossSheetPickContext(app);
  if (!context) return false;
  if (!isCrossSheetPickProxyActive(app)) return false;

  var finalValue = String(context.value == null ? '' : context.value);
  app.storage.setCellValue(context.sourceSheetId, context.sourceCellId, finalValue);

  clearCrossSheetPickContext(app);
  app.switchToSheet(context.sourceSheetId);
  var sourceInput =
    typeof app.getCellInput === 'function'
      ? app.getCellInput(context.sourceCellId)
      : app.inputById[context.sourceCellId];
  if (!sourceInput) return true;

  app.setActiveInput(sourceInput);
  app.startEditingCell(sourceInput);
  app.editStartRawByCell[sourceInput.id] = finalValue;
  app.syncActiveEditorValue(finalValue);
  var caret = finalValue.length;
  if (typeof app.setEditorSelectionRange === 'function') {
    app.setEditorSelectionRange(caret, caret);
  } else if (typeof sourceInput.setSelectionRange === 'function') {
    sourceInput.setSelectionRange(caret, caret);
  }
  app.focusActiveEditor();
  return true;
}
