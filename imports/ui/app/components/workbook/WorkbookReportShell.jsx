import { LucideIcon } from '../icons/LucideIcon.jsx';

export function WorkbookReportShell({
  workbookUiState,
  appRef,
  onPublishReport,
  onExportPdf,
}) {
  const ui = workbookUiState && typeof workbookUiState === 'object'
    ? workbookUiState
    : {};
  const reportUi = ui && ui.reportUi && typeof ui.reportUi === 'object'
    ? ui.reportUi
    : null;
  const isReportActive = reportUi ? reportUi.active === true : ui.isReportActive === true;
  const reportMode = reportUi ? String(reportUi.mode || 'edit') : String(ui.reportMode || 'edit');
  const isView = reportUi ? reportUi.isView === true : reportMode === 'view';
  const commandsDisabled = reportUi ? reportUi.commandsDisabled === true : isView;
  const canPublish = reportUi ? reportUi.canPublish !== false : isReportActive;
  const canExportPdf = reportUi ? reportUi.canExportPdf !== false : isReportActive;
  const editorVisible = reportUi ? reportUi.editorVisible === true : !isView;
  const liveVisible = reportUi ? reportUi.liveVisible === true : isView;
  const toolbarCommands =
    reportUi &&
    reportUi.toolbar &&
    reportUi.toolbar.commands &&
    typeof reportUi.toolbar.commands === 'object'
      ? reportUi.toolbar.commands
      : {};
  const selectionInside =
    reportUi &&
    reportUi.toolbar &&
    reportUi.toolbar.selectionInside === true;
  const canExecCommand =
    reportUi &&
    reportUi.toolbar &&
    reportUi.toolbar.canExecCommand === true;
  const commandButtonsDisabled = commandsDisabled || !canExecCommand;
  const renderStatus =
    reportUi && reportUi.render && typeof reportUi.render === 'object'
      ? reportUi.render
      : null;

  const setMode = (mode) => {
    if (!appRef || !appRef.current || typeof appRef.current.setReportMode !== 'function') {
      return;
    }
    appRef.current.setReportMode(mode);
  };

  return (
    <div
      className="report-wrap"
      style={{ display: isReportActive ? 'block' : 'none' }}
      data-report-mode={reportMode}
      data-report-active={isReportActive ? 'true' : 'false'}
      data-report-live-ready={
        renderStatus && renderStatus.hasLiveContent ? 'true' : 'false'
      }
      data-report-live-cache-match={
        renderStatus && renderStatus.liveHtmlMatchesCache ? 'true' : 'false'
      }
    >
      <div className="report-toolbar">
        <button
          type="button"
          className={`report-mode${!isView ? ' active' : ''}`}
          data-report-mode="edit"
          aria-pressed={!isView ? 'true' : 'false'}
          onClick={() => setMode('edit')}
        >
          Edit
        </button>
        <button
          type="button"
          className={`report-mode${isView ? ' active' : ''}`}
          data-report-mode="view"
          aria-pressed={isView ? 'true' : 'false'}
          onClick={() => setMode('view')}
        >
          View
        </button>
        <button
          type="button"
          className="report-action"
          onClick={onPublishReport}
          disabled={!canPublish}
        >
          Publish
        </button>
        <button
          type="button"
          className="report-action"
          onClick={onExportPdf}
          disabled={!canExportPdf}
        >
          PDF
        </button>
        <button
          type="button"
          className={`report-cmd${toolbarCommands.bold ? ' is-active' : ''}`}
          data-cmd="bold"
          aria-label="Bold"
          title="Bold"
          disabled={commandButtonsDisabled}
          aria-pressed={toolbarCommands.bold ? 'true' : 'false'}
        >
          <LucideIcon size={16}>
            <path d="M8 6h5a3 3 0 0 1 0 6H8z" />
            <path d="M8 12h6a3 3 0 0 1 0 6H8z" />
          </LucideIcon>
        </button>
        <button
          type="button"
          className={`report-cmd${toolbarCommands.italic ? ' is-active' : ''}`}
          data-cmd="italic"
          aria-label="Italic"
          title="Italic"
          disabled={commandButtonsDisabled}
          aria-pressed={toolbarCommands.italic ? 'true' : 'false'}
        >
          <LucideIcon size={16}>
            <path d="M14 6h-4" />
            <path d="M14 18h-4" />
            <path d="M14 6 10 18" />
          </LucideIcon>
        </button>
        <button
          type="button"
          className={`report-cmd${toolbarCommands.underline ? ' is-active' : ''}`}
          data-cmd="underline"
          aria-label="Underline"
          title="Underline"
          disabled={commandButtonsDisabled}
          aria-pressed={toolbarCommands.underline ? 'true' : 'false'}
        >
          <LucideIcon size={16}>
            <path d="M7 5v6a5 5 0 0 0 10 0V5" />
            <path d="M5 19h14" />
          </LucideIcon>
        </button>
        <button
          type="button"
          className={`report-cmd${toolbarCommands.insertUnorderedList ? ' is-active' : ''}`}
          data-cmd="insertUnorderedList"
          aria-label="Bullet list"
          title="Bullet list"
          disabled={commandButtonsDisabled}
          aria-pressed={toolbarCommands.insertUnorderedList ? 'true' : 'false'}
        >
          <LucideIcon size={16}>
            <path d="M9 6h11" />
            <path d="M9 12h11" />
            <path d="M9 18h11" />
            <circle cx="4" cy="6" r="1" fill="currentColor" stroke="none" />
            <circle cx="4" cy="12" r="1" fill="currentColor" stroke="none" />
            <circle cx="4" cy="18" r="1" fill="currentColor" stroke="none" />
          </LucideIcon>
        </button>
        <span className="report-hint">
          {!selectionInside && !commandsDisabled ? 'Select text to format. ' : ''}
          Mentions: <code>Sheet 1:A1</code>, <code>@named_cell</code>, region{' '}
          <code>@Sheet 1!A1:B10</code>. Inputs: <code>Input:Sheet 1!A1</code>{' '}
          or <code>Input:@named_cell</code>
        </span>
      </div>
      <div
        id="report-editor"
        className="report-editor"
        contentEditable={editorVisible}
        suppressContentEditableWarning
        style={{ display: editorVisible ? 'block' : 'none' }}
      />
      <div
        id="report-live"
        className="report-live"
        style={{ display: liveVisible ? 'block' : 'none' }}
      ></div>
    </div>
  );
}
