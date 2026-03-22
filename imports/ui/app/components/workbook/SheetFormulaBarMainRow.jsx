import { LucideIcon } from '../icons/LucideIcon.jsx';

export function SheetFormulaBarMainRow({
  workbookName,
  setWorkbookName,
  commitWorkbookRename,
  isRenaming,
  sheetName,
  cellNameInputRef,
  cellNameValue,
  setCellNameValue,
  workbookUiState,
  formulaBarUi,
  handleToggleNamedCellJump,
  handleNamedCellJumpHover,
  handleNamedCellJumpSelect,
  handleToggleAIMode,
  handleSetAIMode,
  handleToggleDisplayMode,
  handleSetDisplayMode,
  handleUpdateAI,
  onOpenHelp,
}) {
  return (
    <div className="formula-bar-row formula-bar-row-main">
      <div className="formula-cluster formula-cluster-brand">
        <div className="workbook-name-combo">
          <a className="formula-home-link" href="/" aria-label="Home">
            <LucideIcon>
              <path d="M3 9.5 12 3l9 6.5" />
              <path d="M5 10v10a1 1 0 0 0 1 1h4v-6a2 2 0 0 1 2 -2h0a2 2 0 0 1 2 2v6h4a1 1 0 0 0 1 -1V10" />
            </LucideIcon>
          </a>
          <input
            id="workbook-name-input"
            type="text"
            value={workbookName}
            onChange={(event) => setWorkbookName(event.target.value)}
            onBlur={commitWorkbookRename}
            onKeyDown={(event) => {
              if (event.key === 'Enter') {
                event.preventDefault();
                event.currentTarget.blur();
              }
              if (event.key === 'Escape') {
                setWorkbookName(String(sheetName || ''));
                event.currentTarget.blur();
              }
            }}
            placeholder="Metacell name"
            disabled={isRenaming}
          />
        </div>
      </div>
      <div className="formula-cluster formula-cluster-address">
        <div className="cell-name-combo">
          <input
            id="cell-name-input"
            ref={cellNameInputRef}
            type="text"
            placeholder="A1 or @name"
            defaultValue={cellNameValue}
            onChange={(event) => setCellNameValue(event.target.value)}
          />
          <div className="named-cell-jump-picker">
            <button
              id="named-cell-jump"
              type="button"
              onClick={handleToggleNamedCellJump}
              aria-label="Jump to named cell"
              title="Jump to named cell"
              aria-haspopup="menu"
              aria-expanded={
                workbookUiState.namedCellJumpUi &&
                workbookUiState.namedCellJumpUi.pickerOpen
                  ? 'true'
                  : 'false'
              }
              disabled={
                !!(
                  workbookUiState.namedCellJumpUi &&
                  workbookUiState.namedCellJumpUi.disabled
                )
              }
            >
              <LucideIcon size={14}>
                <path d="M6 9l6 6 6-6" />
              </LucideIcon>
            </button>
            <div
              id="named-cell-jump-popover"
              className="named-cell-jump-popover"
              hidden={
                !(
                  workbookUiState.namedCellJumpUi &&
                  workbookUiState.namedCellJumpUi.pickerOpen
                )
              }
            >
              {workbookUiState.namedCellJumpUi &&
              Array.isArray(workbookUiState.namedCellJumpUi.items) &&
              workbookUiState.namedCellJumpUi.items.length ? (
                workbookUiState.namedCellJumpUi.items.map((item, index) => {
                  const location =
                    item.cellId ||
                    (item.startCellId && item.endCellId
                      ? `${item.startCellId}:${item.endCellId}`
                      : '');
                  return (
                    <button
                      key={`${item.name}:${item.sheetId}:${location}`}
                      type="button"
                      className={`named-cell-jump-option${
                        workbookUiState.namedCellJumpUi.activeIndex === index
                          ? ' is-active'
                          : ''
                      }`}
                      data-name={item.name}
                      data-index={index}
                      onMouseEnter={() => handleNamedCellJumpHover(index)}
                      onClick={() => handleNamedCellJumpSelect(item.name)}
                    >
                      <span className="named-cell-jump-name">{item.name}</span>
                      <span className="named-cell-jump-location">
                        {item.sheetName}!{location}
                      </span>
                    </button>
                  );
                })
              ) : (
                <span className="named-cell-jump-empty">
                  {cellNameValue.trim() ? 'No matching names' : 'No named cells'}
                </span>
              )}
            </div>
          </div>
        </div>
      </div>
      <div className="formula-cluster formula-cluster-editor">
        <div className="formula-input-combo">
          <span className="formula-input-prefix" aria-hidden="true">
            Fx
          </span>
          <input
            id="formula-input"
            type="text"
            placeholder="edit active cell formula/value"
          />
        </div>
        <input id="attach-file-input" type="file" hidden />
        <span
          id="calc-progress"
          className="calc-progress"
          aria-live="polite"
        ></span>
      </div>
      <div className="formula-cluster formula-cluster-modes">
        <div className="formula-icon-select">
          <div className="ai-mode-picker">
            <button
              id="ai-mode"
              type="button"
              onClick={handleToggleAIMode}
              aria-label="AI mode"
              title="AI mode"
              aria-haspopup="menu"
              aria-expanded={
                workbookUiState.aiModeUi &&
                workbookUiState.aiModeUi.pickerOpen
                  ? 'true'
                  : 'false'
              }
              data-ai-mode-current={String(
                (workbookUiState.aiModeUi && workbookUiState.aiModeUi.mode) || 'manual',
              )}
            >
              {workbookUiState.aiModeUi &&
              workbookUiState.aiModeUi.mode === 'auto' ? (
                <LucideIcon size={16}>
                  <path d="M12 3l1.6 4.4L18 9l-4.4 1.6L12 15l-1.6-4.4L6 9l4.4-1.6L12 3Z" />
                  <path d="M19 14l.8 2.2L22 17l-2.2.8L19 20l-.8-2.2L16 17l2.2-.8L19 14Z" />
                  <path d="M5 14l.8 2.2L8 17l-2.2.8L5 20l-.8-2.2L2 17l2.2-.8L5 14Z" />
                </LucideIcon>
              ) : (
                <LucideIcon size={16}>
                  <path d="M9 11V5a3 3 0 0 1 6 0v6" />
                  <path d="M6 11h12" />
                  <path d="M8 11v4a4 4 0 0 0 8 0v-4" />
                  <path d="M12 19v2" />
                </LucideIcon>
              )}
            </button>
            <div
              id="ai-mode-popover"
              className="ai-mode-popover"
              hidden={
                !(
                  workbookUiState.aiModeUi &&
                  workbookUiState.aiModeUi.pickerOpen
                )
              }
            >
              <button
                type="button"
                className={`ai-mode-option${
                  workbookUiState.aiModeUi &&
                  workbookUiState.aiModeUi.mode === 'auto'
                    ? ' is-active'
                    : ''
                }`}
                data-ai-mode="auto"
                onClick={(event) => handleSetAIMode(event, 'auto')}
              >
                Auto AI
              </button>
              <button
                type="button"
                className={`ai-mode-option${
                  !workbookUiState.aiModeUi ||
                  workbookUiState.aiModeUi.mode === 'manual'
                    ? ' is-active'
                    : ''
                }`}
                data-ai-mode="manual"
                onClick={(event) => handleSetAIMode(event, 'manual')}
              >
                Manual AI
              </button>
            </div>
          </div>
        </div>
        <div className="formula-icon-select">
          <div className="display-mode-picker">
            <button
              id="display-mode"
              type="button"
              onClick={handleToggleDisplayMode}
              aria-label="Display mode"
              title="Display mode"
              aria-haspopup="menu"
              aria-expanded={formulaBarUi.displayModePickerOpen ? 'true' : 'false'}
              data-display-mode-current={String(workbookUiState.displayMode || 'values')}
            >
              {workbookUiState.displayMode === 'formulas' ? (
                <LucideIcon size={16}>
                  <path d="M8 5h8" />
                  <path d="M8 19h8" />
                  <path d="M14 5 10 19" />
                </LucideIcon>
              ) : (
                <LucideIcon size={16}>
                  <path d="M3 12s3.5-6 9-6 9 6 9 6-3.5 6-9 6-9-6-9-6Z" />
                  <circle cx="12" cy="12" r="2.5" />
                </LucideIcon>
              )}
            </button>
            <div
              id="display-mode-popover"
              className="display-mode-popover"
              hidden={!formulaBarUi.displayModePickerOpen}
            >
              <button
                type="button"
                className={`display-mode-option${
                  workbookUiState.displayMode !== 'formulas' ? ' is-active' : ''
                }`}
                data-display-mode="values"
                onClick={(event) => handleSetDisplayMode(event, 'values')}
              >
                Values
              </button>
              <button
                type="button"
                className={`display-mode-option${
                  workbookUiState.displayMode === 'formulas' ? ' is-active' : ''
                }`}
                data-display-mode="formulas"
                onClick={(event) => handleSetDisplayMode(event, 'formulas')}
              >
                Formulas
              </button>
            </div>
          </div>
        </div>
      </div>
      <div className="formula-cluster formula-cluster-actions">
        <button
          id="update-ai"
          type="button"
          onClick={handleUpdateAI}
          disabled={!!(workbookUiState.aiModeUi && workbookUiState.aiModeUi.updateButtonDisabled)}
          className={
            workbookUiState.aiModeUi && workbookUiState.aiModeUi.updateButtonLoading
              ? 'is-loading'
              : ''
          }
          aria-busy={
            workbookUiState.aiModeUi && workbookUiState.aiModeUi.updateButtonLoading
              ? 'true'
              : 'false'
          }
          style={{
            display:
              workbookUiState.aiModeUi &&
              workbookUiState.aiModeUi.showUpdateButton === false
                ? 'none'
                : undefined,
          }}
        >
          {workbookUiState.aiModeUi && workbookUiState.aiModeUi.updateButtonLoading
            ? 'Updating...'
            : 'Update'}
        </button>
        <button type="button" className="help-button" onClick={onOpenHelp}>
          ?
        </button>
      </div>
    </div>
  );
}
