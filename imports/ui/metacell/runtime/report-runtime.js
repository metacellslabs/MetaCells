import { setupReportToolbarCommands } from './report-toolbar-runtime.js';
import { setupReportLiveInteractions } from './report-live-runtime.js';
import { renderReportLiveValues } from './report-render-runtime.js';
import {
  createReportTabElement,
  fragmentHasVisibleContent,
  renderReportMarkdownNodes,
  replaceMentionInTextNode,
  replaceMentionNodes,
} from './report-transform-runtime.js';

export function setupReportControls(app) {
  if (!app.reportEditor || !app.reportWrap) return;

  app.reportEditor.innerHTML =
    app.storage.getReportContent(app.activeSheetId) || '<p></p>';

  app.reportEditor.addEventListener('input', () => {
    if (!app.isReportActive()) return;
    app.captureHistorySnapshot('report:' + app.activeSheetId);
    app.storage.setReportContent(app.activeSheetId, app.reportEditor.innerHTML);
    app.renderReportLiveValues();
  });

  setupReportToolbarCommands(app);
  setupReportLiveInteractions(app);

  app.setReportMode('view');
  app.renderReportLiveValues();
}

export function setReportMode(app, mode) {
  app.reportMode = mode === 'view' ? 'view' : 'edit';
  var isView = app.reportMode === 'view';

  if (isView) {
    app.renderReportLiveValues(true);
  }

  if (!isView) app.lastReportLiveHtml = '';
  if (typeof app.publishUiState === 'function') {
    app.publishUiState();
  }
}

export function getReportTabStateStore(app) {
  if (!app.reportActiveTabKeysBySheet) app.reportActiveTabKeysBySheet = {};
  return app.reportActiveTabKeysBySheet;
}

export function activateReportTab(app, tabKey) {
  if (!app.reportLive) return;
  var key = String(tabKey || '');
  if (!key) return;
  var store = getReportTabStateStore(app);
  store[app.activeSheetId] = key;
  var buttons = app.reportLive.querySelectorAll('.report-tab-nav-button');
  buttons.forEach((button) => {
    button.classList.toggle('active', button.dataset.reportTabKey === key);
  });
  var sections = app.reportLive.querySelectorAll('.report-tab-panel');
  sections.forEach((section) => {
    section.hidden = section.dataset.reportTabKey !== key;
  });
}

export function decorateReportTabs(app, root) {
  if (!root) return;
  var container = root;
  while (
    container.children &&
    container.children.length === 1 &&
    container.firstElementChild &&
    /^(DIV|SECTION|ARTICLE)$/i.test(
      String(container.firstElementChild.tagName || ''),
    ) &&
    container.firstElementChild.querySelector('.report-tab-title') &&
    ![].slice.call(container.childNodes).some((node) => {
      return (
        node.nodeType === Node.TEXT_NODE && String(node.nodeValue || '').trim()
      );
    })
  ) {
    container = container.firstElementChild;
  }
  var markers = [].slice.call(container.querySelectorAll('.report-tab-title'));
  if (!markers.length) return;

  var sections = [];
  markers.forEach((marker, index) => {
    sections.push({
      key:
        'tab-' +
        index +
        '-' +
        String(marker.textContent || '')
          .trim()
          .toLowerCase()
          .replace(/[^a-z0-9]+/g, '-'),
      title:
        String(marker.textContent || '').trim() || 'Section ' + (index + 1),
    });
  });
  if (!sections.length) return;

  var preambleRange = document.createRange();
  preambleRange.setStart(container, 0);
  preambleRange.setEndBefore(markers[0]);
  var preambleFragment = preambleRange.cloneContents();

  sections.forEach((section, index) => {
    var sectionRange = document.createRange();
    sectionRange.setStartAfter(markers[index]);
    if (index + 1 < markers.length)
      sectionRange.setEndBefore(markers[index + 1]);
    else sectionRange.setEnd(container, container.childNodes.length);
    section.fragment = sectionRange.cloneContents();
  });

  container.innerHTML = '';
  if (fragmentHasVisibleContent(app, preambleFragment)) {
    var preambleBlock = document.createElement('div');
    preambleBlock.className = 'report-tab-preamble';
    preambleBlock.appendChild(preambleFragment);
    container.appendChild(preambleBlock);
  }

  var nav = document.createElement('div');
  nav.className = 'report-tab-nav';
  sections.forEach((section) => {
    var button = document.createElement('button');
    button.type = 'button';
    button.className = 'report-tab-nav-button';
    button.dataset.reportTabKey = section.key;
    button.textContent = section.title;
    nav.appendChild(button);
  });
  container.appendChild(nav);

  var panels = document.createElement('div');
  panels.className = 'report-tab-panels';
  sections.forEach((section) => {
    var panel = document.createElement('div');
    panel.className = 'report-tab-panel';
    panel.dataset.reportTabKey = section.key;
    if (section.fragment) panel.appendChild(section.fragment);
    panels.appendChild(panel);
  });
  container.appendChild(panels);

  var store = getReportTabStateStore(app);
  var nextKey = store[app.activeSheetId];
  if (!sections.some((section) => section.key === nextKey))
    nextKey = sections[0].key;
  activateReportTab(app, nextKey);
}

