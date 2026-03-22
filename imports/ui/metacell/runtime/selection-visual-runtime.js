function getActiveCellId(app) {
  return typeof app.getSelectionActiveCellId === 'function'
    ? app.getSelectionActiveCellId()
    : String(app.activeCellId || '').toUpperCase();
}

export function clearHeaderSelectionHighlight(app) {
  return;
}

export function clearSpillSelectionHighlight(app) {
  return;
}

export function clearSelectionVisualState(app) {
  if (!app) return;
  var iterate =
    typeof app.forEachInput === 'function'
      ? app.forEachInput.bind(app)
      : function (callback) {
          (app.inputs || []).forEach(callback);
        };
  iterate((input) => {
    if (!input || !input.parentElement) return;
    input.parentElement.classList.remove('selected-range');
  }, { includeDetached: false });
  clearHeaderSelectionHighlight(app);
}

export function clearSelectionHighlight(app) {
  clearSelectionVisualState(app);
}

export function applyActiveCellVisualState(app) {
  return;
}

export function applySelectionRangeVisualState(app) {
  return;
}

export function highlightSelectionRange(app) {
  clearSelectionVisualState(app);
  applySelectionRangeVisualState(app);
  applySpillSelectionHighlight(app);
  updateAxisHeaderHighlight(app);
}

export function updateAxisHeaderHighlight(app) {
  return;
}

export function applySpillSelectionHighlight(app) {
  return;
}
