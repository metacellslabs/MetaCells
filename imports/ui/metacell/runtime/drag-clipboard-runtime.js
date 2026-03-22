function getSelectionRangeState(app) {
  return typeof app.getSelectionRange === 'function'
    ? app.getSelectionRange()
    : app.selectionRange;
}

function getActiveCellId(app) {
  return typeof app.getSelectionActiveCellId === 'function'
    ? app.getSelectionActiveCellId()
    : String(app.activeCellId || '').toUpperCase();
}

function resolveSpillSourceInput(app, input) {
  if (!app || !input) return input;
  if (typeof app.getSpillSourceForCell !== 'function') return input;
  var sourceCellId = app.getSpillSourceForCell(app.activeSheetId, input.id);
  if (!sourceCellId || sourceCellId === String(input.id || '').toUpperCase()) {
    return input;
  }
  return (typeof app.getCellInput === 'function'
    ? app.getCellInput(sourceCellId)
    : app.inputById && app.inputById[sourceCellId]) || input;
}

export function getSelectionStartCellId(app) {
  var selectionRange = getSelectionRangeState(app);
  if (selectionRange) {
    return app.formatCellId(
      selectionRange.startCol,
      selectionRange.startRow,
    );
  }
  return getActiveCellId(app) || (app.activeInput ? app.activeInput.id : null);
}

export function getSelectedCellIds(app) {
  var selectionRange = getSelectionRangeState(app);
  var activeCellId = getActiveCellId(app);
  if (!selectionRange) {
    return activeCellId
      ? [activeCellId]
      : app.activeInput
        ? [app.activeInput.id]
        : [];
  }
  var ids = [];
  for (var row = selectionRange.startRow; row <= selectionRange.endRow; row++) {
    for (var col = selectionRange.startCol; col <= selectionRange.endCol; col++) {
      ids.push(app.formatCellId(col, row));
    }
  }
  return ids;
}

export function copySelectedRangeToClipboard(app) {
  var text = getSelectedRangeText(app);
  if (!text) return;
  var focusedElement = document.activeElement;
  if (navigator.clipboard && navigator.clipboard.writeText) {
    navigator.clipboard.writeText(text).catch(() => {
      copyTextFallback(app, text, focusedElement);
    });
    return;
  }
  copyTextFallback(app, text, focusedElement);
}

function getVisibleSheetId(app) {
  return typeof app.getVisibleSheetId === 'function'
    ? String(app.getVisibleSheetId() || '')
    : String(app.activeSheetId || '');
}

function getNamedCellNamesForCell(app, sheetId, cellId) {
  if (!app || !app.storage || typeof app.storage.readNamedCells !== 'function') {
    return [];
  }
  var namedCells = app.storage.readNamedCells();
  var targetSheetId = String(sheetId || '');
  var targetCellId = String(cellId || '').toUpperCase();
  var names = [];
  for (var name in namedCells) {
    if (!Object.prototype.hasOwnProperty.call(namedCells, name)) continue;
    var ref = namedCells[name];
    if (!ref) continue;
    if (String(ref.sheetId || '') !== targetSheetId) continue;
    if (String(ref.cellId || '').toUpperCase() !== targetCellId) continue;
    names.push(String(name));
  }
  names.sort();
  return names;
}

function getMentionRefsForRaw(app, raw) {
  var text = String(raw == null ? '' : raw);
  if (
    !app ||
    !app.formulaEngine ||
    typeof app.formulaEngine.collectExplicitMentionTokens !== 'function'
  ) {
    return [];
  }
  try {
    var tokens = app.formulaEngine.collectExplicitMentionTokens(text);
    return (Array.isArray(tokens) ? tokens : [])
      .map(function (item) {
        return String(
          (item && (item.displayToken || item.token || item.cellId || item.sheetName)) ||
            '',
        ).trim();
      })
      .filter(Boolean);
  } catch (error) {
    return [];
  }
}

function getMentionTokensForRaw(app, raw) {
  var text = String(raw == null ? '' : raw);
  if (
    !app ||
    !app.formulaEngine ||
    typeof app.formulaEngine.collectExplicitMentionTokens !== 'function'
  ) {
    return [];
  }
  try {
    var tokens = app.formulaEngine.collectExplicitMentionTokens(text);
    return Array.isArray(tokens) ? tokens : [];
  } catch (error) {
    return [];
  }
}