export function parseReportControlToken(app, token, prefix) {
  var source = String(token == null ? '' : token);
  var body =
    source.indexOf(prefix) === 0 ? source.substring(prefix.length) : source;
  var match = /^(.*?)(?::\[([^\]]*)\])?$/.exec(body);
  return {
    referenceToken: String(match && match[1] ? match[1] : body).trim(),
    hint: String(match && match[2] ? match[2] : '').trim(),
  };
}

export function resolveReportInternalLink(app, token) {
  var raw = String(token || '');
  if (!raw || raw.indexOf('!@') !== 0) return null;
  var hashIdx = raw.indexOf('#');
  var linkToken = hashIdx >= 0 ? raw.slice(0, hashIdx) : raw;
  var label = hashIdx >= 0 ? raw.slice(hashIdx + 1).trim() : '';
  var ref = resolveReportReference(app, linkToken.substring(1));
  if (!ref || !ref.sheetId) return null;
  if (ref.cellId)
    return {
      sheetId: ref.sheetId,
      cellId: String(ref.cellId).toUpperCase(),
      label: label,
    };
  if (ref.startCellId)
    return {
      sheetId: ref.sheetId,
      cellId: String(ref.startCellId).toUpperCase(),
      label: label,
    };
  return null;
}

export function createReportInternalLinkElement(app, token, target) {
  var btn = document.createElement('button');
  btn.type = 'button';
  btn.className = 'report-internal-link';
  btn.dataset.sheetId = target.sheetId;
  btn.dataset.cellId = target.cellId;
  btn.textContent = String(target && target.label ? target.label : token || '');
  return btn;
}

export function followReportInternalLink(app, link) {
  var sheetId = String(link.dataset.sheetId || '');
  var cellId = String(link.dataset.cellId || '').toUpperCase();
  if (!sheetId || !cellId) return;
  if (app.isReportTab(sheetId)) {
    app.switchToSheet(sheetId);
    return;
  }
  if (app.activeSheetId !== sheetId) app.switchToSheet(sheetId);
  var input =
    typeof app.getCellInput === 'function'
      ? app.getCellInput(cellId)
      : app.inputById[cellId];
  if (!input) return;
  app.setActiveInput(input);
  input.focus();
}

export function injectLinkedInputsFromPlaceholders(app, root) {
  if (!root) return;
  var placeholders = root.querySelectorAll('.report-input-placeholder');
  placeholders.forEach((node) => {
    var payload = node.dataset.reportInputToken || '';
    var item = resolveReportInputMention(app, payload);
    if (!item) {
      node.classList.remove('report-input-placeholder');
      return;
    }
    item.placeholder = String(node.dataset.reportInputHint || '');
    var fragment = document.createDocumentFragment();
    fragment.appendChild(createLinkedReportInputElement(app, item));
    node.parentNode.replaceChild(fragment, node);
  });
  var filePlaceholders = root.querySelectorAll('.report-file-placeholder');
  filePlaceholders.forEach((node) => {
    var payload = node.dataset.reportFileToken || '';
    var item = resolveReportInputMention(app, payload);
    if (!item) {
      node.classList.remove('report-file-placeholder');
      return;
    }
    item.placeholder = String(node.dataset.reportFileHint || '');
    var fragment = document.createDocumentFragment();
    fragment.appendChild(createLinkedReportFileElement(app, item));
    node.parentNode.replaceChild(fragment, node);
  });
}

