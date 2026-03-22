import {
  getMentionAutocompleteContext,
  getMentionAutocompleteItems,
} from './mention-runtime.js';

function updateMentionAutocompleteUiState(app, nextState) {
  if (!app) return;
  var prev =
    app.mentionAutocompleteUiState &&
    typeof app.mentionAutocompleteUiState === 'object'
      ? app.mentionAutocompleteUiState
      : null;
  var next =
    nextState && typeof nextState === 'object'
      ? {
          visible: nextState.visible === true,
          left: Number(nextState.left || 0),
          top: Number(nextState.top || 0),
          minWidth: Number(nextState.minWidth || 0),
          activeIndex: Number(nextState.activeIndex || 0),
          items: Array.isArray(nextState.items)
            ? nextState.items.map(function (item) {
                return item && typeof item === 'object' ? { ...item } : item;
              })
            : [],
        }
      : {
          visible: false,
          left: 0,
          top: 0,
          minWidth: 0,
          activeIndex: 0,
          items: [],
        };
  var changed =
    !prev ||
    prev.visible !== next.visible ||
    prev.left !== next.left ||
    prev.top !== next.top ||
    prev.minWidth !== next.minWidth ||
    prev.activeIndex !== next.activeIndex ||
    !sameMentionAutocompleteItems(prev.items, next.items);
  app.mentionAutocompleteUiState = next;
  if (changed && typeof app.publishUiState === 'function') {
    app.publishUiState();
  }
}

function sameMentionAutocompleteItems(prev, next) {
  if (prev === next) return true;
  if (!Array.isArray(prev) || !Array.isArray(next)) return false;
  if (prev.length !== next.length) return false;
  for (var i = 0; i < prev.length; i++) {
    var prevItem = prev[i];
    var nextItem = next[i];
    if (prevItem === nextItem) continue;
    if (!prevItem || !nextItem) return false;
    if (
      String(prevItem.token || '') !== String(nextItem.token || '') ||
      String(prevItem.label || '') !== String(nextItem.label || '') ||
      String(prevItem.kind || '') !== String(nextItem.kind || '')
    ) {
      return false;
    }
  }
  return true;
}

export function ensureMentionAutocomplete(app) {
  var el = document.querySelector('.mention-autocomplete');
  app.mentionAutocomplete = el || null;
  return el;
}

export function setupMentionAutocomplete(app) {
  ensureMentionAutocomplete(app);
  document.addEventListener('mousedown', (e) => {
    if (!app.mentionAutocompleteState) return;
    var target = e.target;
    if (!target) return;
    if (app.mentionAutocomplete && app.mentionAutocomplete.contains(target))
      return;
    if (target === app.formulaInput) return;
    if (target.tagName === 'INPUT') {
      hideMentionAutocompleteSoon(app);
      return;
    }
    hideMentionAutocomplete(app);
  });
  window.addEventListener('resize', () => hideMentionAutocomplete(app));
}

export function hideMentionAutocompleteSoon(app) {
  setTimeout(() => hideMentionAutocomplete(app), 120);
}

export function hideMentionAutocomplete(app) {
  if (
    !app.mentionAutocompleteState &&
    app.mentionAutocompleteUiState &&
    app.mentionAutocompleteUiState.visible !== true
  ) {
    return;
  }
  app.mentionAutocompleteState = null;
  updateMentionAutocompleteUiState(app, null);
}

export function renderMentionAutocompleteList(app) {
  if (!app.mentionAutocompleteState) return;
  updateMentionAutocompleteUiState(app, {
    visible: true,
    activeIndex: app.mentionAutocompleteState.activeIndex,
    items: app.mentionAutocompleteState.items,
    left:
      app.mentionAutocompleteUiState &&
      Number.isFinite(app.mentionAutocompleteUiState.left)
        ? app.mentionAutocompleteUiState.left
        : 0,
    top:
      app.mentionAutocompleteUiState &&
      Number.isFinite(app.mentionAutocompleteUiState.top)
        ? app.mentionAutocompleteUiState.top
        : 0,
    minWidth:
      app.mentionAutocompleteUiState &&
      Number.isFinite(app.mentionAutocompleteUiState.minWidth)
        ? app.mentionAutocompleteUiState.minWidth
        : 0,
  });
}

export function positionMentionAutocomplete(app, input) {
  var rect = input.getBoundingClientRect();
  var left = rect.left;
  var top = rect.bottom + 4;
  var maxWidth = Math.max(240, rect.width);
  updateMentionAutocompleteUiState(app, {
    visible: true,
    left: Math.round(left),
    top: Math.round(top),
    minWidth: Math.round(Math.min(maxWidth, 460)),
    activeIndex:
      app.mentionAutocompleteState &&
      Number.isFinite(app.mentionAutocompleteState.activeIndex)
        ? app.mentionAutocompleteState.activeIndex
        : 0,
    items:
      app.mentionAutocompleteState &&
      Array.isArray(app.mentionAutocompleteState.items)
        ? app.mentionAutocompleteState.items
        : [],
  });
}