function enumerateRegionCellIds(app, startCellId, endCellId) {
  if (
    !app ||
    !app.formulaEngine ||
    typeof app.formulaEngine.enumerateRegionCellIds !== 'function'
  ) {
    return [];
  }
  try {
    var ids = app.formulaEngine.enumerateRegionCellIds(startCellId, endCellId);
    return Array.isArray(ids) ? ids : [];
  } catch (error) {
    return [];
  }
}

function findSheetIdByMentionName(app, sheetName) {
  if (app && typeof app.findSheetIdByName === 'function') {
    return String(app.findSheetIdByName(sheetName) || '');
  }
  if (
    app &&
    app.formulaEngine &&
    typeof app.formulaEngine.findSheetIdByName === 'function'
  ) {
    return String(app.formulaEngine.findSheetIdByName(sheetName) || '');
  }
  return '';
}

function resolveNamedRefForDebug(app, token) {
  if (
    !app ||
    !app.storage ||
    typeof app.storage.resolveNamedCell !== 'function' ||
    !token
  ) {
    return null;
  }
  try {
    return app.storage.resolveNamedCell(token) || null;
  } catch (error) {
    return null;
  }
}

function resolveMentionTokenSourceKeys(app, currentSheetId, mention) {
  var token = mention && typeof mention === 'object' ? mention : null;
  var sheetId = String(currentSheetId || '');
  if (!token) return [];

  if (token.kind === 'sheet-cell') {
    var refSheetId = findSheetIdByMentionName(app, token.sheetName);
    return refSheetId && token.cellId
      ? [refSheetId + ':' + String(token.cellId || '').toUpperCase()]
      : [];
  }

  if (token.kind === 'cell') {
    return token.cellId ? [sheetId + ':' + String(token.cellId || '').toUpperCase()] : [];
  }

  if (token.kind === 'sheet-region') {
    var rangeSheetId = findSheetIdByMentionName(app, token.sheetName);
    var rangeIds =
      rangeSheetId && token.startCellId && token.endCellId
        ? enumerateRegionCellIds(app, token.startCellId, token.endCellId)
        : [];
    return rangeIds.map(function (cellId) {
      return rangeSheetId + ':' + String(cellId || '').toUpperCase();
    });
  }

  if (token.kind === 'region') {
    var regionIds =
      token.startCellId && token.endCellId
        ? enumerateRegionCellIds(app, token.startCellId, token.endCellId)
        : [];
    return regionIds.map(function (cellId) {
      return sheetId + ':' + String(cellId || '').toUpperCase();
    });
  }

  if (token.kind === 'plain') {
    if (
      app &&
      app.formulaEngine &&
      typeof app.formulaEngine.isExistingCellId === 'function' &&
      app.formulaEngine.isExistingCellId(token.token)
    ) {
      return [sheetId + ':' + String(token.token || '').toUpperCase()];
    }
    var named = resolveNamedRefForDebug(app, token.token);
    if (!named || !named.sheetId) return [];
    if (named.startCellId && named.endCellId) {
      return enumerateRegionCellIds(app, named.startCellId, named.endCellId).map(
        function (cellId) {
          return String(named.sheetId || '') + ':' + String(cellId || '').toUpperCase();
        },
      );
    }
    return named.cellId
      ? [String(named.sheetId || '') + ':' + String(named.cellId || '').toUpperCase()]
      : [];
  }

  return [];
}

function addDebugSourceKey(results, seen, sourceKey) {
  var normalized = String(sourceKey || '');
  if (!normalized || seen[normalized]) return;
  seen[normalized] = true;
  results.push(normalized);
}