export function createLinkedReportInputElement(app, inputResolved) {
  var linked = document.createElement('input');
  linked.type = 'text';
  linked.className = 'report-linked-input';
  linked.disabled = false;
  linked.readOnly = false;
  linked.dataset.sheetId = inputResolved.sheetId;
  linked.dataset.cellId = inputResolved.cellId;
  linked.dataset.key = inputResolved.sheetId + ':' + inputResolved.cellId;
  linked.value = readLinkedInputValue(
    app,
    inputResolved.sheetId,
    inputResolved.cellId,
  );
  if (inputResolved.placeholder)
    linked.placeholder = String(inputResolved.placeholder);
  return linked;
}

export function createLinkedReportInputValueElement(app, inputResolved) {
  var value = readLinkedInputValue(
    app,
    inputResolved.sheetId,
    inputResolved.cellId,
  );
  var text = document.createElement('span');
  text.className = 'report-linked-input-value';
  text.textContent = 'Input:' + String(value == null ? '' : value);
  return text;
}

export function createLinkedReportFileElement(app, inputResolved) {
  var shell = document.createElement('span');
  shell.className = 'report-file-shell';
  shell.dataset.sheetId = inputResolved.sheetId;
  shell.dataset.cellId = inputResolved.cellId;

  var attachment = resolveLinkedReportAttachment(
    app,
    inputResolved.sheetId,
    inputResolved.cellId,
  );
  var isImage =
    !!attachment &&
    !!attachment.previewUrl &&
    String(attachment.type || '')
      .toLowerCase()
      .indexOf('image/') === 0;

  if (isImage) {
    shell.classList.add('has-image-preview');
    var imageFrame = document.createElement('span');
    imageFrame.className = 'report-file-image-frame';
    imageFrame.title = String(
      attachment.name || inputResolved.placeholder || 'Attached image',
    );

    var preview = document.createElement('img');
    preview.className = 'report-file-image';
    preview.src = String(attachment.previewUrl || '');
    preview.alt = String(attachment.name || 'Attached image');
    imageFrame.appendChild(preview);
    shell.appendChild(imageFrame);
  } else {
    var choose = document.createElement('button');
    choose.type = 'button';
    choose.className = 'report-file-button';
    choose.textContent =
      attachment && attachment.name
        ? attachment.name
        : inputResolved.placeholder || 'Choose file';
    if (attachment && attachment.generated) {
      shell.dataset.generatedAttachment = 'true';
      shell.dataset.attachmentUrl = buildLinkedReportAttachmentHref(
        app,
        attachment,
      );
      shell.dataset.attachmentName = String(attachment.name || '');
      choose.title = choose.textContent;
    }
    shell.appendChild(choose);
  }

  if (attachment && attachment.name && !attachment.generated) {
    var remove = document.createElement('button');
    remove.type = 'button';
    remove.className = 'report-file-remove';
    remove.textContent = '×';
    remove.title = 'Remove file';
    shell.appendChild(remove);
  }
  return shell;
}

export function handleReportFileShellAction(app, shell, removeOnly) {
  if (!shell) return;
  var sheetId = String(shell.dataset.sheetId || '');
  var cellId = String(shell.dataset.cellId || '').toUpperCase();
  if (!sheetId || !cellId) return;

  if (!removeOnly && shell.dataset.generatedAttachment === 'true') {
    var attachmentUrl = String(shell.dataset.attachmentUrl || '').trim();
    var attachmentName = String(shell.dataset.attachmentName || '').trim();
    if (!attachmentUrl) return;
    openLinkedReportAttachment(attachmentUrl, attachmentName);
    return;
  }

  if (!app.attachFileInput) return;

  if (removeOnly) {
    app.captureHistorySnapshot('attachment:' + sheetId + ':' + cellId);
    app.applyRawCellUpdate(
      sheetId,
      cellId,
      app.buildAttachmentSource({ pending: true }),
    );
    if (app.computedValuesBySheet[sheetId])
      delete app.computedValuesBySheet[sheetId][cellId];
    app.renderReportLiveValues(true);
    return;
  }

  var previousValue = app.storage.getCellValue(sheetId, cellId) || '';
  app.pendingAttachmentContext = {
    sheetId: sheetId,
    cellId: cellId,
    previousValue: String(previousValue == null ? '' : previousValue),
  };
  if (!app.parseAttachmentSource(previousValue)) {
    app.applyRawCellUpdate(
      sheetId,
      cellId,
      app.buildAttachmentSource({ pending: true }),
    );
    app.renderReportLiveValues(true);
  }
  app.attachFileInput.value = '';
  app.attachFileInput.click();
}

