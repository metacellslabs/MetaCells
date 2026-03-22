export function ensureWorkbookShellState(app) {
  if (!app.workbookShellState || typeof app.workbookShellState !== 'object') {
    app.workbookShellState = {
      tabs: [],
      visibleSheetId: '',
      lastNonReportSheetId: '',
      crossSheetPickContext: null,
    };
  }
  return app.workbookShellState;
}

export function syncWorkbookShellTabs(app, tabs) {
  var state = ensureWorkbookShellState(app);
  state.tabs = Array.isArray(tabs) ? tabs.slice() : [];
  app.tabs = state.tabs;
  return state.tabs;
}

export function getWorkbookShellTabs(app) {
  return ensureWorkbookShellState(app).tabs;
}

export function findWorkbookTabById(app, tabId) {
  var target = String(tabId || '');
  var tabs = getWorkbookShellTabs(app);
  for (var i = 0; i < tabs.length; i++) {
    if (tabs[i] && String(tabs[i].id || '') === target) return tabs[i];
  }
  return null;
}

export function isWorkbookReportTab(app, tabId) {
  var tab = findWorkbookTabById(app, tabId);
  if (!tab) return false;
  return tab.type === 'report' || String(tab.id || '') === 'report';
}

export function initializeWorkbookVisibleSheetId(app, options) {
  var opts = options || {};
  var tabs = getWorkbookShellTabs(app);
  var fallbackId =
    (tabs[0] && String(tabs[0].id || '')) || String(opts.defaultSheetId || '');
  var active = String(
    app.storage.getActiveSheetId(fallbackId) || fallbackId || '',
  );
  var initialSheetId = String(opts.initialSheetId || '');
  if (initialSheetId && findWorkbookTabById(app, initialSheetId)) {
    active = initialSheetId;
    app.storage.setActiveSheetId(active);
  }
  if (!findWorkbookTabById(app, active)) {
    active = fallbackId;
    if (active) app.storage.setActiveSheetId(active);
  }
  setWorkbookVisibleSheetId(app, active, {
    persist: false,
    notify: false,
  });
  return active;
}

export function setWorkbookVisibleSheetId(app, sheetId, options) {
  var target = String(sheetId || '');
  if (!target) return '';
  var state = ensureWorkbookShellState(app);
  if (!findWorkbookTabById(app, target)) return state.visibleSheetId || '';
  var opts = options || {};
  state.visibleSheetId = target;
  app.activeSheetId = target;
  if (!isWorkbookReportTab(app, target)) {
    state.lastNonReportSheetId = target;
  }
  if (opts.persist !== false) {
    app.storage.setActiveSheetId(target);
  }
  if (opts.notify !== false && typeof app.onActiveSheetChange === 'function') {
    app.onActiveSheetChange(target);
  }
  return target;
}

export function getWorkbookVisibleSheetId(app) {
  return String(ensureWorkbookShellState(app).visibleSheetId || '');
}

export function getWorkbookCrossSheetPickContext(app) {
  var state = ensureWorkbookShellState(app);
  return state.crossSheetPickContext || null;
}

export function setWorkbookCrossSheetPickContext(app, context) {
  var state = ensureWorkbookShellState(app);
  state.crossSheetPickContext =
    context && typeof context === 'object' ? { ...context } : null;
  return state.crossSheetPickContext;
}

export function clearWorkbookCrossSheetPickContext(app) {
  return setWorkbookCrossSheetPickContext(app, null);
}

export function getWorkbookEditingOwnerSheetId(app) {
  var crossSheetPickContext = getWorkbookCrossSheetPickContext(app);
  if (crossSheetPickContext && crossSheetPickContext.sourceSheetId) {
    return String(crossSheetPickContext.sourceSheetId || '');
  }
  if (
    app.editingSession &&
    typeof app.editingSession === 'object' &&
    app.editingSession.sheetId
  ) {
    return String(app.editingSession.sheetId || '');
  }
  return getWorkbookVisibleSheetId(app);
}