function collectStandardRefSourceKeys(app, currentSheetId, raw) {
  var text = String(raw == null ? '' : raw);
  var sheetId = String(currentSheetId || '');
  var results = [];
  var seen = Object.create(null);
  if (!text || text.charAt(0) !== '=') return results;

  text.replace(
    /(?:'([^']+)'|([A-Za-z][A-Za-z0-9 _-]*))!([A-Za-z]+[0-9]+):([A-Za-z]+[0-9]+)/g,
    function (_, quoted, plain, startCellId, endCellId) {
      var refSheetId = findSheetIdByMentionName(app, quoted || plain || '');
      var ids = refSheetId
        ? enumerateRegionCellIds(app, startCellId, endCellId)
        : [];
      for (var i = 0; i < ids.length; i++) {
        addDebugSourceKey(
          results,
          seen,
          refSheetId + ':' + String(ids[i] || '').toUpperCase(),
        );
      }
      return _;
    },
  );

  text.replace(/([A-Za-z]+[0-9]+):([A-Za-z]+[0-9]+)/g, function (_, startCellId, endCellId) {
    var ids = enumerateRegionCellIds(app, startCellId, endCellId);
    for (var i = 0; i < ids.length; i++) {
      addDebugSourceKey(
        results,
        seen,
        sheetId + ':' + String(ids[i] || '').toUpperCase(),
      );
    }
    return _;
  });

  text.replace(
    /(?:'([^']+)'|([A-Za-z][A-Za-z0-9 _-]*))!([A-Za-z]+[0-9]+)/g,
    function (_, quoted, plain, cellId) {
      var refSheetId = findSheetIdByMentionName(app, quoted || plain || '');
      if (refSheetId) {
        addDebugSourceKey(
          results,
          seen,
          refSheetId + ':' + String(cellId || '').toUpperCase(),
        );
      }
      return _;
    },
  );

  text.replace(/\b([A-Za-z]+[0-9]+)\b/g, function (_, cellId) {
    addDebugSourceKey(
      results,
      seen,
      sheetId + ':' + String(cellId || '').toUpperCase(),
    );
    return _;
  });

  return results;
}

function parseDependencySourceKeyForDebug(sourceKey) {
  var normalized = String(sourceKey || '');
  var separatorIndex = normalized.indexOf(':');
  if (separatorIndex === -1) return null;
  return {
    sheetId: normalized.slice(0, separatorIndex),
    cellId: normalized.slice(separatorIndex + 1).toUpperCase(),
  };
}

function formatDebugAddress(currentSheetId, sheetId, cellId) {
  var normalizedSheetId = String(sheetId || '');
  var normalizedCellId = String(cellId || '').toUpperCase();
  if (!normalizedSheetId || normalizedSheetId === String(currentSheetId || '')) {
    return normalizedCellId;
  }
  return normalizedSheetId + '!' + normalizedCellId;
}

function buildDebugEntryLine(app, currentSheetId, sheetId, cellId) {
  var normalizedCellId = String(cellId || '').toUpperCase();
  var raw = String(app.storage.getCellValue(sheetId, normalizedCellId) || '');
  var display = String(app.storage.getCellDisplayValue(sheetId, normalizedCellId) || '');
  var computed = String(app.storage.getCellComputedValue(sheetId, normalizedCellId) || '');
  var names = getNamedCellNamesForCell(app, sheetId, normalizedCellId);
  var mentionRefs = getMentionRefsForRaw(app, raw);
  return [
    'address=' + formatDebugAddress(currentSheetId, sheetId, normalizedCellId),
    'name=' + (names.length ? names.join(',') : ''),
    'formula=' + JSON.stringify(raw),
    'displayValue=' + JSON.stringify(display),
    'value=' + JSON.stringify(display || computed),
    'computedValue=' + JSON.stringify(computed),
    'mentionRefs=' + JSON.stringify(mentionRefs),
  ].join('\t');
}

export function getSelectedRangeDebugText(app) {
  var ids = getSelectedCellIds(app);
  if (!ids.length) return '';
  var sheetId = getVisibleSheetId(app);
  var queue = ids.map(function (cellId) {
    return String(sheetId || '') + ':' + String(cellId || '').toUpperCase();
  });
  var seen = Object.create(null);
  var lines = [];

  while (queue.length) {
    var sourceKey = String(queue.shift() || '');
    if (!sourceKey || seen[sourceKey]) continue;
    seen[sourceKey] = true;
    var parsed = parseDependencySourceKeyForDebug(sourceKey);
    if (!parsed || !parsed.sheetId || !parsed.cellId) continue;
    lines.push(
      buildDebugEntryLine(app, sheetId, parsed.sheetId, parsed.cellId),
    );
    var raw = String(app.storage.getCellValue(parsed.sheetId, parsed.cellId) || '');
    var tokens = getMentionTokensForRaw(app, raw);
    for (var i = 0; i < tokens.length; i++) {
      var sourceKeys = resolveMentionTokenSourceKeys(
        app,
        parsed.sheetId,
        tokens[i],
      );
      for (var j = 0; j < sourceKeys.length; j++) {
        var nextKey = String(sourceKeys[j] || '');
        if (!nextKey || seen[nextKey]) continue;
        queue.push(nextKey);
      }
    }
    var standardRefs = collectStandardRefSourceKeys(app, parsed.sheetId, raw);
    for (var k = 0; k < standardRefs.length; k++) {
      var refKey = String(standardRefs[k] || '');
      if (!refKey || seen[refKey]) continue;
      queue.push(refKey);
    }
  }
  return lines.join('\n');
}

