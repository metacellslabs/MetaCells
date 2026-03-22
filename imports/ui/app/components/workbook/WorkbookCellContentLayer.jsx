import { Fragment, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { useCellContentState } from '../../../metacell/runtime/cell-content-store.js';

export function WorkbookCellContentLayer({ cellContentStore }) {
  const cellContentById = useCellContentState(cellContentStore);
  const cellIds = Object.keys(
    cellContentById && typeof cellContentById === 'object' ? cellContentById : {},
  );

  return (
    <Fragment>
      {cellIds.map((cellId) => {
        const entry = cellContentById[cellId];
        const input =
          typeof document !== 'undefined'
            ? document.getElementById(String(cellId || ''))
            : null;
        const cell = input && input.parentElement ? input.parentElement : null;
        if (!cell) return null;
        return <CellShellPortal key={cellId} cell={cell} entry={entry} />;
      })}
    </Fragment>
  );
}

function CellShellPortal({ cell, entry }) {
  const shellTarget = cell.querySelector('.cell-react-shell');
  const outputTarget = shellTarget ? shellTarget.querySelector('.cell-output') : null;
  const statusTarget = shellTarget ? shellTarget.querySelector('.cell-status') : null;
  const scheduleTarget = shellTarget
    ? shellTarget.querySelector('.cell-schedule-indicator')
    : null;

  useEffect(() => {
    cell.style.setProperty(
      '--cell-bg',
      entry && entry.cellBackgroundColor ? entry.cellBackgroundColor : '#fff',
    );
  }, [cell, entry && entry.cellBackgroundColor]);

  useEffect(() => {
    if (!shellTarget) return;
    const shellClassName = [
      'cell-react-shell',
      ...(entry && Array.isArray(entry.cellClassNames) ? entry.cellClassNames : []),
    ]
      .map((part) => String(part || '').trim())
      .filter(Boolean)
      .join(' ');
    shellTarget.className = shellClassName;
  }, [shellTarget, entry && entry.cellClassNames]);

  const outputClassName =
    entry && entry.outputClassName ? entry.outputClassName : 'cell-output';
  useEffect(() => {
    if (!outputTarget) return;
    outputTarget.className = outputClassName;
    outputTarget.style.backgroundColor =
      entry && entry.outputBackgroundColor ? entry.outputBackgroundColor : '';
    outputTarget.style.fontSize =
      entry && entry.outputFontSize ? entry.outputFontSize : '';
    outputTarget.style.fontFamily =
      entry && entry.outputFontFamily ? entry.outputFontFamily : '';
  }, [
    outputTarget,
    outputClassName,
    entry && entry.outputBackgroundColor,
    entry && entry.outputFontSize,
    entry && entry.outputFontFamily,
  ]);

  useEffect(() => {
    if (!statusTarget) return;
    statusTarget.className =
      entry && entry.statusClassName ? entry.statusClassName : 'cell-status';
    if (entry && entry.statusTitle) {
      statusTarget.setAttribute('title', entry.statusTitle);
    } else {
      statusTarget.removeAttribute('title');
    }
  }, [statusTarget, entry && entry.statusClassName, entry && entry.statusTitle]);

  useEffect(() => {
    if (!scheduleTarget) return;
    if (entry && entry.scheduleTitle) {
      scheduleTarget.setAttribute('title', entry.scheduleTitle);
    } else {
      scheduleTarget.removeAttribute('title');
    }
  }, [scheduleTarget, entry && entry.scheduleTitle]);

  return (
    <Fragment>
      {outputTarget
        ? createPortal(<CellContentView entry={entry} />, outputTarget)
        : null}
      {statusTarget
        ? createPortal(<CellStatusView entry={entry} />, statusTarget)
        : null}
      {scheduleTarget
        ? createPortal(<CellScheduleView entry={entry} />, scheduleTarget)
        : null}
    </Fragment>
  );
}

function CellContentView({ entry }) {
  const html = entry && typeof entry.html === 'string' ? entry.html : '';
  return <span dangerouslySetInnerHTML={{ __html: html }} />;
}

function CellStatusView({ entry }) {
  const html = entry && typeof entry.statusHtml === 'string' ? entry.statusHtml : '';
  return <span dangerouslySetInnerHTML={{ __html: html }} />;
}

function CellScheduleView({ entry }) {
  const html =
    entry && typeof entry.scheduleHtml === 'string' ? entry.scheduleHtml : '';
  return <span dangerouslySetInnerHTML={{ __html: html }} />;
}
