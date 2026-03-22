import {
  ensureAddTabMenu,
  ensureContextMenu,
  getAddTabMenuUiState,
  getContextMenuUiState,
  hideAddTabMenu,
  hideContextMenu,
  openContextMenu,
  prepareContextFromCell,
  setupContextMenu,
  toggleAddTabMenu,
} from './keyboard-menu-runtime.js';
import { bindGridInputEvents as bindGridInputEventsRuntime } from './keyboard-grid-runtime.js';
import {
  handleWorkbookGlobalClick,
  handleWorkbookGlobalKeydown,
} from './keyboard-shortcuts-runtime.js';

export {
  ensureAddTabMenu,
  ensureContextMenu,
  getAddTabMenuUiState,
  getContextMenuUiState,
  hideAddTabMenu,
  hideContextMenu,
  openContextMenu,
  prepareContextFromCell,
  setupContextMenu,
  toggleAddTabMenu,
} from './keyboard-menu-runtime.js';

export function setupButtons(app) {
  app.addTabButton.addEventListener('click', (e) => {
    e.preventDefault();
    e.stopPropagation();
    app.toggleAddTabMenu();
  });
  app.deleteTabButton.addEventListener('click', () => app.deleteActiveTab());
  if (app.undoButton)
    app.undoButton.addEventListener('click', () => app.undo());
  if (app.redoButton)
    app.redoButton.addEventListener('click', () => app.redo());
  if (app.assistantChatButton)
    app.assistantChatButton.addEventListener('click', () =>
      app.toggleAssistantPanel(),
    );
  if (app.formulaTrackerButton)
    app.formulaTrackerButton.addEventListener('click', () =>
      app.toggleFormulaTrackerPanel(),
    );

  document.addEventListener('click', (e) => handleWorkbookGlobalClick(app, e));
  document.addEventListener('keydown', (e) => {
    handleWorkbookGlobalKeydown(app, e);
  });
  window.addEventListener('resize', () => app.hideAddTabMenu());
}

export function bindGridInputEvents(app) {
  return bindGridInputEventsRuntime(app);
}