export function copySelectedRangeDebugToClipboard(app) {
  var text = getSelectedRangeDebugText(app);
  if (!text) return;
  var focusedElement = document.activeElement;
  if (navigator.clipboard && navigator.clipboard.writeText) {
    navigator.clipboard.writeText(text).catch(() => {
      copyTextFallback(app, text, focusedElement);
    });
    return;
  }
  copyTextFallback(app, text, focusedElement);
}

export function pasteFromClipboard(app) {
  if (!navigator.clipboard || !navigator.clipboard.readText) return;
  navigator.clipboard
    .readText()
    .then((text) => applyPastedText(app, String(text || '')))
    .catch(() => {});
}

export function getSelectedRangeText(app) {
  var ids = getSelectedCellIds(app);
  if (!ids.length) return '';
  var rows = [];
  var selectionRange = getSelectionRangeState(app);
  if (selectionRange) {
    for (var row = selectionRange.startRow; row <= selectionRange.endRow; row++) {
      var cols = [];
      for (var col = selectionRange.startCol; col <= selectionRange.endCol; col++) {
        var cellId = app.formatCellId(col, row);
        cols.push(app.getRawCellValue(cellId));
      }
      rows.push(cols.join('\t'));
    }
  } else {
    rows.push(app.getRawCellValue(ids[0]));
  }
  return rows.join('\n');
}

export function copyTextFallback(app, text, previouslyFocused) {
  var fallback = document.createElement('textarea');
  fallback.value = text;
  document.body.appendChild(fallback);
  fallback.select();
  document.execCommand('copy');
  fallback.remove();
  if (previouslyFocused && typeof previouslyFocused.focus === 'function') {
    previouslyFocused.focus();
  } else if (typeof app.focusActiveEditor === 'function') {
    app.focusActiveEditor();
  }
}

export function applyPastedText(app, text) {
  var startCellId = getSelectionStartCellId(app);
  if (!startCellId) return;
  var start = app.parseCellId(startCellId);
  if (!start) return;

  var rows = String(text || '')
    .replace(/\r/g, '')
    .split('\n');
  if (!rows.length) return;
  app.captureHistorySnapshot('paste:' + app.activeSheetId);
  var matrix = rows.map((row) => row.split('\t'));
  var changed = {};

  var selectionRange = getSelectionRangeState(app);
  if (selectionRange && matrix.length === 1 && matrix[0].length === 1) {
    for (
      var r = selectionRange.startRow;
      r <= selectionRange.endRow;
      r++
    ) {
      for (
        var c = selectionRange.startCol;
        c <= selectionRange.endCol;
        c++
      ) {
        var cellId = app.formatCellId(c, r);
        if (
          typeof app.getCellInput === 'function'
            ? app.getCellInput(cellId)
            : app.inputById[cellId]
        ) {
          app.setRawCellValue(cellId, matrix[0][0]);
          changed[cellId] = true;
        }
      }
    }
  } else {
    for (var rowIndex = 0; rowIndex < matrix.length; rowIndex++) {
      for (var colIndex = 0; colIndex < matrix[rowIndex].length; colIndex++) {
        var targetCellId = app.formatCellId(
          start.col + colIndex,
          start.row + rowIndex,
        );
        if (
          !(
            typeof app.getCellInput === 'function'
              ? app.getCellInput(targetCellId)
              : app.inputById[targetCellId]
          )
        )
          continue;
        app.setRawCellValue(targetCellId, matrix[rowIndex][colIndex]);
        changed[targetCellId] = true;
      }
    }
  }

  var activeCellId = String(getActiveCellId(app) || '');
  if (activeCellId && changed[activeCellId]) {
    app.syncActiveEditorValue(app.getRawCellValue(activeCellId));
  }

  app.aiService.notifyActiveCellChanged();
  app.computeAll();
}

