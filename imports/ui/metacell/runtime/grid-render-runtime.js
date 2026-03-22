import {
  applyCellContentToOutput,
  applyCellInputTypography,
} from './cell-content-renderer.js';

export function buildGridCellOutputState(value, hasFormula, options) {
  var probe = document.createElement('div');
  probe.className = 'cell-output';
  applyCellContentToOutput(probe, value, hasFormula, options);
  return {
    html: probe.innerHTML,
    className: String(probe.className || 'cell-output').trim() || 'cell-output',
    backgroundColor: probe.style.backgroundColor || '',
    fontSize: probe.style.fontSize || '',
    fontFamily: probe.style.fontFamily || '',
  };
}

function buildGridCellScheduleState(options) {
  var opts = options || {};
  if (!opts.hasSchedule) {
    return {
      html: '',
      title: '',
    };
  }
  return {
    html:
      "<svg viewBox='0 0 24 24' aria-hidden='true' fill='none' stroke='currentColor' stroke-width='1.8' stroke-linecap='round' stroke-linejoin='round'><rect x='3.5' y='5.5' width='17' height='15' rx='2.5'></rect><path d='M7 3.5v4'></path><path d='M17 3.5v4'></path><path d='M3.5 9.5h17'></path></svg>",
    title: opts.scheduleTitle ? String(opts.scheduleTitle) : '',
  };
}

function buildGridCellStatusState(hasFormula, options) {
  var opts = options || {};
  var nextState = hasFormula ? String(opts.state || '') : '';
  var showStatusBadge = !(
    opts.aiSkeleton && (nextState === 'pending' || nextState === 'stale')
  );
  var title = '';
  var html = '';

  if (showStatusBadge && (nextState === 'pending' || nextState === 'stale')) {
    title = nextState === 'stale' ? 'Waiting for recompute' : 'Computing';
    html =
      "<svg viewBox='0 0 24 24' aria-hidden='true' fill='none' stroke='currentColor' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'><circle cx='12' cy='12' r='10' stroke-dasharray='3 3' /><path d='M12 6v6l4 2' /></svg>";
  } else if (nextState === 'error') {
    title = 'Error';
    html =
      "<svg viewBox='0 0 24 24' aria-hidden='true' fill='none' stroke='currentColor' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'><path d='M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0Z' /><path d='M12 9v4' /><path d='M12 17h.01' /></svg>";
  }

  return {
    html: html,
    className:
      'cell-status' +
      (showStatusBadge && nextState ? ' is-' + nextState : ''),
    title: title,
  };
}

function buildGridCellVisualFlags(options) {
  var opts = options || {};
  var borders = opts.borders || {};
  return [
    !!opts.aiSkeleton ? 'has-ai-skeleton' : '',
    !!(opts.attachment && opts.attachment.generated)
      ? 'has-generated-attachment'
      : '',
    !!opts.alignRight ? 'display-numeric' : '',
    opts.align === 'left' ? 'display-align-left' : '',
    opts.align === 'center' ? 'display-align-center' : '',
    opts.align === 'right' ? 'display-align-right' : '',
    !!opts.wrapText ? 'display-wrap' : '',
    !!opts.bold ? 'display-bold' : '',
    !!opts.italic ? 'display-italic' : '',
    borders.top === true ? 'display-border-top' : '',
    borders.right === true ? 'display-border-right' : '',
    borders.bottom === true ? 'display-border-bottom' : '',
    borders.left === true ? 'display-border-left' : '',
    !!opts.hasSchedule ? 'has-schedule' : '',
  ].filter(Boolean);
}

