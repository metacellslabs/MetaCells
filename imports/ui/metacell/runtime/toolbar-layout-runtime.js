export function syncToolbarOffset(app) {
  if (
    typeof document === 'undefined' ||
    !document.documentElement ||
    !app.formulaBar ||
    !app.formulaBar.getBoundingClientRect
  ) {
    return;
  }
  var rect = app.formulaBar.getBoundingClientRect();
  var nextOffset = Math.max(124, Math.ceil(rect.bottom + 12));
  document.documentElement.style.setProperty(
    '--toolbar-offset',
    nextOffset + 'px',
  );
}

export function setupToolbarOffsetSync(app) {
  syncToolbarOffset(app);
  if (!app.formulaBar || app.handleToolbarOffsetSync) return;
  app.handleToolbarOffsetSync = () => {
    syncToolbarOffset(app);
  };
  window.addEventListener('resize', app.handleToolbarOffsetSync);
  if (typeof ResizeObserver === 'function') {
    app.formulaBarResizeObserver = new ResizeObserver(() => {
      syncToolbarOffset(app);
    });
    app.formulaBarResizeObserver.observe(app.formulaBar);
  }
}

export function cleanupToolbarOffsetSync(app) {
  if (app.handleToolbarOffsetSync) {
    window.removeEventListener('resize', app.handleToolbarOffsetSync);
    app.handleToolbarOffsetSync = null;
  }
  if (app.formulaBarResizeObserver) {
    app.formulaBarResizeObserver.disconnect();
    app.formulaBarResizeObserver = null;
  }
}