export function clearSelectedCells(app) {
  var ids = getSelectedCellIds(app);
  var activeCellId = String(getActiveCellId(app) || '');
  if (!ids.length && activeCellId) {
    ids = [activeCellId];
  } else if (!ids.length && app.activeInput) {
    ids = [app.activeInput.id];
  }
  if (!ids.length) return;
  app.captureHistorySnapshot('clear:' + app.activeSheetId);

  for (var i = 0; i < ids.length; i++) {
    var sourceCellId = String(ids[i] || '').toUpperCase();
    var previousRaw = String(app.getRawCellValue(sourceCellId) || '');
    if (
      previousRaw &&
      typeof app.clearGeneratedResultCellsForSource === 'function' &&
      app.isGeneratedAIResultSourceRaw(previousRaw)
    ) {
      app.clearGeneratedResultCellsForSource(
        app.activeSheetId,
        sourceCellId,
        previousRaw,
      );
    }
    if (typeof app.setCellSchedule === 'function') {
      app.setCellSchedule(sourceCellId, null);
    }
    app.setRawCellValue(ids[i], '');
  }

  if (activeCellId && ids.indexOf(activeCellId) !== -1) {
    app.syncActiveEditorValue('');
  }

  app.aiService.notifyActiveCellChanged();
  app.renderCurrentSheetFromStorage();
  app.computeAll();
}

export function clearFillRangeHighlight(app) {
  if (typeof app.setSelectionFillRange === 'function') {
    app.setSelectionFillRange(null);
  } else {
    app.fillRange = null;
  }
  var iterate =
    typeof app.forEachInput === 'function'
      ? app.forEachInput.bind(app)
      : function (callback) {
          (app.inputs || []).forEach(callback);
        };
  iterate((input) => {
    if (!input || !input.parentElement) return;
    input.parentElement.classList.remove('fill-range');
  }, { includeDetached: false });
}

export function highlightFillRange(app, sourceId, targetId) {
  clearFillRangeHighlight(app);
  var source = app.parseCellId(sourceId);
  var target = app.parseCellId(targetId);
  if (!source || !target) return;

  var minCol = Math.min(source.col, target.col);
  var maxCol = Math.max(source.col, target.col);
  var minRow = Math.min(source.row, target.row);
  var maxRow = Math.max(source.row, target.row);
  var nextRange = {
    startCol: minCol,
    endCol: maxCol,
    startRow: minRow,
    endRow: maxRow,
    sourceId: String(sourceId || '').toUpperCase(),
    targetId: String(targetId || '').toUpperCase(),
  };
  if (typeof app.setSelectionFillRange === 'function') {
    app.setSelectionFillRange(nextRange);
  } else {
    app.fillRange = nextRange;
  }

  var iterate =
    typeof app.forEachInput === 'function'
      ? app.forEachInput.bind(app)
      : function (callback) {
          (app.inputs || []).forEach(callback);
        };
  iterate((input) => {
    var parsed = app.parseCellId(input.id);
    if (!parsed) return;
    if (parsed.col < minCol || parsed.col > maxCol) return;
    if (parsed.row < minRow || parsed.row > maxRow) return;
    if (input.id === sourceId) return;
    if (!input.parentElement) return;
    input.parentElement.classList.add('fill-range');
  }, { includeDetached: false });
}

export function startFillDrag(app, sourceInput, event) {
  app.setActiveInput(sourceInput);
  app.fillDrag = {
    sourceId: sourceInput.id,
    sourceRaw: app.getRawCellValue(sourceInput.id),
    targetId: sourceInput.id,
  };

  var onMove = (moveEvent) => onFillDragMove(app, moveEvent);
  var onUp = () => {
    document.removeEventListener('mousemove', onMove);
    document.removeEventListener('mouseup', onUp);
    finishFillDrag(app);
  };

  document.addEventListener('mousemove', onMove);
  document.addEventListener('mouseup', onUp);
  onFillDragMove(app, event);
}

