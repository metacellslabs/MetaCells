import { getToolbarPickerOpenState, setToolbarPickerOpenState } from './toolbar-popover-runtime.js';

function getVisibleSheetId(app) {
  return typeof app.getVisibleSheetId === 'function'
    ? String(app.getVisibleSheetId() || '')
    : String(app.activeSheetId || '');
}

function closeNamedCellJumpPicker(app) {
  if (!app || !app.namedCellJumpPopover || !app.namedCellJump) return;
  setToolbarPickerOpenState(app, 'namedCellJump', false);
  if (!app.useReactShellControls) {
    app.namedCellJumpPopover.hidden = true;
    app.namedCellJump.setAttribute('aria-expanded', 'false');
  }
  if (app && typeof app.publishUiState === 'function') app.publishUiState();
}

function openNamedCellJumpPicker(app) {
  if (!app || !app.namedCellJumpPopover || !app.namedCellJump) return;
  if (app.namedCellJump.disabled) return;
  setToolbarPickerOpenState(app, 'namedCellJump', true);
  if (!app.useReactShellControls) {
    app.namedCellJumpPopover.hidden = false;
    app.namedCellJump.setAttribute('aria-expanded', 'true');
  }
  if (app && typeof app.publishUiState === 'function') app.publishUiState();
}

export function toggleNamedCellJumpPicker(app) {
  if (!app || !app.namedCellJumpPopover) return;
  if (getToolbarPickerOpenState(app, 'namedCellJump', app.namedCellJumpPopover)) {
    closeNamedCellJumpPicker(app);
  } else {
    openNamedCellJumpPicker(app);
  }
}

function ensureNamedCellJumpState(app) {
  if (!app) return null;
  if (!app.namedCellJumpState || typeof app.namedCellJumpState !== 'object') {
    app.namedCellJumpState = {
      filteredItems: [],
      activeIndex: -1,
    };
  }
  return app.namedCellJumpState;
}

function getNamedCellJumpItems(app) {
  if (!app || !app.storage) return [];
  var namedCells = app.storage.readNamedCells();
  var items = [];

  for (var key in namedCells) {
    if (!Object.prototype.hasOwnProperty.call(namedCells, key)) continue;
    var ref = namedCells[key];
    if (!ref || !ref.sheetId) continue;
    if (!ref.cellId && !(ref.startCellId && ref.endCellId)) continue;
    var tab = app.findTabById(ref.sheetId);
    if (!tab || app.isReportTab(ref.sheetId)) continue;
    items.push({
      name: key,
      sheetId: ref.sheetId,
      cellId: ref.cellId ? String(ref.cellId).toUpperCase() : '',
      startCellId: ref.startCellId ? String(ref.startCellId).toUpperCase() : '',
      endCellId: ref.endCellId ? String(ref.endCellId).toUpperCase() : '',
      sheetName: tab.name,
    });
  }

  items.sort((a, b) =>
    a.name.localeCompare(b.name, undefined, { sensitivity: 'base' }),
  );
  return items;
}

function filterNamedCellJumpItems(items, query) {
  var normalized = String(query == null ? '' : query)
    .trim()
    .replace(/^@/, '')
    .toLowerCase();
  if (!normalized) return items.slice();
  return items.filter(function (item) {
    return (
      String(item.name || '')
        .toLowerCase()
        .indexOf(normalized) !== -1
    );
  });
}

function renderNamedCellJumpOptions(app, items, hasQuery) {
  if (!app || !app.namedCellJumpPopover) return;
  var state = ensureNamedCellJumpState(app);
  if (state) {
    state.filteredItems = Array.isArray(items) ? items.slice() : [];
    if (!state.filteredItems.length) {
      state.activeIndex = -1;
    } else if (
      !Number.isInteger(state.activeIndex) ||
      state.activeIndex < 0 ||
      state.activeIndex >= state.filteredItems.length
    ) {
      state.activeIndex = 0;
    }
  }
  if (app && typeof app.publishUiState === 'function') app.publishUiState();
}

function syncNamedCellJumpActiveOption(app) {
  if (!app || !app.namedCellJumpPopover) return;
  var state = ensureNamedCellJumpState(app);
  var options = app.namedCellJumpPopover.querySelectorAll(
    '.named-cell-jump-option',
  );
  if (
    state.activeIndex >= 0 &&
    state.activeIndex < options.length &&
    typeof options[state.activeIndex].scrollIntoView === 'function'
  ) {
    options[state.activeIndex].scrollIntoView({ block: 'nearest' });
  }
  if (app && typeof app.publishUiState === 'function') app.publishUiState();
}

