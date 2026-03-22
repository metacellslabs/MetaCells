import { useEffect, useRef, useState } from 'react';

export function WorkbookFormulaTrackerPanel({ workbookUiState, appRef }) {
  const trackerUi =
    workbookUiState && workbookUiState.formulaTrackerUi
      ? workbookUiState.formulaTrackerUi
      : null;
  const entries =
    trackerUi && Array.isArray(trackerUi.entries) ? trackerUi.entries : [];
  const isOpen = trackerUi ? trackerUi.open === true : false;
  const activeSheetId = trackerUi ? String(trackerUi.activeSheetId || '') : '';
  const activeCellId = trackerUi ? String(trackerUi.activeCellId || '') : '';
  const withAssistantOffset =
    trackerUi ? trackerUi.withAssistantOffset === true : false;

  const handleClose = () => {
    if (!appRef.current || typeof appRef.current.hideFormulaTrackerPanel !== 'function') {
      return;
    }
    appRef.current.hideFormulaTrackerPanel();
  };

  const handleSelect = (sheetId, cellId) => {
    if (!appRef.current) return;
    const targetSheetId = String(sheetId || '');
    const targetCellId = String(cellId || '').toUpperCase();
    if (!targetSheetId || !targetCellId) return;
    if (
      targetSheetId !== String(appRef.current.activeSheetId || '') &&
      typeof appRef.current.switchToSheet === 'function'
    ) {
      appRef.current.switchToSheet(targetSheetId);
    }
    window.requestAnimationFrame(() => {
      const input =
        appRef.current && appRef.current.inputById
          ? appRef.current.inputById[targetCellId]
          : null;
      if (!input) return;
      appRef.current.setActiveInput(input);
      if (typeof input.focus === 'function') input.focus();
      if (typeof appRef.current.refreshFormulaTrackerPanel === 'function') {
        appRef.current.refreshFormulaTrackerPanel();
      }
    });
  };

  return (
    <aside
      className={`formula-tracker-panel${
        withAssistantOffset ? ' with-assistant-offset' : ''
      }`}
      hidden={!isOpen}
      style={{ display: isOpen ? 'flex' : 'none' }}
    >
      <div className="formula-tracker-head">
        <div className="formula-tracker-title-wrap">
          <div className="formula-tracker-title">Automation</div>
          <div className="formula-tracker-subtitle">Channel and scheduled cells</div>
        </div>
        <button
          type="button"
          className="formula-tracker-close"
          aria-label="Close"
          onClick={handleClose}
        >
          ×
        </button>
      </div>
      <div className="formula-tracker-list">
        {entries.length ? (
          entries.map((entry) => (
            <button
              key={`${entry.sheetId}:${entry.cellId}`}
              type="button"
              className={`formula-tracker-item${
                String(entry.sheetId || '') === activeSheetId &&
                String(entry.cellId || '').toUpperCase() === activeCellId
                  ? ' active'
                  : ''
              }`}
              onClick={() => handleSelect(entry.sheetId, entry.cellId)}
            >
              <div className="formula-tracker-item-title">
                {entry.sheetName} · {entry.cellId}
              </div>
              <div className="formula-tracker-item-meta">
                {Array.isArray(entry.tags) ? entry.tags.join(' · ') : ''}
              </div>
              <div className="formula-tracker-item-preview">
                {String(entry.raw || '').trim() || '(empty)'}
              </div>
            </button>
          ))
        ) : (
          <div className="formula-tracker-empty">
            No channel or scheduled cells yet.
          </div>
        )}
      </div>
    </aside>
  );
}