export function startSelectionDrag(app, sourceInput, event) {
  if (!sourceInput) return;
  event.preventDefault();
  var startX =
    event && typeof event.clientX === 'number' ? Number(event.clientX) : 0;
  var startY =
    event && typeof event.clientY === 'number' ? Number(event.clientY) : 0;
  var mentionInput = null;
  var activeEditor =
    typeof app.getActiveEditorInput === 'function'
      ? app.getActiveEditorInput()
      : app.activeInput;
  var activeInput = app.getActiveCellInput
    ? app.getActiveCellInput()
    : app.activeInput;
  if (
    activeInput &&
    app.isEditingCell(activeInput) &&
    app.canInsertFormulaMention(
      String(activeEditor && activeEditor.value != null ? activeEditor.value : ''),
    )
  ) {
    mentionInput =
      app.editorOverlayInput &&
      (typeof app.isEditorElementFocused === 'function'
        ? app.isEditorElementFocused(app.editorOverlayInput)
        : false)
        ? app.editorOverlayInput
        : activeInput;
  } else if (
    (typeof app.isEditorElementFocused === 'function'
      ? app.isEditorElementFocused(app.formulaInput)
      : false) &&
    app.canInsertFormulaMention(app.formulaInput.value)
  ) {
    mentionInput = app.formulaInput;
  }

  app.selectionDrag = {
    anchorId: sourceInput.id,
    targetId: sourceInput.id,
    sourceId: sourceInput.id,
    startX: startX,
    startY: startY,
    activated: false,
    moved: false,
    mentionMode: !!mentionInput,
    mentionInput: mentionInput,
  };

  var onMove = (moveEvent) => onSelectionDragMove(app, moveEvent);
  var onUp = () => {
    document.removeEventListener('mousemove', onMove);
    document.removeEventListener('mouseup', onUp);
    finishSelectionDrag(app);
  };

  document.addEventListener('mousemove', onMove);
  document.addEventListener('mouseup', onUp);
}

export function onSelectionDragMove(app, event) {
  if (!app.selectionDrag) return;
  if (!app.selectionDrag.activated) {
    var moveX =
      event && typeof event.clientX === 'number' ? Number(event.clientX) : 0;
    var moveY =
      event && typeof event.clientY === 'number' ? Number(event.clientY) : 0;
    var deltaX = Math.abs(moveX - Number(app.selectionDrag.startX || 0));
    var deltaY = Math.abs(moveY - Number(app.selectionDrag.startY || 0));
    if (deltaX < 4 && deltaY < 4) return;
    app.selectionDrag.activated = true;
    if (!app.selectionDrag.mentionMode) {
      var sourceInput =
        typeof app.getCellInput === 'function'
          ? app.getCellInput(app.selectionDrag.sourceId)
          : app.inputById
            ? app.inputById[app.selectionDrag.sourceId]
            : null;
      if (sourceInput) app.setActiveInput(sourceInput);
    }
    app.setSelectionAnchor(app.selectionDrag.anchorId);
    app.setSelectionRange(app.selectionDrag.anchorId, app.selectionDrag.anchorId);
    if (app.selectionDrag.mentionMode && app.selectionDrag.mentionInput) {
      app.formulaRefCursorId = app.selectionDrag.anchorId;
      var firstToken = app.buildMentionTokenForSelection(
        app.selectionDrag.anchorId,
        true,
      );
      app.applyFormulaMentionPreview(app.selectionDrag.mentionInput, firstToken);
      syncMentionPreviewToUi(app, app.selectionDrag.mentionInput);
    }
  }
  var el = document.elementFromPoint(event.clientX, event.clientY);
  if (!el || !el.closest) return;
  var td = el.closest('td');
  if (!td) return;
  var input = resolveSpillSourceInput(
    app,
    td.querySelector('.cell-anchor-input'),
  );
  if (!input) return;

  if (app.selectionDrag.targetId !== input.id) {
    app.selectionDrag.moved = true;
    app.selectionDrag.targetId = input.id;
    app.setSelectionRange(app.selectionDrag.anchorId, input.id);
    if (app.selectionDrag.mentionMode && app.selectionDrag.mentionInput) {
      app.formulaRefCursorId = input.id;
      var mentionToken = app.buildMentionTokenForSelection(input.id, true);
      app.applyFormulaMentionPreview(
        app.selectionDrag.mentionInput,
        mentionToken,
      );
      syncMentionPreviewToUi(app, app.selectionDrag.mentionInput);
    }
  }
}

