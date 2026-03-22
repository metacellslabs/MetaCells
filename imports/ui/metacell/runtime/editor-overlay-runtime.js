import { syncOverlayInputSelection } from './editor-selection-runtime.js';

function getRelativeCellRect(container, element) {
  if (!container || !element) return null;
  var containerRect = container.getBoundingClientRect();
  var elementRect = element.getBoundingClientRect();
  return {
    left: elementRect.left - containerRect.left + container.scrollLeft,
    top: elementRect.top - containerRect.top + container.scrollTop,
    width: elementRect.width,
    height: elementRect.height,
  };
}

function getViewportCellRect(element) {
  if (!element) return null;
  var rect = element.getBoundingClientRect();
  return {
    left: rect.left,
    top: rect.top,
    width: rect.width,
    height: rect.height,
  };
}

function updateEditorOverlayUiState(app, nextState) {
  if (!app) return;
  var next =
    nextState && typeof nextState === 'object'
      ? {
          visible: nextState.visible === true,
          cellId: String(nextState.cellId || ''),
          left: Number(nextState.left || 0),
          top: Number(nextState.top || 0),
          width: Number(nextState.width || 0),
          height: Number(nextState.height || 0),
          inputLeft: Number(nextState.inputLeft || 0),
          inputTop: Number(nextState.inputTop || 0),
          inputWidth: Number(nextState.inputWidth || 0),
          inputHeight: Number(nextState.inputHeight || 0),
        }
      : {
          visible: false,
          cellId: '',
          left: 0,
          top: 0,
          width: 0,
          height: 0,
          inputLeft: 0,
          inputTop: 0,
          inputWidth: 0,
          inputHeight: 0,
        };
  var prev = app.editorOverlayUiState;
  var changed =
    !prev ||
    prev.visible !== next.visible ||
    prev.cellId !== next.cellId ||
    prev.left !== next.left ||
    prev.top !== next.top ||
    prev.width !== next.width ||
    prev.height !== next.height ||
    prev.inputLeft !== next.inputLeft ||
    prev.inputTop !== next.inputTop ||
    prev.inputWidth !== next.inputWidth ||
    prev.inputHeight !== next.inputHeight;
  if (!changed) return;
  app.editorOverlayUiState = next;
  if (typeof app.publishUiState === 'function') {
    app.publishUiState();
  }
}

function setSourceOverlayEditingState(app, active) {
  if (!app || !app.activeInput) return;
  app.activeInput.classList.toggle('overlay-source-editing', !!active);
}

export function focusEditorOverlayInput(app) {
  if (!app || !app.editorOverlayInput || !app.activeInput) return;
  if (
    !app.editorOverlayUiState ||
    app.editorOverlayUiState.visible !== true ||
    !app.isEditingCell(app.activeInput)
  ) {
    return;
  }
  app.editorOverlayPendingFocus = false;
  app.editorOverlayInput.focus();
  syncOverlayInputSelection(app, app.activeInput);
}

export function syncEditorOverlay(app) {
  if (!app || !app.editorOverlay || !app.tableWrap) return;
  if (
    !app.activeInput ||
    !app.activeInput.parentElement ||
    !app.isEditingCell(app.activeInput) ||
    (app.isReportActive && app.isReportActive())
  ) {
    setSourceOverlayEditingState(app, false);
    hideEditorOverlay(app);
    return;
  }

  var td = app.activeInput.parentElement;
  var relativeRect = getRelativeCellRect(app.tableWrap, td);
  var viewportRect = getViewportCellRect(td);
  if (!relativeRect || !viewportRect) {
    setSourceOverlayEditingState(app, false);
    hideEditorOverlay(app);
    return;
  }

  updateEditorOverlayUiState(app, {
    visible: true,
    cellId: String(app.activeInput.id || ''),
    left: Math.round(relativeRect.left),
    top: Math.round(relativeRect.top),
    width: Math.max(0, Math.round(relativeRect.width)),
    height: Math.max(0, Math.round(relativeRect.height)),
    inputLeft: Math.round(viewportRect.left),
    inputTop: Math.round(viewportRect.top),
    inputWidth: Math.max(0, Math.round(viewportRect.width)),
    inputHeight: Math.max(0, Math.round(viewportRect.height)),
  });
  setSourceOverlayEditingState(app, true);
  if (app.editorOverlayInput && app.editorOverlayPendingFocus) {
    focusEditorOverlayInput(app);
  }
}

export function hideEditorOverlay(app) {
  if (!app || !app.editorOverlay) return;
  setSourceOverlayEditingState(app, false);
  app.editorOverlayPendingFocus = false;
  updateEditorOverlayUiState(app, null);
}

export function setupEditorOverlay(app) {
  if (!app || !app.tableWrap || app.editorOverlay) return;
  if (getComputedStyle(app.tableWrap).position === 'static') {
    app.tableWrap.style.position = 'relative';
  }

  var overlay = app.tableWrap.querySelector('.cell-editor-overlay');
  if (!overlay) return;
  var overlayInput = overlay.querySelector('.cell-editor-overlay-input');
  if (!overlayInput) return;
  app.editorOverlay = overlay;
  app.editorOverlayInput = overlayInput;
  app.editorOverlayPendingFocus = false;
  updateEditorOverlayUiState(app, null);

  var sync = () => syncEditorOverlay(app);
  app.handleEditorOverlayViewportSync = sync;
  app.tableWrap.addEventListener('scroll', sync, { passive: true });
  window.addEventListener('resize', sync);
}