export function applyLinkedReportInput(app, input) {
  var sheetId = input.dataset.sheetId;
  var cellId = String(input.dataset.cellId || '').toUpperCase();
  if (!sheetId || !cellId) return;

  app.captureHistorySnapshot('report-input:' + sheetId + ':' + cellId);
  app.applyRawCellUpdate(sheetId, cellId, input.value);
  if (app.computedValuesBySheet[sheetId])
    delete app.computedValuesBySheet[sheetId][cellId];
  app.renderReportLiveValues(true);
}

export function refreshLinkedReportInputValue(app, input) {
  var sheetId = input.dataset.sheetId;
  var cellId = String(input.dataset.cellId || '').toUpperCase();
  if (!sheetId || !cellId) return;
  input.value = readLinkedInputValue(app, sheetId, cellId);
}

export function resolveLinkedReportAttachment(app, sheetId, cellId) {
  if (!app || typeof app.parseAttachmentSource !== 'function') return null;
  var raw = app.storage.getCellValue(sheetId, cellId);
  var computed = app.storage.getCellComputedValue(sheetId, cellId);
  var display = app.storage.getCellDisplayValue(sheetId, cellId);
  var attachment =
    app.parseAttachmentSource(raw) ||
    app.parseAttachmentSource(computed) ||
    app.parseAttachmentSource(display);
  return attachment && typeof attachment === 'object' ? attachment : null;
}

export function buildLinkedReportAttachmentHref(app, attachment) {
  if (!attachment || typeof attachment !== 'object') return '';
  if (app.grid && typeof app.grid.buildAttachmentHref === 'function') {
    return String(app.grid.buildAttachmentHref(attachment) || '');
  }
  return String(
    attachment.downloadUrl || attachment.previewUrl || attachment.url || '',
  ).trim();
}

