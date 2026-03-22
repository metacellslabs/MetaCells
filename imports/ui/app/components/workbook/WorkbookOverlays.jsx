import { useEffect, useRef } from 'react';

export function WorkbookEditorOverlay({ workbookUiState }) {
  const overlayUi =
    workbookUiState && workbookUiState.editorOverlayUi
      ? workbookUiState.editorOverlayUi
      : null;
  const overlayValue = String(
    (workbookUiState && workbookUiState.formulaValue) || '',
  );
  const inputRef = useRef(null);
  const frameStyle = overlayUi
    ? {
        display: overlayUi.visible ? 'block' : 'none',
        left: `${Number(overlayUi.left || 0)}px`,
        top: `${Number(overlayUi.top || 0)}px`,
        width: `${Number(overlayUi.width || 0)}px`,
        height: `${Number(overlayUi.height || 0)}px`,
      }
    : { display: 'none' };
  const inputStyle = overlayUi
    ? {
        left: `${Number(overlayUi.inputLeft || 0)}px`,
        top: `${Number(overlayUi.inputTop || 0)}px`,
        width: `${Number(overlayUi.inputWidth || 0)}px`,
        height: `${Number(overlayUi.inputHeight || 0)}px`,
      }
    : undefined;

  useEffect(() => {
    const input = inputRef.current;
    if (!input) return;
    if (document.activeElement === input) return;
    input.value = overlayValue;
  }, [overlayValue, overlayUi && overlayUi.visible]);

  return (
    <div
      className="cell-editor-overlay"
      style={frameStyle}
      aria-hidden={overlayUi && overlayUi.visible ? 'false' : 'true'}
      data-cell-id={overlayUi ? String(overlayUi.cellId || '') : ''}
    >
      <div className="cell-editor-overlay-frame"></div>
      <div className="cell-editor-overlay-label">Editing</div>
      <input
        ref={inputRef}
        className="cell-editor-overlay-input"
        spellCheck={false}
        style={inputStyle}
      />
    </div>
  );
}