export function setNamedCellJumpActiveIndex(app, nextIndex) {
  var state = ensureNamedCellJumpState(app);
  var count = Array.isArray(state.filteredItems)
    ? state.filteredItems.length
    : 0;
  if (!count) {
    state.activeIndex = -1;
    syncNamedCellJumpActiveOption(app);
    return;
  }
  if (!Number.isInteger(nextIndex)) nextIndex = 0;
  if (nextIndex < 0) nextIndex = 0;
  if (nextIndex >= count) nextIndex = count - 1;
  state.activeIndex = nextIndex;
  syncNamedCellJumpActiveOption(app);
}

export function getNamedCellJumpUiState(app) {
  var state = ensureNamedCellJumpState(app);
  var filteredItems = Array.isArray(state.filteredItems)
    ? state.filteredItems.slice()
    : [];
  return {
    pickerOpen: getToolbarPickerOpenState(
      app,
      'namedCellJump',
      app && app.namedCellJumpPopover,
    ),
    activeIndex: Number.isInteger(state.activeIndex) ? state.activeIndex : -1,
    items: filteredItems,
    disabled: !!(app && app.namedCellJump && app.namedCellJump.disabled),
  };
}

function navigateToNamedCellJumpSelection(app, index) {
  var state = ensureNamedCellJumpState(app);
  if (
    !state ||
    !Array.isArray(state.filteredItems) ||
    index < 0 ||
    index >= state.filteredItems.length
  ) {
    return false;
  }
  app.navigateToNamedCell(state.filteredItems[index].name);
  closeNamedCellJumpPicker(app);
  return true;
}

function syncNamedCellJumpSearch(
  app,
  shouldOpen,
  preserveActiveIndex,
  queryOverride,
) {
  if (!app || !app.namedCellJumpPopover) return [];
  var state = ensureNamedCellJumpState(app);
  var allItems = getNamedCellJumpItems(app);
  var query =
    queryOverride != null
      ? String(queryOverride)
      : app.cellNameInput
        ? String(app.cellNameInput.value || '')
        : '';
  var filteredItems = filterNamedCellJumpItems(allItems, query);
  if (state && Array.isArray(state.filteredItems) && !preserveActiveIndex) {
    state.activeIndex = filteredItems.length ? 0 : -1;
  }
  renderNamedCellJumpOptions(app, filteredItems, !!String(query).trim());
  app.namedCellJump.disabled = allItems.length === 0;
  if (!allItems.length) {
    closeNamedCellJumpPicker(app);
  } else if (shouldOpen) {
    openNamedCellJumpPicker(app);
  }
  return filteredItems;
}

function tryNavigateFromCellNameInput(app) {
  if (!app || !app.cellNameInput) return false;
  var rawQuery = String(app.cellNameInput.value || '').trim();
  if (!rawQuery) return false;
  var state = ensureNamedCellJumpState(app);
  if (
    state &&
    state.activeIndex >= 0 &&
    navigateToNamedCellJumpSelection(app, state.activeIndex)
  ) {
    return true;
  }
  var normalizedName = rawQuery.replace(/^@/, '');
  var items = getNamedCellJumpItems(app);
  for (var i = 0; i < items.length; i++) {
    if (
      String(items[i].name || '').toLowerCase() === normalizedName.toLowerCase()
    ) {
      app.navigateToNamedCell(items[i].name);
      closeNamedCellJumpPicker(app);
      return true;
    }
  }
  var exactCellId = rawQuery.toUpperCase();
  if (
    app.parseCellId(exactCellId) &&
    (typeof app.getCellInput === 'function'
      ? app.getCellInput(exactCellId)
      : app.inputById && app.inputById[exactCellId])
  ) {
    var targetInput =
      typeof app.getCellInput === 'function'
        ? app.getCellInput(exactCellId)
        : app.inputById[exactCellId];
    app.setActiveInput(targetInput);
    targetInput.focus();
    closeNamedCellJumpPicker(app);
    return true;
  }
  var filteredItems = filterNamedCellJumpItems(items, rawQuery);
  if (filteredItems.length === 1) {
    app.navigateToNamedCell(filteredItems[0].name);
    closeNamedCellJumpPicker(app);
    return true;
  }
  return false;
}

