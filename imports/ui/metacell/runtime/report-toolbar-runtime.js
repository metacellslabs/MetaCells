function isSelectionInsideReportEditor(app) {
  if (!app || !app.reportEditor || typeof window === 'undefined') return false;
  var selection =
    typeof window.getSelection === 'function' ? window.getSelection() : null;
  if (!selection || selection.rangeCount < 1) return false;
  var anchorNode = selection.anchorNode || null;
  if (!anchorNode) return false;
  return app.reportEditor === anchorNode || app.reportEditor.contains(anchorNode);
}

function readCommandState(command) {
  try {
    if (typeof document.queryCommandState !== 'function') return false;
    return document.queryCommandState(command) === true;
  } catch (error) {
    return false;
  }
}

export function getReportToolbarUiState(app) {
  var selectionInside = isSelectionInsideReportEditor(app);
  var commandsDisabled = !app || app.reportMode !== 'edit';
  var canExecCommand = !commandsDisabled && selectionInside;
  return {
    selectionInside: selectionInside,
    canExecCommand: canExecCommand,
    commands: {
      bold: canExecCommand ? readCommandState('bold') : false,
      italic:
        canExecCommand ? readCommandState('italic') : false,
      underline:
        canExecCommand ? readCommandState('underline') : false,
      insertUnorderedList:
        canExecCommand ? readCommandState('insertUnorderedList') : false,
    },
  };
}

export function runReportToolbarCommand(app, cmd) {
  if (!app || !app.reportEditor || !cmd || app.reportMode !== 'edit') return;
  app.reportEditor.focus();
  app.captureHistorySnapshot('report:' + app.activeSheetId);
  document.execCommand(cmd, false);
  if (app.isReportActive()) {
    app.storage.setReportContent(app.activeSheetId, app.reportEditor.innerHTML);
  }
  app.renderReportLiveValues();
  if (typeof app.publishUiState === 'function') {
    app.publishUiState();
  }
}

export function setupReportToolbarCommands(app) {
  if (!app || !app.reportWrap || app.reportToolbarCommandsBound) return;
  app.reportToolbarCommandsBound = true;
  var cmdButtons = app.reportWrap.querySelectorAll('.report-cmd');
  cmdButtons.forEach((btn) => {
    btn.addEventListener('click', () => {
      runReportToolbarCommand(app, btn.dataset.cmd);
    });
  });
  if (app.reportEditor) {
    var syncToolbarUi = function () {
      if (typeof app.publishUiState === 'function') {
        app.publishUiState();
      }
    };
    app.reportEditor.addEventListener('keyup', syncToolbarUi);
    app.reportEditor.addEventListener('mouseup', syncToolbarUi);
    app.reportEditor.addEventListener('focus', syncToolbarUi);
    app.reportEditor.addEventListener('blur', syncToolbarUi);
    document.addEventListener('selectionchange', syncToolbarUi);
  }
}
