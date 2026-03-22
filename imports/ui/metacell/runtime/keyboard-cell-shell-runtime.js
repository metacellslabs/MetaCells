function resolveCellInputFromEventTarget(target) {
  var cell = target && target.closest ? target.closest('td') : null;
  if (!cell) return null;
  return cell.querySelector('.cell-anchor-input');
}

function handleCellShellClick(app, input, e) {
  if (app.selectionDragJustFinished) {
    app.selectionDragJustFinished = false;
    return;
  }
  if (e.target === input) return;
  if (e.target.closest && e.target.closest('.fill-handle')) return;
  if (e.target.closest && e.target.closest('.cell-actions')) return;
  var output = e.target.closest && e.target.closest('.cell-output');
  if (output) {
    var canScroll =
      output.scrollHeight > output.clientHeight ||
      output.scrollWidth > output.clientWidth;
    if (canScroll) return;
  }
  var targetInput = input;
  app.setActiveInput(targetInput);
  if (e.shiftKey) {
    var rangeAnchor =
      (typeof app.getSelectionAnchorCellId === 'function'
        ? app.getSelectionAnchorCellId()
        : app.selectionAnchorId) || targetInput.id;
    app.setSelectionRange(rangeAnchor, targetInput.id);
  } else {
    app.setSelectionAnchor(targetInput.id);
    app.clearSelectionRange();
  }
  if (typeof app.focusCellProxy === 'function') {
    app.focusCellProxy(targetInput);
  }
}

function handleCellShellDoubleClick(app, input, e) {
  if (e.target.closest && e.target.closest('.fill-handle')) return;
  if (e.target.closest && e.target.closest('.cell-actions')) return;
  var targetInput = input;
  app.setActiveInput(targetInput);
  app.startEditingCell(targetInput);
}

function handleCellShellMouseDown(app, input, e) {
  if (e.button !== 0) return;
  if (e.target.closest && e.target.closest('.fill-handle')) return;
  if (e.target.closest && e.target.closest('.cell-actions')) return;
  app.startSelectionDrag(input, e);
}

function handleCellActionClick(app, input, e) {
  var btn = e.target.closest && e.target.closest('.cell-action');
  if (!btn) return;
  e.preventDefault();
  e.stopPropagation();
  var action = btn.dataset.action;
  if (action === 'copy') app.copyCellValue(input);
  if (action === 'fullscreen') app.openFullscreenCell(input);
  if (action === 'run') app.runFormulaForCell(input);
}

function handleCellFillHandleMouseDown(app, input, e) {
  e.preventDefault();
  e.stopPropagation();
  app.startFillDrag(input, e);
}

export function bindCellShellEvents(app, input) {
  if (!input || !input.parentElement || input.parentElement.dataset.shellBound === 'true') {
    return;
  }
  input.parentElement.dataset.shellBound = 'true';
  input.parentElement.addEventListener('click', (e) => {
    handleCellShellClick(app, input, e);
  });

  input.parentElement.addEventListener('dblclick', (e) => {
    handleCellShellDoubleClick(app, input, e);
  });

  input.parentElement.addEventListener('mousedown', (e) => {
    handleCellShellMouseDown(app, input, e);
  });
}

export function bindCellActionEvents(app, input) {
  var actions = input.parentElement.querySelector('.cell-actions');
  if (!actions || actions.dataset.bound === 'true') return;
  actions.dataset.bound = 'true';
  actions.addEventListener('click', (e) => {
    handleCellActionClick(app, input, e);
  });
}

export function bindCellFillHandleEvents(app, input) {
  var fillHandle = input.parentElement.querySelector('.fill-handle');
  if (!fillHandle || fillHandle.dataset.bound === 'true') return;
  fillHandle.dataset.bound = 'true';
  fillHandle.addEventListener('mousedown', (e) => {
    handleCellFillHandleMouseDown(app, input, e);
  });
}

export function bindDelegatedCellShellEvents(app) {
  if (!app || !app.table || app.table.dataset.delegatedShellBound === 'true') {
    return;
  }
  app.table.dataset.delegatedShellBound = 'true';

  app.table.addEventListener('click', (e) => {
    var input = resolveCellInputFromEventTarget(e.target);
    if (!input) return;
    if (e.target.closest && e.target.closest('.cell-action')) {
      handleCellActionClick(app, input, e);
      return;
    }
    handleCellShellClick(app, input, e);
  });

  app.table.addEventListener('dblclick', (e) => {
    var input = resolveCellInputFromEventTarget(e.target);
    if (!input) return;
    handleCellShellDoubleClick(app, input, e);
  });

  app.table.addEventListener('mousedown', (e) => {
    var input = resolveCellInputFromEventTarget(e.target);
    if (!input) return;
    if (e.target.closest && e.target.closest('.fill-handle')) {
      handleCellFillHandleMouseDown(app, input, e);
      return;
    }
    handleCellShellMouseDown(app, input, e);
  });
}