export function WorkbookAssistantPanel({ workbookUiState, appRef }) {
  const assistantUi =
    workbookUiState && workbookUiState.assistantUi
      ? workbookUiState.assistantUi
      : null;
  const isOpen = assistantUi ? assistantUi.open === true : false;
  const providers =
    assistantUi && Array.isArray(assistantUi.providers)
      ? assistantUi.providers
      : [];
  const uploads =
    assistantUi && Array.isArray(assistantUi.uploads)
      ? assistantUi.uploads
      : [];
  const messages =
    assistantUi && Array.isArray(assistantUi.messages)
      ? assistantUi.messages
      : [];
  const activity =
    assistantUi && Array.isArray(assistantUi.activity)
      ? assistantUi.activity
      : [];
  const statusText = assistantUi ? String(assistantUi.statusText || '') : '';
  const metaText = assistantUi ? String(assistantUi.metaText || '') : '';
  const activeProviderId = assistantUi
    ? String(assistantUi.activeProviderId || '')
    : '';
  const isBusy = assistantUi ? assistantUi.busy === true : false;
  const draftValue = assistantUi ? String(assistantUi.draft || '') : '';
  const fileInputRef = useRef(null);
  const panelRef = useRef(null);
  const dragStateRef = useRef(null);
  const [panelOffset, setPanelOffset] = useState({ x: 0, y: 0 });

  useEffect(() => {
    const handlePointerMove = (event) => {
      const dragState = dragStateRef.current;
      if (!dragState) return;
      const viewportWidth = window.innerWidth || document.documentElement.clientWidth || 0;
      const viewportHeight = window.innerHeight || document.documentElement.clientHeight || 0;
      const nextLeft = dragState.left + (event.clientX - dragState.startX);
      const nextTop = dragState.top + (event.clientY - dragState.startY);
      const minLeft = 8;
      const minTop = 8;
      const maxLeft = Math.max(minLeft, viewportWidth - dragState.width - 8);
      const maxTop = Math.max(minTop, viewportHeight - dragState.height - 8);
      const clampedLeft = Math.min(Math.max(nextLeft, minLeft), maxLeft);
      const clampedTop = Math.min(Math.max(nextTop, minTop), maxTop);
      setPanelOffset({
        x: dragState.originX + (clampedLeft - dragState.left),
        y: dragState.originY + (clampedTop - dragState.top),
      });
    };

    const handlePointerUp = () => {
      dragStateRef.current = null;
      document.body.classList.remove('assistant-chat-dragging');
    };

    window.addEventListener('pointermove', handlePointerMove);
    window.addEventListener('pointerup', handlePointerUp);
    window.addEventListener('pointercancel', handlePointerUp);
    return () => {
      window.removeEventListener('pointermove', handlePointerMove);
      window.removeEventListener('pointerup', handlePointerUp);
      window.removeEventListener('pointercancel', handlePointerUp);
      document.body.classList.remove('assistant-chat-dragging');
    };
  }, []);

  const handleClose = () => {
    if (appRef && appRef.current && typeof appRef.current.hideAssistantPanel === 'function') {
      appRef.current.hideAssistantPanel();
    }
  };

  const handleProviderChange = (event) => {
    if (appRef && appRef.current && typeof appRef.current.setAssistantProvider === 'function') {
      appRef.current.setAssistantProvider(event.target.value);
    }
  };

  const handleAttachFile = () => {
    if (fileInputRef.current) fileInputRef.current.click();
  };

  const handleFileChange = (event) => {
    const file = event.target.files && event.target.files[0];
    if (!file) return;
    if (appRef && appRef.current && typeof appRef.current.uploadAssistantFile === 'function') {
      appRef.current.uploadAssistantFile(file);
    }
    event.target.value = '';
  };

  const handleRemoveUpload = (uploadId) => {
    if (appRef && appRef.current && typeof appRef.current.removeAssistantUpload === 'function') {
      appRef.current.removeAssistantUpload(uploadId);
    }
  };

  const handleClear = () => {
    if (appRef && appRef.current && typeof appRef.current.clearAssistantConversation === 'function') {
      appRef.current.clearAssistantConversation();
    }
  };

  const handleDraftChange = (event) => {
    if (appRef && appRef.current && typeof appRef.current.updateAssistantDraft === 'function') {
      appRef.current.updateAssistantDraft(event.target.value);
    }
  };

  const handleSubmit = (event) => {
    event.preventDefault();
    if (appRef && appRef.current && typeof appRef.current.submitAssistantDraft === 'function') {
      appRef.current.submitAssistantDraft(draftValue);
    }
  };

  const handleDraftKeyDown = (event) => {
    if ((event.metaKey || event.ctrlKey) && event.key === 'Enter') {
      event.preventDefault();
      if (appRef && appRef.current && typeof appRef.current.submitAssistantDraft === 'function') {
        appRef.current.submitAssistantDraft(draftValue);
      }
    }
  };

  const handlePanelDragStart = (event) => {
    if (event.button !== 0) return;
    if (
      event.target &&
      event.target.closest &&
      event.target.closest('button, select, input, textarea, label')
    ) {
      return;
    }
    const panel = panelRef.current;
    if (!panel) return;
    const rect = panel.getBoundingClientRect();
    dragStateRef.current = {
      startX: event.clientX,
      startY: event.clientY,
      left: rect.left,
      top: rect.top,
      width: rect.width,
      height: rect.height,
      originX: panelOffset.x,
      originY: panelOffset.y,
    };
    document.body.classList.add('assistant-chat-dragging');
    event.preventDefault();
  };

  return (
    <div
      ref={panelRef}
      className="assistant-chat-panel"
      hidden={!isOpen}
      style={{
        display: isOpen ? 'flex' : 'none',
        transform: `translate(${panelOffset.x}px, ${panelOffset.y}px)`,
      }}
    >
      <div className="assistant-chat-head" onPointerDown={handlePanelDragStart}>
        <div className="assistant-chat-title-wrap">
          <h2>AI Assistant</h2>
        </div>
        <div className="assistant-chat-head-actions">
          <label
            className="assistant-chat-provider assistant-chat-provider-compact"
            aria-label="Assistant provider"
          >
            <select
              name="assistant-provider"
              value={activeProviderId}
              onChange={handleProviderChange}
              disabled={isBusy}
            >
              {providers.map((provider) => (
                <option key={provider.id} value={provider.id}>
                  {provider.name}
                </option>
              ))}
            </select>
            <span className="assistant-chat-provider-arrow" aria-hidden="true">
              ▾
            </span>
          </label>
          <div
            className="assistant-chat-status"
            style={{ display: statusText ? 'inline-flex' : 'none' }}
          >
            {statusText}
          </div>
          <button
            type="button"
            className="secondary assistant-chat-head-button"
            onClick={handleAttachFile}
          >
            Attach file
          </button>
          <button
            type="button"
            className="assistant-chat-close"
            onClick={handleClose}
            aria-label="Close"
          >
            ×
          </button>
        </div>
      </div>
      <div className="assistant-chat-meta">{metaText}</div>
      <div
        className="assistant-chat-uploads"
        style={{ display: uploads.length ? 'flex' : 'none' }}
      >
        {uploads.map((item) => (
          <div key={item.id} className="assistant-chat-upload-chip">
            <span className="assistant-chat-upload-chip-label">{item.name}</span>
            <button
              type="button"
              className="assistant-chat-upload-remove"
              onClick={() => handleRemoveUpload(item.id)}
              aria-label="Remove uploaded file"
            >
              ×
            </button>
          </div>
        ))}
      </div>
      <div className="assistant-chat-body">
        <div className="assistant-chat-messages">
          {messages.length ? (
            messages.map((item, index) => (
              <div
                key={`${item.role}:${index}:${item.time || ''}`}
                className={`assistant-chat-message assistant-chat-message-${item.role || 'assistant'}`}
              >
                {item.role !== 'user' || item.time ? (
                  <div className="assistant-chat-message-role">
                    {item.role === 'user' ? '' : 'Assistant'}
                    {item.time ? (
                      <span className="assistant-chat-message-time">{item.time}</span>
                    ) : null}
                  </div>
                ) : null}
                <div className="assistant-chat-message-body">{item.content}</div>
              </div>
            ))
          ) : (
            <div className="assistant-chat-empty">
              <strong>Ask for workbook changes directly.</strong>
              <span>
                Try: build a report tab, rewrite these formulas using @mentions,
                add schedules, or attach an uploaded file into a cell.
              </span>
            </div>
          )}
          {isBusy ? (
            <div className="assistant-chat-message assistant-chat-message-assistant assistant-chat-message-thinking">
              <div className="assistant-chat-message-body assistant-chat-thinking-body">
                <span className="assistant-chat-thinking-dot"></span>
                <span className="assistant-chat-thinking-dot"></span>
                <span className="assistant-chat-thinking-dot"></span>
              </div>
            </div>
          ) : null}
        </div>
        <div
          className="assistant-chat-activity"
          style={{ display: activity.length ? 'flex' : 'none' }}
        >
          {activity.length ? (
            <>
              <div className="assistant-chat-activity-heading">Recent tool activity</div>
              {activity.map((item, index) => (
                <div
                  key={`${item.assistantMessage}:${index}`}
                  className="assistant-chat-activity-card"
                >
                  <div className="assistant-chat-activity-title">
                    {item.assistantMessage || 'Tool activity'}
                  </div>
                  {(Array.isArray(item.toolResults) ? item.toolResults : []).map((result, resultIndex) => (
                    <div
                      key={`${result.name}:${resultIndex}`}
                      className={`assistant-chat-activity-line${
                        result.ok === false ? ' is-error' : ''
                      }`}
                    >
                      {result.name}
                      {result.ok === false
                        ? `: ${String(result.error || 'Failed')}`
                        : ': ok'}
                    </div>
                  ))}
                </div>
              ))}
            </>
          ) : null}
        </div>
      </div>
      <form className="assistant-chat-compose" onSubmit={handleSubmit}>
        <textarea
          name="message"
          rows="4"
          placeholder="Ask AI to analyze or update this workbook"
          value={draftValue}
          onChange={handleDraftChange}
          onKeyDown={handleDraftKeyDown}
        ></textarea>
        <input
          type="file"
          name="assistant-file"
          ref={fileInputRef}
          className="assistant-chat-file-input"
          tabIndex="-1"
          aria-hidden="true"
          onChange={handleFileChange}
        />
        <div className="assistant-chat-actions">
          <div className="assistant-chat-hint">
            Use Cmd/Ctrl+Enter to send. Ask for workbook edits, reports,
            schedules, formatting, or channel actions.
          </div>
          <button type="button" className="secondary" onClick={handleClear}>
            Clear
          </button>
          <button type="submit" disabled={isBusy || !draftValue.trim()}>
            Send
          </button>
        </div>
      </form>
    </div>
  );
}

