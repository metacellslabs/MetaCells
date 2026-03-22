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

export function commitFormulaBarValue(app, options) {
  var activeInput = app.getActiveCellInput ? app.getActiveCellInput() : null;
  var crossSheetPickContext = app.getCrossSheetPickContext();
  if (!activeInput) return;
  if (
    crossSheetPickContext &&
    getEditingOwnerSheetId(app) !== crossSheetPickContext.sourceSheetId
  )
    return;

  var raw = String(app.formulaInput ? app.formulaInput.value : '');
  if (typeof app.normalizeCommittedRawValue === 'function') {
    raw = app.normalizeCommittedRawValue(raw);
  }
  app.commitFormulaBarEditing(activeInput, {
    rawValue: raw,
    origin: 'formula-bar',
    restoreFocus: !!(options && options.restoreFocus),
  });
}

export function bindFormulaBarEvents(app) {
  if (app.formulaBar) {
    app.formulaBar.addEventListener('mousedown', (e) => {
      if (e.button !== 0) return;
      var button =
        e.target && e.target.closest ? e.target.closest('button') : null;
      if (!button || button.disabled) return;
      e.preventDefault();
    });
  }

  app.formulaInput.addEventListener('input', (e) => {
    var activeInput = app.getActiveCellInput ? app.getActiveCellInput() : null;
    var crossSheetPickContext = app.getCrossSheetPickContext();
    if (!activeInput) return;
    var raw = e.target.value;
    var selectionStart =
      typeof app.formulaInput.selectionStart === 'number'
        ? app.formulaInput.selectionStart
        : raw.length;
    var selectionEnd =
      typeof app.formulaInput.selectionEnd === 'number'
        ? app.formulaInput.selectionEnd
        : raw.length;
    if (!crossSheetPickContext) {
      if (!app.isEditingCell(activeInput)) {
        app.enterFormulaBarEditing(activeInput, {
          draftRaw: raw,
          origin: 'formula-bar',
        });
      }
      app.syncCellDraft(activeInput, raw, {
        origin: 'formula-bar',
        syncFormula: false,
      });
    }
    app.updateEditingSessionDraft(raw, {
      origin: 'formula-bar',
      publish: false,
    });
    app.syncCrossTabMentionSourceValue(raw);
    app.syncAIDraftLock();
    app.syncAIModeUI({ publish: false });
    app.updateMentionAutocomplete(app.formulaInput);
    if (String(app.formulaInput.value || '') !== raw) {
      app.formulaInput.value = raw;
      if (typeof app.setEditorSelectionRange === 'function') {
        app.setEditorSelectionRange(selectionStart, selectionEnd, app.formulaInput);
      } else if (typeof app.formulaInput.setSelectionRange === 'function') {
        app.formulaInput.setSelectionRange(selectionStart, selectionEnd);
      }
      if (app.formulaMentionPreview) {
        app.formulaMentionPreview = null;
      }
      app.syncCellDraft(activeInput, raw, {
        origin: 'formula-bar',
        syncFormula: false,
      });
      app.updateEditingSessionDraft(raw, {
        origin: 'formula-bar',
        publish: false,
      });
    }
  });

  app.formulaInput.addEventListener('keydown', (e) => {
    var activeInput = app.getActiveCellInput ? app.getActiveCellInput() : null;
    if (!activeInput) return;
    if (app.handleMentionAutocompleteKeydown(e, app.formulaInput)) {
      if (typeof e.stopPropagation === 'function') e.stopPropagation();
      if (typeof e.stopImmediatePropagation === 'function') {
        e.stopImmediatePropagation();
      }
      return;
    }
    if (e.key === 'Enter' && app.finishCrossTabMentionAndReturnToSource()) {
      e.preventDefault();
      return;
    }
    if (e.key === 'Enter') {
      e.preventDefault();
      app.commitFormulaBarValue({ restoreFocus: true });
      return;
    }
    if (e.key === 'Escape') {
      e.preventDefault();
      app.cancelCellEditing(activeInput);
      app.suppressFormulaBarBlurCommitOnce = true;
      app.restoreFocusAfterEditingExit();
    }
  });
  app.formulaInput.addEventListener('blur', () => {
    var suppressCommit = app.suppressFormulaBarBlurCommitOnce;
    app.suppressFormulaBarBlurCommitOnce = false;
    if (!suppressCommit) {
      app.commitFormulaBarValue({ restoreFocus: false });
    }
    app.syncAIDraftLock();
    app.syncAIModeUI({ publish: false });
    app.hideMentionAutocompleteSoon();
  });
}