export function WorkbookSelectionOverlay({ workbookUiState, appRef }) {
  const selectionUi =
    workbookUiState && workbookUiState.selectionUi
      ? workbookUiState.selectionUi
      : null;
  const activeRect =
    selectionUi && selectionUi.activeRect ? selectionUi.activeRect : null;
  const rangeRect =
    selectionUi && selectionUi.rangeRect ? selectionUi.rangeRect : null;
  const fillHandleRect =
    selectionUi && selectionUi.fillHandleRect ? selectionUi.fillHandleRect : null;
  const headerRects =
    selectionUi && selectionUi.headerRects ? selectionUi.headerRects : null;
  const dependencyRects =
    selectionUi && Array.isArray(selectionUi.dependencyRects)
      ? selectionUi.dependencyRects
      : [];

  const renderRectList = (items, className, styleFactory) =>
    (Array.isArray(items) ? items : []).map((rect, index) => (
      <div
        key={`${className}:${index}`}
        className={className}
        style={styleFactory(rect)}
      />
    ));

  return (
    <div
      className="selection-overlay-layer"
      aria-hidden="true"
      style={{
        position: 'absolute',
        inset: 0,
        pointerEvents: 'none',
        zIndex: 5,
      }}
    >
      {rangeRect ? (
        <div
          className="selection-overlay-range"
          style={{
            position: 'absolute',
            left: `${Number(rangeRect.left || 0)}px`,
            top: `${Number(rangeRect.top || 0)}px`,
            width: `${Math.max(0, Number(rangeRect.width || 0))}px`,
            height: `${Math.max(0, Number(rangeRect.height || 0))}px`,
            boxSizing: 'border-box',
            border: '1px solid rgba(15, 106, 78, 0.45)',
            background: 'transparent',
          }}
        />
      ) : null}
      {renderRectList(
        dependencyRects,
        'selection-overlay-dependency',
        (rect) => ({
          position: 'absolute',
          left: `${Number(rect.left || 0)}px`,
          top: `${Number(rect.top || 0)}px`,
          width: `${Math.max(0, Number(rect.width || 0))}px`,
          height: `${Math.max(0, Number(rect.height || 0))}px`,
          boxSizing: 'border-box',
          border: '1px dashed rgba(50, 113, 233, 0.38)',
          background: 'transparent',
          borderRadius: '6px',
        }),
      )}
      {activeRect ? (
        <div
          className="selection-overlay-active"
          style={{
            position: 'absolute',
            left: `${Number(activeRect.left || 0)}px`,
            top: `${Number(activeRect.top || 0)}px`,
            width: `${Math.max(0, Number(activeRect.width || 0))}px`,
            height: `${Math.max(0, Number(activeRect.height || 0))}px`,
            boxSizing: 'border-box',
            border: '2px solid rgba(50, 113, 233, 0.55)',
            background: 'transparent',
          }}
        />
      ) : null}
      {fillHandleRect ? (
        <div
          className="selection-overlay-fill-handle fill-handle"
          style={{
            position: 'absolute',
            left: `${Number(fillHandleRect.left || 0)}px`,
            top: `${Number(fillHandleRect.top || 0)}px`,
            width: `${Math.max(0, Number(fillHandleRect.width || 0))}px`,
            height: `${Math.max(0, Number(fillHandleRect.height || 0))}px`,
            background: '#1f6bff',
            cursor: 'crosshair',
            pointerEvents: 'auto',
            zIndex: 6,
          }}
          onMouseDown={(event) => {
            const app = appRef && appRef.current ? appRef.current : null;
            const activeCellId =
              app && typeof app.getSelectionActiveCellId === 'function'
                ? app.getSelectionActiveCellId()
                : '';
            const sourceInput =
              app && app.inputById && activeCellId ? app.inputById[activeCellId] : null;
            if (!app || !sourceInput || typeof app.startFillDrag !== 'function') {
              return;
            }
            event.preventDefault();
            event.stopPropagation();
            app.startFillDrag(sourceInput, event.nativeEvent || event);
          }}
        />
      ) : null}
      {headerRects
        ? renderRectList(
            headerRects.activeCols,
            'selection-overlay-header-active-col',
            (rect) => ({
              position: 'absolute',
              left: `${Number(rect.left || 0)}px`,
              top: `${Number(rect.top || 0)}px`,
              width: `${Math.max(0, Number(rect.width || 0))}px`,
              height: `${Math.max(0, Number(rect.height || 0))}px`,
              background: 'rgba(50, 113, 233, 0.08)',
            }),
          )
        : null}
      {headerRects
        ? renderRectList(
            headerRects.activeRows,
            'selection-overlay-header-active-row',
            (rect) => ({
              position: 'absolute',
              left: `${Number(rect.left || 0)}px`,
              top: `${Number(rect.top || 0)}px`,
              width: `${Math.max(0, Number(rect.width || 0))}px`,
              height: `${Math.max(0, Number(rect.height || 0))}px`,
              background: 'rgba(50, 113, 233, 0.08)',
            }),
          )
        : null}
      {headerRects
        ? renderRectList(
            headerRects.selectedCols,
            'selection-overlay-header-selected-col',
            (rect) => ({
              position: 'absolute',
              left: `${Number(rect.left || 0)}px`,
              top: `${Number(rect.top || 0)}px`,
              width: `${Math.max(0, Number(rect.width || 0))}px`,
              height: `${Math.max(0, Number(rect.height || 0))}px`,
              background: 'rgba(15, 106, 78, 0.08)',
            }),
          )
        : null}
      {headerRects
        ? renderRectList(
            headerRects.selectedRows,
            'selection-overlay-header-selected-row',
            (rect) => ({
              position: 'absolute',
              left: `${Number(rect.left || 0)}px`,
              top: `${Number(rect.top || 0)}px`,
              width: `${Math.max(0, Number(rect.width || 0))}px`,
              height: `${Math.max(0, Number(rect.height || 0))}px`,
              background: 'rgba(15, 106, 78, 0.08)',
            }),
          )
        : null}
      {headerRects && headerRects.selectedCorner ? (
        <div
          className="selection-overlay-header-corner"
          style={{
            position: 'absolute',
            left: `${Number(headerRects.selectedCorner.left || 0)}px`,
            top: `${Number(headerRects.selectedCorner.top || 0)}px`,
            width: `${Math.max(0, Number(headerRects.selectedCorner.width || 0))}px`,
            height: `${Math.max(0, Number(headerRects.selectedCorner.height || 0))}px`,
            background: 'rgba(15, 106, 78, 0.08)',
          }}
        />
      ) : null}
      {headerRects
        ? renderRectList(
            headerRects.dependencyCols,
            'selection-overlay-header-dependency-col',
            (rect) => ({
              position: 'absolute',
              left: `${Number(rect.left || 0)}px`,
              top: `${Number(rect.top || 0)}px`,
              width: `${Math.max(0, Number(rect.width || 0))}px`,
              height: `${Math.max(0, Number(rect.height || 0))}px`,
              background: 'rgba(50, 113, 233, 0.08)',
            }),
          )
        : null}
      {headerRects
        ? renderRectList(
            headerRects.dependencyRows,
            'selection-overlay-header-dependency-row',
            (rect) => ({
              position: 'absolute',
              left: `${Number(rect.left || 0)}px`,
              top: `${Number(rect.top || 0)}px`,
              width: `${Math.max(0, Number(rect.width || 0))}px`,
              height: `${Math.max(0, Number(rect.height || 0))}px`,
              background: 'rgba(50, 113, 233, 0.08)',
            }),
          )
        : null}
    </div>
  );
}