export function WorkbookAddTabMenu({ workbookUiState, appRef }) {
  const menuUi =
    workbookUiState && workbookUiState.addTabMenuUi
      ? workbookUiState.addTabMenuUi
      : null;
  const isOpen = menuUi ? menuUi.open === true : false;
  const left = menuUi ? Number(menuUi.left || 0) : 0;
  const top = menuUi ? Number(menuUi.top || 0) : 0;

  const handlePick = (kind) => {
    const app = appRef && appRef.current ? appRef.current : null;
    if (!app) return;
    if (kind === 'report' && typeof app.addReportTab === 'function') {
      app.addReportTab();
    } else if (
      kind === 'perf' &&
      typeof app.addPerformanceTestTab === 'function'
    ) {
      app.addPerformanceTestTab();
    } else if (typeof app.addTab === 'function') {
      app.addTab();
    }
    if (typeof app.hideAddTabMenu === 'function') {
      app.hideAddTabMenu();
    }
  };

  return (
    <div
      className="add-tab-menu"
      hidden={!isOpen}
      style={{
        display: isOpen ? 'flex' : 'none',
        left: `${left}px`,
        top: `${top}px`,
      }}
    >
      <button type="button" className="add-tab-option" onClick={() => handlePick('sheet')}>
        Sheet
      </button>
      <button type="button" className="add-tab-option" onClick={() => handlePick('perf')}>
        Perf Sheet
      </button>
      <button type="button" className="add-tab-option" onClick={() => handlePick('report')}>
        Report
      </button>
    </div>
  );
}