export function setupCellNameControls(app) {
  app.cellNameInput.addEventListener('keydown', (e) => {
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault();
      var filteredItems = syncNamedCellJumpSearch(app, true, true);
      if (filteredItems.length) {
        var state = ensureNamedCellJumpState(app);
        var delta = e.key === 'ArrowDown' ? 1 : -1;
        var nextIndex =
          state.activeIndex >= 0
            ? state.activeIndex + delta
            : delta > 0
              ? 0
              : filteredItems.length - 1;
        setNamedCellJumpActiveIndex(app, nextIndex);
      }
      return;
    }
    if (e.key === 'Enter') {
      e.preventDefault();
      if (!tryNavigateFromCellNameInput(app)) {
        app.applyActiveCellName();
        closeNamedCellJumpPicker(app);
        app.focusActiveEditor();
      }
      return;
    }
    if (e.key === 'Escape') {
      closeNamedCellJumpPicker(app);
      app.focusActiveEditor();
      app.syncCellNameInput();
    }
  });
  app.cellNameInput.addEventListener('input', () => {
    if (app.isReportActive && app.isReportActive()) return;
    syncNamedCellJumpSearch(app, true);
  });
  app.cellNameInput.addEventListener('focus', () => {
    syncNamedCellJumpSearch(app, false);
  });
  if (app.namedCellJump) {
    app.namedCellJump.addEventListener('click', (event) => {
      if (app.useReactShellControls) return;
      if (app.namedCellJump.disabled) return;
      event.preventDefault();
      if (
        getToolbarPickerOpenState(app, 'namedCellJump', app.namedCellJumpPopover)
      ) {
        closeNamedCellJumpPicker(app);
      } else {
        syncNamedCellJumpSearch(app, false, false, '');
        openNamedCellJumpPicker(app);
      }
    });
    if (app.namedCellJumpPopover) {
      document.addEventListener('click', (event) => {
        if (app.namedCellJumpPopover.hidden) return;
        var target = event.target;
        if (app.namedCellJump === target) return;
        if (app.namedCellJump.contains && app.namedCellJump.contains(target)) {
          return;
        }
        if (
          app.namedCellJumpPopover.contains &&
          app.namedCellJumpPopover.contains(target)
        ) {
          return;
        }
        closeNamedCellJumpPicker(app);
      });
      document.addEventListener('keydown', (event) => {
        if (event.key === 'Escape') closeNamedCellJumpPicker(app);
      });
    }
    app.namedCellJump.addEventListener('keydown', (event) => {
      if (event.key === 'Enter' || event.key === ' ') {
        event.preventDefault();
        if (
          getToolbarPickerOpenState(app, 'namedCellJump', app.namedCellJumpPopover)
        ) {
          closeNamedCellJumpPicker(app);
        } else {
          syncNamedCellJumpSearch(app, false, false, '');
          openNamedCellJumpPicker(app);
        }
      }
    });
    app.refreshNamedCellJumpOptions();
  }
}

export function syncCellNameInput(app) {
  var activeCellId = String(app.activeCellId || '');
  if (!activeCellId) {
    app.cellNameInput.value = '';
    return;
  }
  if (
    typeof app.isEditorElementFocused === 'function' &&
    app.isEditorElementFocused(app.cellNameInput)
  )
    return;
  app.cellNameInput.value =
    app.storage.getCellNameFor(getVisibleSheetId(app), activeCellId) ||
    activeCellId;
  syncNamedCellJumpSearch(app, false);
}

export function refreshNamedCellJumpOptions(app) {
  if (!app.namedCellJump) return;
  syncNamedCellJumpSearch(
    app,
    !app.namedCellJumpPopover.hidden &&
      typeof app.isEditorElementFocused === 'function' &&
      app.isEditorElementFocused(app.cellNameInput),
  );
}

export function navigateToNamedCell(app, name) {
  var ref = app.storage.resolveNamedCell(name);
  if (!ref || !ref.sheetId) return;
  if (app.isReportTab(ref.sheetId)) return;

  var targetCellId = ref.cellId
    ? String(ref.cellId).toUpperCase()
    : ref.startCellId
      ? String(ref.startCellId).toUpperCase()
      : '';
  if (!targetCellId) return;
  if (getVisibleSheetId(app) !== ref.sheetId) {
    app.switchToSheet(ref.sheetId);
  }
  var targetInput =
    typeof app.getCellInput === 'function'
      ? app.getCellInput(targetCellId)
      : app.inputById[targetCellId];
  if (!targetInput) return;
  app.setActiveInput(targetInput);
  targetInput.focus();
}