export function openLinkedReportAttachment(url, filename) {
  var href = String(url || '').trim();
  if (!href || typeof document === 'undefined') return;
  var link = document.createElement('a');
  link.href = href;
  if (/^(?:https?:|blob:|\/)/i.test(href)) {
    link.target = '_blank';
    link.rel = 'noopener noreferrer';
  } else if (filename) {
    link.download = filename;
  }
  if (/^data:/i.test(href) && filename) {
    link.download = filename;
  }
  link.style.display = 'none';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

export function resolveReportInputMention(app, payload) {
  var resolved = resolveReportReference(app, payload);
  if (!resolved) return null;
  if (resolved.type === 'region') {
    return {
      sheetId: resolved.sheetId,
      cellId: resolved.startCellId,
      value: readLinkedInputValue(app, resolved.sheetId, resolved.startCellId),
    };
  }
  return {
    sheetId: resolved.sheetId,
    cellId: resolved.cellId,
    value: readLinkedInputValue(app, resolved.sheetId, resolved.cellId),
  };
}

export function resolveReportMention(app, token) {
  var resolved = resolveReportReference(app, token);
  if (!resolved) return null;
  if (resolved.type === 'region')
    return { type: 'region', rows: resolved.rows, value: resolved.value };
  if (resolved.type === 'table')
    return { type: 'table', rows: resolved.rows, value: resolved.value };
  if (resolved.type === 'list')
    return { type: 'list', items: resolved.items, value: resolved.value };
  return { value: resolved.value };
}

export function resolveReportReference(app, token) {
  if (!token) return null;
  var rawMode = token.indexOf('_@') === 0;
  var tokenBody = rawMode ? token.substring(1) : token;
  var normalized =
    tokenBody.charAt(0) === '@' ? tokenBody.substring(1) : tokenBody;
  var rangeResolved = resolveSheetRegionMention(app, normalized, rawMode);
  if (rangeResolved) return rangeResolved;
  if (normalized.charAt(0) === '@')
    return resolveNamedMention(app, normalized.substring(1), rawMode);
  if (tokenBody.charAt(0) === '@') {
    var named = resolveNamedMention(app, tokenBody.substring(1), rawMode);
    if (named) return named;
    return resolveSheetCellMention(app, tokenBody.substring(1), rawMode);
  }
  return resolveSheetCellMention(app, normalized, rawMode);
}

export function resolveNamedMention(app, name, rawMode) {
  var ref = app.storage.resolveNamedCell(name);
  if (!ref || !ref.sheetId) return null;
  if (ref.startCellId && ref.endCellId) {
    var startCellId = String(ref.startCellId).toUpperCase();
    var endCellId = String(ref.endCellId).toUpperCase();
    var rows = rawMode
      ? readRegionRawValues(app, ref.sheetId, startCellId, endCellId)
      : readRegionValues(app, ref.sheetId, startCellId, endCellId);
    return {
      type: 'region',
      sheetId: ref.sheetId,
      startCellId: startCellId,
      endCellId: endCellId,
      rows: rows,
      value: rows.length ? rows[0].join(', ') : '',
    };
  }
  if (!ref.cellId) return null;
  var targetCellId = String(ref.cellId).toUpperCase();
  var value = rawMode
    ? app.storage.getCellValue(ref.sheetId, targetCellId)
    : app.readCellMentionValue(ref.sheetId, targetCellId);
  if (rawMode) {
    return {
      sheetId: ref.sheetId,
      cellId: targetCellId,
      value: String(value == null ? '' : value),
    };
  }
  if (isListShortcutCell(app, ref.sheetId, targetCellId)) {
    return {
      type: 'list',
      sheetId: ref.sheetId,
      cellId: targetCellId,
      items: parseListItemsFromMentionValue(app, value),
      value: value,
    };
  }
  if (isTableShortcutCell(app, ref.sheetId, targetCellId)) {
    var tableRows = readTableMentionRows(app, ref.sheetId, targetCellId);
    return {
      type: 'table',
      sheetId: ref.sheetId,
      cellId: targetCellId,
      rows: tableRows,
      value: value,
    };
  }
  return { sheetId: ref.sheetId, cellId: targetCellId, value: value };
}

export function resolveSheetCellMention(app, token, rawMode) {
  var match =
    /^(?:'([^']+)'|"([^"]+)"|([A-Za-z][A-Za-z0-9 _-]*))[:!]@?([A-Za-z]+[0-9]+)$/.exec(
      token,
    );
  if (!match) return null;
  var sheetName = match[1] || match[2] || match[3] || '';
  var cellId = (match[4] || '').toUpperCase();
  var sheetId = app.findSheetIdByName(sheetName);
  if (!sheetId) return null;
  var value = rawMode
    ? app.storage.getCellValue(sheetId, cellId)
    : app.readCellMentionValue(sheetId, cellId);
  if (rawMode) {
    return {
      sheetId: sheetId,
      cellId: cellId,
      value: String(value == null ? '' : value),
    };
  }
  if (isListShortcutCell(app, sheetId, cellId)) {
    return {
      type: 'list',
      sheetId: sheetId,
      cellId: cellId,
      items: parseListItemsFromMentionValue(app, value),
      value: value,
    };
  }
  if (isTableShortcutCell(app, sheetId, cellId)) {
    var tableRows = readTableMentionRows(app, sheetId, cellId);
    return {
      type: 'table',
      sheetId: sheetId,
      cellId: cellId,
      rows: tableRows,
      value: value,
    };
  }
  return { sheetId: sheetId, cellId: cellId, value: value };
}

export function resolveSheetRegionMention(app, token, rawMode) {
  var match =
    /^(?:'([^']+)'|"([^"]+)"|([A-Za-z][A-Za-z0-9 _-]*))[:!]@?([A-Za-z]+[0-9]+):@?([A-Za-z]+[0-9]+)$/.exec(
      token,
    );
  if (!match) return null;
  var sheetName = match[1] || match[2] || match[3] || '';
  var startCellId = (match[4] || '').toUpperCase();
  var endCellId = (match[5] || '').toUpperCase();
  var sheetId = app.findSheetIdByName(sheetName);
  if (!sheetId) return null;
  var rows = rawMode
    ? readRegionRawValues(app, sheetId, startCellId, endCellId)
    : readRegionValues(app, sheetId, startCellId, endCellId);
  return {
    type: 'region',
    sheetId: sheetId,
    startCellId: startCellId,
    endCellId: endCellId,
    rows: rows,
    value: rows.length ? rows[0].join(', ') : '',
  };
}