export function WorkbookFullscreenOverlay({ workbookUiState, appRef }) {
  const fullscreenUi =
    workbookUiState && workbookUiState.fullscreenUi
      ? workbookUiState.fullscreenUi
      : null;
  const isActive = fullscreenUi ? fullscreenUi.active === true : false;
  const isEditing = fullscreenUi ? fullscreenUi.isEditing === true : false;
  const editMode = fullscreenUi
    ? String(fullscreenUi.editMode || 'value')
    : 'value';
  const cellId = fullscreenUi ? String(fullscreenUi.cellId || '') : '';
  const draftValue = fullscreenUi ? String(fullscreenUi.draft || '') : '';

  const handleClose = () => {
    if (appRef?.current?.closeFullscreenCell) {
      appRef.current.closeFullscreenCell();
    }
  };

  const handleSetMode = (mode) => {
    if (appRef?.current?.startFullscreenEditing) {
      appRef.current.startFullscreenEditing(mode);
      return;
    }
    if (appRef?.current?.setFullscreenMode) {
      appRef.current.setFullscreenMode(mode);
    }
  };

  const handleEdit = () => {
    if (appRef?.current?.startFullscreenEditing) {
      appRef.current.startFullscreenEditing('value');
      return;
    }
    if (appRef?.current?.setFullscreenMode) {
      appRef.current.setFullscreenMode('value');
    }
  };

  const handleMarkdownCommand = (command) => {
    if (appRef?.current?.applyFullscreenMarkdownCommand) {
      appRef.current.applyFullscreenMarkdownCommand(command);
    }
  };

  const handleSave = () => {
    if (appRef?.current?.saveFullscreenDraft) {
      appRef.current.saveFullscreenDraft();
    }
  };

  const handleDraftChange = (event) => {
    if (appRef?.current?.setFullscreenDraft) {
      appRef.current.setFullscreenDraft(event.target.value);
    }
  };

  return (
    <div
      className={`fullscreen-overlay${isEditing ? ' fullscreen-is-editing' : ''}`}
      hidden={!isActive}
      style={{ display: isActive ? 'flex' : 'none' }}
    >
      <div className="fullscreen-panel">
        <div className="fullscreen-toolbar">
          <div className="fullscreen-toolbar-group">
            <span className="fullscreen-cell-label">{cellId}</span>
            <div className="fullscreen-mode-switch">
              <button
                type="button"
                className={`fullscreen-mode-button${
                  editMode === 'formula' ? ' is-active' : ''
                }`}
                data-mode="formula"
                title="Edit formula"
                onClick={() => handleSetMode('formula')}
              >
                Formula
              </button>
              <button
                type="button"
                className={`fullscreen-mode-button${
                  editMode === 'value' ? ' is-active' : ''
                }`}
                data-mode="value"
                title="Edit value"
                onClick={() => handleSetMode('value')}
              >
                Value
              </button>
            </div>
            <div className="fullscreen-preview-toggle">
              <span className="fullscreen-preview-label">Preview</span>
              <button
                type="button"
                className="fullscreen-edit-toggle"
                title="Edit"
                aria-label="Edit"
                onClick={handleEdit}
              >
                <svg
                  viewBox="0 0 24 24"
                  aria-hidden="true"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.8"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d="M12 20h9" />
                  <path d="M16.5 3.5a2.12 2.12 0 1 1 3 3L7 19l-4 1 1-4Z" />
                </svg>
              </button>
            </div>
            <button type="button" className="fullscreen-md-button" data-cmd="heading" title="Heading" onClick={() => handleMarkdownCommand('heading')}>H</button>
            <button type="button" className="fullscreen-md-button" data-cmd="bold" title="Bold" onClick={() => handleMarkdownCommand('bold')}>B</button>
            <button type="button" className="fullscreen-md-button" data-cmd="italic" title="Italic" onClick={() => handleMarkdownCommand('italic')}>I</button>
            <button type="button" className="fullscreen-md-button" data-cmd="list" title="Bullet list" onClick={() => handleMarkdownCommand('list')}>List</button>
            <button type="button" className="fullscreen-md-button" data-cmd="link" title="Link" onClick={() => handleMarkdownCommand('link')}>Link</button>
            <button type="button" className="fullscreen-md-button" data-cmd="code" title="Code" onClick={() => handleMarkdownCommand('code')}>Code</button>
          </div>
          <div className="fullscreen-toolbar-group">
            <button type="button" className="fullscreen-save" title="Save" onClick={handleSave}>Save</button>
            <button type="button" className="fullscreen-close" title="Close" onClick={handleClose}>✕</button>
          </div>
        </div>
        <div className="fullscreen-content">
          <div className="fullscreen-pane fullscreen-pane-editor">
            <div className="fullscreen-pane-title">Markdown</div>
            <textarea
              className="fullscreen-editor"
              spellCheck={false}
              value={draftValue}
              onChange={handleDraftChange}
            />
          </div>
          <div className="fullscreen-pane fullscreen-pane-preview">
            <div className="fullscreen-pane-title">Preview</div>
            <div className="fullscreen-preview" />
          </div>
        </div>
      </div>
    </div>
  );
}

export function WorkbookMentionAutocomplete({ workbookUiState, appRef }) {
  const ui =
    workbookUiState && workbookUiState.mentionAutocompleteUi
      ? workbookUiState.mentionAutocompleteUi
      : null;
  const style = ui
    ? {
        display: ui.visible ? 'block' : 'none',
        left: `${Number(ui.left || 0)}px`,
        top: `${Number(ui.top || 0)}px`,
        minWidth: `${Number(ui.minWidth || 0)}px`,
      }
    : { display: 'none' };
  const items = ui && Array.isArray(ui.items) ? ui.items : [];

  return (
    <div className="mention-autocomplete" style={style}>
      <div className="mention-autocomplete-list">
        {items.map((item, index) => (
          <button
            key={`${item.token || item.label || 'item'}:${index}`}
            type="button"
            className={`mention-autocomplete-item${
              ui && ui.activeIndex === index ? ' active' : ''
            }`}
            data-index={String(index)}
            onMouseDown={(event) => {
              event.preventDefault();
              if (!appRef || !appRef.current) return;
              appRef.current.applyMentionAutocompleteSelection(index);
            }}
          >
            {item.label}
          </button>
        ))}
      </div>
    </div>
  );
}