export function applyGridCellRender(
  input,
  value,
  isEditing,
  hasFormula,
  options,
) {
  var cell = input && input.parentElement;
  if (!cell) return;
  var normalizedValue = value == null ? '' : value;

  input.readOnly = true;
  if (!isEditing) input.value = normalizedValue;
  cell.dataset.computedValue = String(normalizedValue);

  var output = cell.querySelector('.cell-output');
  var statusNode = cell.querySelector('.cell-status');
  var scheduleNode = cell.querySelector('.cell-schedule-indicator');
  var opts = options || {};
  var borders = opts.borders || {};
  var scheduleState = buildGridCellScheduleState(opts);
  var statusState = buildGridCellStatusState(hasFormula, opts);
  var cellClassNames = buildGridCellVisualFlags(opts);
  var outputState = null;
  var hasReactCellContent =
    !!opts.cellContentStore &&
    typeof opts.cellContentStore.publishCell === 'function';

  if (output) {
    outputState = buildGridCellOutputState(normalizedValue, hasFormula, opts);
    if (!hasReactCellContent) {
      output.className = outputState.className || 'cell-output';
      output.style.backgroundColor = outputState.backgroundColor;
      output.style.fontSize = outputState.fontSize;
      output.style.fontFamily = outputState.fontFamily;
      output.innerHTML = outputState.html;
    }
  }
  applyCellInputTypography(input, opts);

  if (!hasReactCellContent) {
    cell.style.setProperty(
      '--cell-bg',
      opts.backgroundColor ? String(opts.backgroundColor) : '#fff',
    );
    cell.classList.toggle('has-ai-skeleton', !!opts.aiSkeleton);
    cell.classList.toggle(
      'has-generated-attachment',
      !!(opts.attachment && opts.attachment.generated),
    );
    cell.classList.toggle('display-numeric', !!opts.alignRight);
    cell.classList.toggle('display-align-left', opts.align === 'left');
    cell.classList.toggle('display-align-center', opts.align === 'center');
    cell.classList.toggle('display-align-right', opts.align === 'right');
    cell.classList.toggle('display-wrap', !!opts.wrapText);
    cell.classList.toggle('display-bold', !!opts.bold);
    cell.classList.toggle('display-italic', !!opts.italic);
    cell.classList.toggle('display-border-top', borders.top === true);
    cell.classList.toggle('display-border-right', borders.right === true);
    cell.classList.toggle('display-border-bottom', borders.bottom === true);
    cell.classList.toggle('display-border-left', borders.left === true);
    cell.classList.toggle('has-schedule', !!opts.hasSchedule);
  }

  if (scheduleNode) {
    if (!hasReactCellContent) {
      if (opts.hasSchedule) {
        scheduleNode.innerHTML = scheduleState.html;
        if (scheduleState.title) {
          scheduleNode.setAttribute('title', scheduleState.title);
        } else {
          scheduleNode.removeAttribute('title');
        }
      } else {
        scheduleNode.innerHTML = '';
        scheduleNode.removeAttribute('title');
      }
    }
  }

  if (statusNode) {
    if (!hasReactCellContent) {
      statusNode.className = statusState.className;
      if (statusState.title) statusNode.setAttribute('title', statusState.title);
      else statusNode.removeAttribute('title');
      statusNode.innerHTML = statusState.html;
    }
  }

  if (hasReactCellContent) {
    opts.cellContentStore.publishCell(opts.cellId || input.id, {
      cellId: opts.cellId || input.id,
      cellClassNames: cellClassNames,
      cellBackgroundColor: opts.backgroundColor
        ? String(opts.backgroundColor)
        : '#fff',
      html: outputState ? outputState.html : '',
      outputClassName: outputState ? outputState.className : 'cell-output',
      outputBackgroundColor: outputState ? outputState.backgroundColor : '',
      outputFontSize: outputState ? outputState.fontSize : '',
      outputFontFamily: outputState ? outputState.fontFamily : '',
      statusHtml: statusState.html,
      statusClassName: statusState.className,
      statusTitle: statusState.title,
      scheduleHtml: scheduleState.html,
      scheduleTitle: scheduleState.title,
    });
  }
}

export function renderGridAttachmentValue(attachment) {
  var probe = document.createElement('div');
  applyCellContentToOutput(probe, '', false, { attachment: attachment });
  return probe.innerHTML;
}

export function renderGridDownloadAttachmentLink(label, href) {
  var name = String(label || 'attachment');
  var safeName = escapeHtml(name);
  var safeHref = escapeHtml(String(href || ''));
  return (
    "<span class='embedded-attachment-link'>" +
    "<a class='embedded-attachment-download' href='" +
    safeHref +
    "' download='" +
    safeName +
    "'>" +
    safeName +
    '</a>' +
    '</span>'
  );
}

export function renderGeneratedGridAttachmentCard(
  label,
  href,
  hasDirectFileUrl,
  type,
) {
  return renderGridAttachmentValue({
    name: label,
    downloadUrl: href,
    generated: true,
    type: type,
    url: hasDirectFileUrl ? href : '',
  });
}

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}