export function readRegionValues(app, sheetId, startCellId, endCellId) {
  var start = app.parseCellId(startCellId);
  var end = app.parseCellId(endCellId);
  if (!start || !end) return [];
  var rowStart = Math.min(start.row, end.row);
  var rowEnd = Math.max(start.row, end.row);
  var colStart = Math.min(start.col, end.col);
  var colEnd = Math.max(start.col, end.col);
  var rows = [];
  for (var row = rowStart; row <= rowEnd; row++) {
    var values = [];
    for (var col = colStart; col <= colEnd; col++) {
      var cellId = app.formatCellId(col, row);
      values.push(app.readCellComputedValue(sheetId, cellId));
    }
    rows.push(values);
  }
  return rows;
}

export function readRegionRawValues(app, sheetId, startCellId, endCellId) {
  var start = app.parseCellId(startCellId);
  var end = app.parseCellId(endCellId);
  if (!start || !end) return [];
  var rowStart = Math.min(start.row, end.row);
  var rowEnd = Math.max(start.row, end.row);
  var colStart = Math.min(start.col, end.col);
  var colEnd = Math.max(start.col, end.col);
  var rows = [];
  for (var row = rowStart; row <= rowEnd; row++) {
    var values = [];
    for (var col = colStart; col <= colEnd; col++) {
      var cellId = app.formatCellId(col, row);
      values.push(String(app.storage.getCellValue(sheetId, cellId) || ''));
    }
    rows.push(values);
  }
  return rows;
}

export function createReportRegionTableElement(app, rows) {
  var table = document.createElement('table');
  table.className = 'report-region-table';
  var body = document.createElement('tbody');
  var safeRows = Array.isArray(rows) ? rows : [];
  for (var r = 0; r < safeRows.length; r++) {
    var tr = document.createElement('tr');
    var rowValues = Array.isArray(safeRows[r]) ? safeRows[r] : [];
    for (var c = 0; c < rowValues.length; c++) {
      var td = document.createElement('td');
      td.textContent = String(rowValues[c] == null ? '' : rowValues[c]);
      tr.appendChild(td);
    }
    body.appendChild(tr);
  }
  table.appendChild(body);
  return table;
}

export function createReportListElement(app, items) {
  var list = document.createElement('ul');
  list.className = 'report-mentioned-list';
  var values = Array.isArray(items) ? items : [];
  for (var i = 0; i < values.length; i++) {
    var text = String(values[i] == null ? '' : values[i]).trim();
    if (!text) continue;
    var li = document.createElement('li');
    li.textContent = text;
    list.appendChild(li);
  }
  if (!list.childNodes.length) {
    var empty = document.createElement('li');
    empty.textContent = '';
    list.appendChild(empty);
  }
  return list;
}

export function isListShortcutCell(app, sheetId, cellId) {
  var raw = app.storage.getCellValue(
    sheetId,
    String(cellId || '').toUpperCase(),
  );
  if (!raw || raw.charAt(0) !== '>') return false;
  return !!app.formulaEngine.parseListShortcutPrompt(raw);
}

export function isTableShortcutCell(app, sheetId, cellId) {
  var raw = app.storage.getCellValue(
    sheetId,
    String(cellId || '').toUpperCase(),
  );
  if (!raw || raw.charAt(0) !== '#') return false;
  if (
    app.formulaEngine &&
    typeof app.formulaEngine.parseChannelFeedPromptSpec === 'function' &&
    app.formulaEngine.parseChannelFeedPromptSpec(raw)
  ) {
    return false;
  }
  return !!(
    app.formulaEngine &&
    typeof app.formulaEngine.parseTablePromptSpec === 'function' &&
    app.formulaEngine.parseTablePromptSpec(raw)
  );
}

export function readTableMentionRows(app, sheetId, cellId) {
  if (
    !app ||
    !app.formulaEngine ||
    typeof app.formulaEngine.readTableShortcutMatrix !== 'function'
  ) {
    return [];
  }
  var rows = app.formulaEngine.readTableShortcutMatrix(
    sheetId,
    String(cellId || '').toUpperCase(),
    {},
    {},
  );
  return Array.isArray(rows) ? rows : [];
}

export function parseListItemsFromMentionValue(app, value) {
  return String(value == null ? '' : value)
    .split(/\r?\n/)
    .map(function (line) {
      return line.trim();
    })
    .filter(Boolean);
}

export function readLinkedInputValue(app, sheetId, cellId) {
  var targetCellId = String(cellId).toUpperCase();
  var raw = app.storage.getCellValue(sheetId, targetCellId);
  if (raw && raw.charAt(0) !== '=' && raw.charAt(0) !== '>') return String(raw);
  return app.readCellComputedValue(sheetId, targetCellId);
}
