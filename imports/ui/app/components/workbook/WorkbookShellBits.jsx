import { LucideIcon } from '../icons/LucideIcon.jsx';

export function WorkbookShellRoot({ publishedMode = false, workbookUiState, children }) {
  const ui = workbookUiState && typeof workbookUiState === 'object'
    ? workbookUiState
    : {};
  return (
    <div
      className={`sheet-page-shell${publishedMode ? ' is-published-report' : ''}`}
      data-workbook-visible-sheet={String(ui.visibleSheetId || '')}
      data-workbook-active-cell={String(ui.activeCellId || '')}
      data-workbook-report-active={ui.isReportActive ? 'true' : 'false'}
      data-workbook-display-mode={String(ui.displayMode || 'values')}
      data-workbook-editing-owner-sheet={String(ui.editingOwnerSheetId || '')}
    >
      {children}
    </div>
  );
}

export function WorkbookFormulaBar({ workbookUiState, children }) {
  const ui = workbookUiState && typeof workbookUiState === 'object'
    ? workbookUiState
    : {};
  return (
    <div
      className="formula-bar"
      data-workbook-visible-sheet={String(ui.visibleSheetId || '')}
      data-workbook-active-cell={String(ui.activeCellId || '')}
      data-workbook-display-mode={String(ui.displayMode || 'values')}
      data-workbook-report-mode={String(ui.reportMode || 'edit')}
    >
      {children}
    </div>
  );
}

export function WorkbookTabBar({ workbookUiState, appRef }) {
  const ui = workbookUiState && typeof workbookUiState === 'object'
    ? workbookUiState
    : {};
  const tabs = Array.isArray(ui.tabs) ? ui.tabs : [];
  const tabCount = tabs.length;
  return (
    <div
      className="tabs-bar"
      data-workbook-visible-sheet={String(ui.visibleSheetId || '')}
      data-workbook-tab-count={String(tabCount)}
      data-workbook-report-active={ui.isReportActive ? 'true' : 'false'}
    >
      <button id="add-tab" type="button">
        {' '}
        +{' '}
      </button>
      <div id="tabs">
        {tabs.map((tab) => {
          const isActive =
            String(tab && tab.id ? tab.id : '') === String(ui.visibleSheetId || '');
          const isReport = tab && tab.type === 'report';
          return (
            <button
              key={String(tab && tab.id ? tab.id : '')}
              type="button"
              className={`tab-button${isActive ? ' active' : ''}`}
              draggable
              onClick={() => {
                if (!appRef || !appRef.current) return;
                appRef.current.onTabButtonClick(String(tab.id || ''));
              }}
              onDoubleClick={(event) => {
                event.preventDefault();
                event.stopPropagation();
                if (!appRef || !appRef.current) return;
                appRef.current.renameTabById(String(tab.id || ''));
              }}
              onDragStart={(event) => {
                if (!appRef || !appRef.current) return;
                appRef.current.onTabDragStart(event, String(tab.id || ''));
              }}
              onDragEnd={() => {
                if (!appRef || !appRef.current) return;
                appRef.current.onTabDragEnd();
              }}
              onDragOver={(event) => {
                if (!appRef || !appRef.current) return;
                appRef.current.onTabDragOver(event, String(tab.id || ''));
              }}
              onDrop={(event) => {
                if (!appRef || !appRef.current) return;
                appRef.current.onTabDrop(event, String(tab.id || ''));
              }}
            >
              {isReport ? (
                <span className="tab-doc-icon" aria-hidden="true">
                  <LucideIcon size={16}>
                    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                    <path d="M14 2v6h6" />
                    <path d="M8 13h8" />
                    <path d="M8 17h8" />
                    <path d="M8 9h2" />
                  </LucideIcon>
                </span>
              ) : null}
              <span>{String((tab && tab.name) || '')}</span>
            </button>
          );
        })}
      </div>
      <button id="delete-tab" type="button">
        delete
      </button>
    </div>
  );
}
