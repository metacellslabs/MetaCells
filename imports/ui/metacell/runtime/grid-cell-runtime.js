export function columnIndexToLabel(index) {
  var n = Number(index) || 0;
  var label = '';
  while (n > 0) {
    var rem = (n - 1) % 26;
    label = String.fromCharCode(65 + rem) + label;
    n = Math.floor((n - 1) / 26);
  }
  return label;
}

export function buildGridCellMarkup(rowIndex, colIndex) {
  var letter = columnIndexToLabel(colIndex);
  if (!rowIndex || !colIndex) return rowIndex || letter;
  return (
    "<div class='cell-output'></div>" +
    "<div class='cell-status' aria-hidden='true'></div>" +
    "<div class='cell-schedule-indicator' aria-hidden='true'></div>" +
    "<button type='button' class='cell-focus-proxy' tabindex='0' aria-label='Select cell " +
    letter +
    rowIndex +
    "'></button>" +
    "<input id='" +
    letter +
    rowIndex +
    "' class='cell-anchor-input' readonly tabindex='-1' aria-hidden='true' aria-readonly='true' autocomplete='off' spellcheck='false'/>" +
    "<div class='cell-actions'>" +
    "<button type='button' class='cell-action' data-action='copy' title='Copy value' aria-label='Copy value'><svg viewBox='0 0 24 24' aria-hidden='true' fill='none' stroke='currentColor' stroke-width='1.8' stroke-linecap='round' stroke-linejoin='round'><rect x='9' y='9' width='10' height='10' rx='2'></rect><path d='M7 15H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h7a2 2 0 0 1 2 2v1'></path></svg></button>" +
    "<button type='button' class='cell-action' data-action='fullscreen' title='Fullscreen' aria-label='Fullscreen'><svg viewBox='0 0 24 24' aria-hidden='true' fill='none' stroke='currentColor' stroke-width='1.8' stroke-linecap='round' stroke-linejoin='round'><path d='M8 3H5a2 2 0 0 0-2 2v3'></path><path d='M16 3h3a2 2 0 0 1 2 2v3'></path><path d='M8 21H5a2 2 0 0 1-2-2v-3'></path><path d='M16 21h3a2 2 0 0 0 2-2v-3'></path></svg></button>" +
    "<button type='button' class='cell-action' data-action='run' title='Run formula'>▶</button>" +
    '</div>' +
    "<div class='fill-handle'></div>"
  );
}

function buildCellFocusProxy(inputId) {
  var proxy = document.createElement('button');
  proxy.type = 'button';
  proxy.className = 'cell-focus-proxy';
  proxy.tabIndex = 0;
  proxy.setAttribute('aria-label', 'Select cell ' + String(inputId || ''));
  return proxy;
}

function buildCellActions() {
  var actions = document.createElement('div');
  actions.className = 'cell-actions';
  actions.innerHTML =
    "<button type='button' class='cell-action' data-action='copy' title='Copy value' aria-label='Copy value'><svg viewBox='0 0 24 24' aria-hidden='true' fill='none' stroke='currentColor' stroke-width='1.8' stroke-linecap='round' stroke-linejoin='round'><rect x='9' y='9' width='10' height='10' rx='2'></rect><path d='M7 15H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h7a2 2 0 0 1 2 2v1'></path></svg></button>" +
    "<button type='button' class='cell-action' data-action='fullscreen' title='Fullscreen' aria-label='Fullscreen'><svg viewBox='0 0 24 24' aria-hidden='true' fill='none' stroke='currentColor' stroke-width='1.8' stroke-linecap='round' stroke-linejoin='round'><path d='M8 3H5a2 2 0 0 0-2 2v3'></path><path d='M16 3h3a2 2 0 0 1 2 2v3'></path><path d='M8 21H5a2 2 0 0 1-2-2v-3'></path><path d='M16 21h3a2 2 0 0 0 2-2v-3'></path></svg></button>" +
    "<button type='button' class='cell-action' data-action='run' title='Run formula'>▶</button>";
  return actions;
}

export function ensureGridCellChrome(cell, input) {
  if (!cell || !input) return;
  var output = cell.querySelector('.cell-output');
  if (!output) {
    output = document.createElement('div');
    output.className = 'cell-output';
    cell.insertBefore(output, cell.firstChild || null);
  }

  var status = cell.querySelector('.cell-status');
  if (!status) {
    status = document.createElement('div');
    status.className = 'cell-status';
    status.setAttribute('aria-hidden', 'true');
    if (output.nextSibling) cell.insertBefore(status, output.nextSibling);
    else cell.appendChild(status);
  }

  var schedule = cell.querySelector('.cell-schedule-indicator');
  if (!schedule) {
    schedule = document.createElement('div');
    schedule.className = 'cell-schedule-indicator';
    schedule.setAttribute('aria-hidden', 'true');
    if (status.nextSibling) cell.insertBefore(schedule, status.nextSibling);
    else cell.appendChild(schedule);
  }

  var proxy = cell.querySelector('.cell-focus-proxy');
  if (!proxy) {
    proxy = buildCellFocusProxy(input.id);
    if (input.parentNode === cell) {
      cell.insertBefore(proxy, input);
    } else {
      cell.appendChild(proxy);
    }
  }

  var actions = cell.querySelector('.cell-actions');
  if (!actions) {
    actions = buildCellActions();
    cell.appendChild(actions);
  }

  var fillHandle = cell.querySelector('.fill-handle');
  if (!fillHandle) {
    fillHandle = document.createElement('div');
    fillHandle.className = 'fill-handle';
    cell.appendChild(fillHandle);
  }
}

export function getGridCellFocusProxy(input) {
  if (!input || !input.parentElement) return null;
  return input.parentElement.querySelector('.cell-focus-proxy');
}

export function focusGridCellInput(input) {
  if (!input) return false;
  var focusProxy = getGridCellFocusProxy(input);
  if (focusProxy && typeof focusProxy.focus === 'function') {
    focusProxy.focus();
    return true;
  }
  if (typeof input.focus === 'function') {
    input.focus();
    return true;
  }
  return false;
}