export function WorkbookContextMenu({ workbookUiState, appRef }) {
  const menuUi =
    workbookUiState && workbookUiState.contextMenuUi
      ? workbookUiState.contextMenuUi
      : null;
  const isOpen = menuUi ? menuUi.open === true : false;
  const left = menuUi ? Number(menuUi.left || 0) : 0;
  const top = menuUi ? Number(menuUi.top || 0) : 0;
  const showCellActions = menuUi ? menuUi.showCellActions === true : false;

  const items = [
    { action: 'insert-row-before', label: 'Insert row before' },
    { action: 'insert-row-after', label: 'Insert row after' },
    { action: 'insert-col-before', label: 'Insert column before' },
    { action: 'insert-col-after', label: 'Insert column after' },
    { action: 'delete-row', label: 'Delete row' },
    { action: 'delete-col', label: 'Delete column' },
    { sep: true },
    { action: 'recalc', label: 'Re-calc', cellOnly: true },
    { action: 'schedule', label: 'Schedule', cellOnly: true },
    { action: 'copy', label: 'Copy' },
    { action: 'paste', label: 'Paste' },
  ];

  const handleAction = (action) => {
    const app = appRef && appRef.current ? appRef.current : null;
    if (!app || typeof app.runContextMenuAction !== 'function') return;
    app.hideContextMenu();
    app.runContextMenuAction(action);
  };

  return (
    <div
      className="sheet-context-menu"
      hidden={!isOpen}
      style={{
        display: isOpen ? 'flex' : 'none',
        left: `${left}px`,
        top: `${top}px`,
      }}
    >
      {items.map((item, index) => {
        if (item.sep) {
          return <div key={`sep-${index}`} className="sheet-context-sep" />;
        }
        if (item.cellOnly && !showCellActions) return null;
        return (
          <button
            key={item.action}
            type="button"
            className="sheet-context-item"
            onClick={() => handleAction(item.action)}
          >
            {item.label}
          </button>
        );
      })}
    </div>
  );
}