export function updateMentionAutocomplete(app, input) {
  if (!input) return hideMentionAutocomplete(app);
  var ctx = getMentionAutocompleteContext(app, input);
  if (!ctx) return hideMentionAutocomplete(app);
  var items = getMentionAutocompleteItems(app, ctx.query, ctx.marker);
  if (!items.length) return hideMentionAutocomplete(app);

  var activeIndex = 0;
  if (
    app.mentionAutocompleteState &&
    app.mentionAutocompleteState.input === input
  ) {
    var prevToken =
      app.mentionAutocompleteState.items[
        app.mentionAutocompleteState.activeIndex
      ] &&
      app.mentionAutocompleteState.items[
        app.mentionAutocompleteState.activeIndex
      ].token;
    if (prevToken) {
      for (var i = 0; i < items.length; i++) {
        if (items[i].token === prevToken) {
          activeIndex = i;
          break;
        }
      }
    }
  }

  app.mentionAutocompleteState = {
    input: input,
    inputId: String(input.id || ''),
    marker: ctx.marker,
    start: ctx.start,
    end: ctx.end,
    items: items,
    activeIndex: activeIndex,
  };
  var rect = input.getBoundingClientRect();
  var left = rect.left;
  var top = rect.bottom + 4;
  var maxWidth = Math.max(240, rect.width);
  updateMentionAutocompleteUiState(app, {
    visible: true,
    left: Math.round(left),
    top: Math.round(top),
    minWidth: Math.round(Math.min(maxWidth, 460)),
    activeIndex: activeIndex,
    items: items,
  });
}

export function handleMentionAutocompleteKeydown(app, e, input) {
  if (
    !app.mentionAutocompleteState ||
    (app.mentionAutocompleteState.input !== input &&
      String(app.mentionAutocompleteState.inputId || '') !==
        String((input && input.id) || ''))
  ) {
    return false;
  }
  if (e.key === 'ArrowDown') {
    var downValue = String(input && input.value != null ? input.value : '');
    var downStart =
      input && typeof input.selectionStart === 'number'
        ? input.selectionStart
        : downValue.length;
    var downEnd =
      input && typeof input.selectionEnd === 'number'
        ? input.selectionEnd
        : downValue.length;
    e.preventDefault();
    var next = app.mentionAutocompleteState.activeIndex + 1;
    if (next >= app.mentionAutocompleteState.items.length) next = 0;
    app.mentionAutocompleteState.activeIndex = next;
    renderMentionAutocompleteList(app);
    restoreMentionEditorValue(input, downValue, downStart, downEnd);
    return true;
  }
  if (e.key === 'ArrowUp') {
    var upValue = String(input && input.value != null ? input.value : '');
    var upStart =
      input && typeof input.selectionStart === 'number'
        ? input.selectionStart
        : upValue.length;
    var upEnd =
      input && typeof input.selectionEnd === 'number'
        ? input.selectionEnd
        : upValue.length;
    e.preventDefault();
    var prev = app.mentionAutocompleteState.activeIndex - 1;
    if (prev < 0) prev = app.mentionAutocompleteState.items.length - 1;
    app.mentionAutocompleteState.activeIndex = prev;
    renderMentionAutocompleteList(app);
    restoreMentionEditorValue(input, upValue, upStart, upEnd);
    return true;
  }
  if (e.key === 'Enter' || e.key === 'Tab') {
    e.preventDefault();
    applyMentionAutocompleteSelection(app, app.mentionAutocompleteState.activeIndex);
    return true;
  }
  if (e.key === 'Escape') {
    e.preventDefault();
    hideMentionAutocomplete(app);
    return true;
  }
  return false;
}

function restoreMentionEditorValue(input, value, start, end) {
  if (!input) return;
  if (String(input.value || '') !== String(value || '')) {
    input.value = String(value || '');
  }
  if (typeof input.setSelectionRange === 'function') {
    input.setSelectionRange(start, end);
  }
}

export function applyMentionAutocompleteSelection(app, index) {
  if (!app.mentionAutocompleteState) return;
  var state = app.mentionAutocompleteState;
  var input = state.input;
  var item = state.items[index];
  if (!input || !item) return hideMentionAutocomplete(app);

  var value = String(input.value == null ? '' : input.value);
  var next = value.slice(0, state.start) + item.token + value.slice(state.end);
  input.value = next;
  var caret = state.start + item.token.length;
  if (app && typeof app.setEditorSelectionRange === 'function') {
    app.setEditorSelectionRange(caret, caret, input);
  } else if (typeof input.setSelectionRange === 'function') {
    input.setSelectionRange(caret, caret);
  }
  input.focus();

  if (input === app.formulaInput) {
    if (app.activeInput) {
      app.syncActiveEditorValue(next, { syncOverlay: false });
      app.setRawCellValue(app.activeInput.id, next);
    }
  } else if (input === app.editorOverlayInput) {
    if (app.activeInput) {
      app.syncActiveEditorValue(next);
    }
  } else if (app.activeInput === input) {
    app.syncActiveEditorValue(next, { syncOverlay: false });
  }

  hideMentionAutocomplete(app);
}

export function setAvailableChannels(app, channels) {
  app.availableChannels = Array.isArray(channels)
    ? channels
        .map(function (channel) {
          return channel && typeof channel === 'object'
            ? {
                id: String(channel.id || ''),
                label: String(channel.label || '').trim(),
              }
            : null;
        })
        .filter(function (channel) {
          return !!(channel && channel.label);
        })
    : [];
  if (typeof app.syncChannelBindingControl === 'function') {
    app.syncChannelBindingControl();
  }
  if (app.mentionAutocompleteState && app.mentionAutocompleteState.input) {
    updateMentionAutocomplete(app, app.mentionAutocompleteState.input);
  }
}
