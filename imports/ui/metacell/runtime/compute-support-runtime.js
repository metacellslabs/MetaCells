import { isChannelSendCommandRaw } from './cell-render-model.js';

export function collectLocalChannelCommandRuntimeState(app) {
  if (!app || !app.storage || typeof app.storage.listAllCellIds !== 'function') {
    return [];
  }
  var entries = app.storage.listAllCellIds();
  var results = [];
  for (var i = 0; i < entries.length; i++) {
    var entry = entries[i];
    if (!entry || !entry.sheetId || !entry.cellId) continue;
    var sheetId = String(entry.sheetId || '');
    var cellId = String(entry.cellId || '').toUpperCase();
    var raw = String(app.storage.getCellValue(sheetId, cellId) || '');
    if (!isChannelSendCommandRaw(raw)) continue;
    results.push({
      sheetId: sheetId,
      cellId: cellId,
      raw: raw,
      displayValue: String(app.storage.getCellDisplayValue(sheetId, cellId) || ''),
      value: String(app.storage.getCellComputedValue(sheetId, cellId) || ''),
      state: String(app.storage.getCellState(sheetId, cellId) || ''),
      error: String(app.storage.getCellError(sheetId, cellId) || ''),
    });
  }
  return results;
}

export function restoreLocalChannelCommandRuntimeState(app, entries) {
  var items = Array.isArray(entries) ? entries : [];
  for (var i = 0; i < items.length; i++) {
    var entry = items[i] && typeof items[i] === 'object' ? items[i] : null;
    if (!entry || !entry.sheetId || !entry.cellId) continue;
    var currentRaw = String(
      app.storage.getCellValue(entry.sheetId, entry.cellId) || '',
    );
    if (currentRaw !== String(entry.raw || '')) continue;
    app.storage.setCellRuntimeState(entry.sheetId, entry.cellId, {
      value: entry.value,
      displayValue: entry.displayValue,
      state: entry.state,
      error: entry.error,
    });
  }
}

export function getRenderTargetsForComputeResult(app, computedValues, didResort) {
  var allInputs = Array.isArray(app.inputs) ? app.inputs : [];
  if (didResort) return allInputs;
  var values =
    computedValues && typeof computedValues === 'object' ? computedValues : {};
  var ids = Object.keys(values);
  if (!ids.length) return [];
  if (ids.length >= allInputs.length) return allInputs;
  var targets = [];
  for (var i = 0; i < ids.length; i++) {
    var input =
      typeof app.getCellInput === 'function'
        ? app.getCellInput(ids[i])
        : app.inputById[ids[i]];
    if (input) targets.push(input);
  }
  return targets.length ? targets : [];
}

export function syncFormulaBarWithActiveCell(app) {
  var activeInput = app.getActiveCellInput
    ? app.getActiveCellInput()
    : app.activeInput;
  if (!activeInput || app.hasPendingLocalEdit()) return;
  var rawValue = app.getRawCellValue(activeInput.id);
  var attachment = app.parseAttachmentSource(rawValue);
  app.formulaInput.value = attachment
    ? String(
        attachment.name ||
          (attachment.converting
            ? 'Converting file...'
            : attachment.pending
              ? 'Choose file'
              : 'Attached file'),
      )
    : rawValue;
}