export function WorkbookScheduleDialog({ workbookUiState, appRef }) {
  const dialogUi =
    workbookUiState && workbookUiState.scheduleDialogUi
      ? workbookUiState.scheduleDialogUi
      : null;
  const isOpen = dialogUi ? dialogUi.open === true : false;
  const draft =
    dialogUi && dialogUi.draft && typeof dialogUi.draft === 'object'
      ? dialogUi.draft
      : {
          kind: 'once',
          datetime: '',
          time: '09:00',
          daysOfWeek: [1],
          dayOfMonth: '1',
          intervalMinutes: '60',
          cron: '',
          label: '',
        };
  const summary = dialogUi ? String(dialogUi.summary || '') : '';

  const updateDraft = (patch) => {
    const app = appRef && appRef.current ? appRef.current : null;
    if (!app || typeof app.updateScheduleDialogDraft !== 'function') return;
    app.updateScheduleDialogDraft(patch);
  };

  const handleClose = () => {
    const app = appRef && appRef.current ? appRef.current : null;
    if (!app || typeof app.hideScheduleDialog !== 'function') return;
    app.hideScheduleDialog();
  };

  const handleSave = () => {
    const app = appRef && appRef.current ? appRef.current : null;
    if (!app || typeof app.saveScheduleDialog !== 'function') return;
    app.saveScheduleDialog();
  };

  const handleClear = () => {
    const app = appRef && appRef.current ? appRef.current : null;
    if (!app || typeof app.clearScheduleDialog !== 'function') return;
    app.clearScheduleDialog();
  };

  const weekdays = [0, 1, 2, 3, 4, 5, 6];
  const weekdayLabels = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  const selectedDays = Array.isArray(draft.daysOfWeek) ? draft.daysOfWeek : [1];

  const showKind = (kind) => String(draft.kind || 'once') === kind;

  return (
    <div
      className="cell-schedule-overlay"
      hidden={!isOpen}
      style={{ display: isOpen ? 'flex' : 'none' }}
      onClick={(event) => {
        if (event.target === event.currentTarget) handleClose();
      }}
    >
      <div className="cell-schedule-modal" role="dialog" aria-modal="true" aria-labelledby="cell-schedule-title">
        <div className="cell-schedule-head">
          <h2 id="cell-schedule-title">Schedule Cell</h2>
          <button
            type="button"
            className="cell-schedule-close"
            aria-label="Close"
            onClick={handleClose}
          >
            ×
          </button>
        </div>
        <p className="cell-schedule-copy">
          Run this cell on the server using a one-time, recurring, or cron schedule.
        </p>
        <label className="cell-schedule-field">
          <span>Pattern</span>
          <select
            name="kind"
            value={String(draft.kind || 'once')}
            onChange={(event) => updateDraft({ kind: event.target.value })}
          >
            <option value="once">Once</option>
            <option value="daily">Daily</option>
            <option value="weekly">Weekly</option>
            <option value="monthly">Monthly</option>
            <option value="interval">Every N minutes</option>
            <option value="cron">Cron</option>
          </select>
        </label>
        {showKind('once') ? (
          <label className="cell-schedule-field">
            <span>Date &amp; time</span>
            <input
              name="datetime"
              type="datetime-local"
              value={String(draft.datetime || '')}
              onChange={(event) => updateDraft({ datetime: event.target.value })}
            />
          </label>
        ) : null}
        {showKind('daily') || showKind('weekly') || showKind('monthly') ? (
          <label className="cell-schedule-field">
            <span>Time</span>
            <input
              name="time"
              type="time"
              value={String(draft.time || '09:00')}
              onChange={(event) => updateDraft({ time: event.target.value })}
            />
          </label>
        ) : null}
        {showKind('weekly') ? (
          <div className="cell-schedule-field">
            <span>Weekdays</span>
            <div className="cell-schedule-weekdays">
              {weekdays.map((day) => {
                const checked = selectedDays.indexOf(day) !== -1;
                return (
                  <label key={day}>
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={(event) => {
                        const next = event.target.checked
                          ? selectedDays.concat(day)
                          : selectedDays.filter((value) => value !== day);
                        updateDraft({ daysOfWeek: next });
                      }}
                    />
                    <span>{weekdayLabels[day]}</span>
                  </label>
                );
              })}
            </div>
          </div>
        ) : null}
        {showKind('monthly') ? (
          <label className="cell-schedule-field">
            <span>Day of month</span>
            <input
              name="dayOfMonth"
              type="number"
              min="1"
              max="31"
              value={String(draft.dayOfMonth || '1')}
              onChange={(event) => updateDraft({ dayOfMonth: event.target.value })}
            />
          </label>
        ) : null}
        {showKind('interval') ? (
          <label className="cell-schedule-field">
            <span>Interval (minutes)</span>
            <input
              name="intervalMinutes"
              type="number"
              min="1"
              step="1"
              value={String(draft.intervalMinutes || '60')}
              onChange={(event) =>
                updateDraft({ intervalMinutes: event.target.value })
              }
            />
          </label>
        ) : null}
        {showKind('cron') ? (
          <label className="cell-schedule-field">
            <span>Cron expression</span>
            <input
              name="cron"
              type="text"
              placeholder="0 9 * * 1-5"
              value={String(draft.cron || '')}
              onChange={(event) => updateDraft({ cron: event.target.value })}
            />
          </label>
        ) : null}
        <label className="cell-schedule-field">
          <span>Label</span>
          <input
            name="label"
            type="text"
            placeholder="Morning refresh"
            value={String(draft.label || '')}
            onChange={(event) => updateDraft({ label: event.target.value })}
          />
        </label>
        <div className="cell-schedule-summary">{summary}</div>
        <div className="cell-schedule-actions">
          <button type="button" className="secondary" onClick={handleClear}>
            Clear
          </button>
          <button type="button" className="secondary" onClick={handleClose}>
            Cancel
          </button>
          <button type="button" onClick={handleSave}>
            Save
          </button>
        </div>
      </div>
    </div>
  );
}