export function finishSelectionDrag(app) {
  if (!app.selectionDrag) return;
  var targetId = app.selectionDrag.targetId;
  var activated = !!app.selectionDrag.activated;
  var moved = !!app.selectionDrag.moved;
  var mentionMode = !!app.selectionDrag.mentionMode;
  var mentionInput = app.selectionDrag.mentionInput;
  app.selectionDrag = null;
  app.selectionDragJustFinished = activated && (moved || mentionMode);

  if (!activated) return;

  if (mentionMode && mentionInput) {
    syncMentionPreviewToUi(app, mentionInput);
    if (typeof mentionInput.focus === 'function') mentionInput.focus();
    return;
  }

  var targetInput =
    typeof app.getCellInput === 'function'
      ? app.getCellInput(targetId)
      : app.inputById[targetId];
  if (!targetInput) return;
  app.extendSelectionNav = true;
  if (typeof app.focusCellProxy === 'function') {
    app.focusCellProxy(targetInput);
  } else {
    targetInput.focus();
  }
  app.extendSelectionNav = false;
}

export function syncMentionPreviewToUi(app, mentionInput) {
  if (!mentionInput) return;
  var activeCellId = String(getActiveCellId(app) || '');
  if (app.syncCrossTabMentionSourceValue(mentionInput.value)) {
    if (mentionInput !== app.formulaInput)
      app.syncActiveEditorValue(mentionInput.value, { syncOverlay: false });
    return;
  }
  if (mentionInput === app.formulaInput) {
    if (!activeCellId) return;
    app.syncActiveEditorValue(mentionInput.value, { syncOverlay: false });
    app.setRawCellValue(activeCellId, mentionInput.value);
    return;
  }
  if (
    mentionInput &&
    activeCellId &&
    mentionInput.id &&
    String(mentionInput.id || '').toUpperCase() === activeCellId
  ) {
    app.syncActiveEditorValue(mentionInput.value, { syncOverlay: false });
  }
  if (mentionInput === app.editorOverlayInput && activeCellId) {
    app.syncActiveEditorValue(mentionInput.value);
  }
}

export function onFillDragMove(app, event) {
  if (!app.fillDrag) return;
  var el = document.elementFromPoint(event.clientX, event.clientY);
  if (!el || !el.closest) return;
  var td = el.closest('td');
  if (!td) return;
  var input = resolveSpillSourceInput(
    app,
    td.querySelector('.cell-anchor-input'),
  );
  if (!input) return;

  app.fillDrag.targetId = input.id;
  highlightFillRange(app, app.fillDrag.sourceId, app.fillDrag.targetId);
}

export function finishFillDrag(app) {
  if (!app.fillDrag) return;
  app.captureHistorySnapshot('fill:' + app.activeSheetId);

  var source = app.parseCellId(app.fillDrag.sourceId);
  var target = app.parseCellId(app.fillDrag.targetId);
  var sourceRaw = app.fillDrag.sourceRaw;

  if (source && target && sourceRaw !== '') {
    var minCol = Math.min(source.col, target.col);
    var maxCol = Math.max(source.col, target.col);
    var minRow = Math.min(source.row, target.row);
    var maxRow = Math.max(source.row, target.row);

    for (var row = minRow; row <= maxRow; row++) {
      for (var col = minCol; col <= maxCol; col++) {
        var cellId = app.formatCellId(col, row);
        if (cellId === app.fillDrag.sourceId) continue;
        var dRow = row - source.row;
        var dCol = col - source.col;
        var nextValue =
          sourceRaw.charAt(0) === '=' ||
          sourceRaw.charAt(0) === "'" ||
          sourceRaw.charAt(0) === '>' ||
          sourceRaw.charAt(0) === '#'
            ? app.shiftFormulaReferences(sourceRaw, dRow, dCol)
            : sourceRaw;
        app.setRawCellValue(cellId, nextValue);
      }
    }
  }

  app.fillDrag = null;
  clearFillRangeHighlight(app);
  app.aiService.notifyActiveCellChanged();
  app.computeAll();
}
