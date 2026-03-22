import { useSyncExternalStore } from 'react';

function normalizeSnapshot(snapshot) {
  var source = snapshot && typeof snapshot === 'object' ? snapshot : {};
  return {
    tabs: Array.isArray(source.tabs) ? source.tabs.slice() : [],
    visibleSheetId: String(source.visibleSheetId || ''),
    editingOwnerSheetId: String(source.editingOwnerSheetId || ''),
    activeCellId: String(source.activeCellId || ''),
    activeInputId: String(source.activeInputId || ''),
    selectionAnchorId: String(source.selectionAnchorId || ''),
    selectionRange:
      source.selectionRange && typeof source.selectionRange === 'object'
        ? { ...source.selectionRange }
        : null,
    selectionUi:
      source.selectionUi && typeof source.selectionUi === 'object'
        ? {
            ...source.selectionUi,
            activeRect:
              source.selectionUi.activeRect &&
              typeof source.selectionUi.activeRect === 'object'
                ? { ...source.selectionUi.activeRect }
                : null,
            rangeRect:
              source.selectionUi.rangeRect &&
              typeof source.selectionUi.rangeRect === 'object'
                ? { ...source.selectionUi.rangeRect }
                : null,
            fillHandleRect:
              source.selectionUi.fillHandleRect &&
              typeof source.selectionUi.fillHandleRect === 'object'
                ? { ...source.selectionUi.fillHandleRect }
                : null,
            dependencyRects: Array.isArray(source.selectionUi.dependencyRects)
              ? source.selectionUi.dependencyRects.map(function (item) {
                  return item && typeof item === 'object' ? { ...item } : item;
                })
              : [],
            headerRects:
              source.selectionUi.headerRects &&
              typeof source.selectionUi.headerRects === 'object'
                ? {
                    ...source.selectionUi.headerRects,
                    activeCols: Array.isArray(source.selectionUi.headerRects.activeCols)
                      ? source.selectionUi.headerRects.activeCols.map(function (item) {
                          return item && typeof item === 'object' ? { ...item } : item;
                        })
                      : [],
                    activeRows: Array.isArray(source.selectionUi.headerRects.activeRows)
                      ? source.selectionUi.headerRects.activeRows.map(function (item) {
                          return item && typeof item === 'object' ? { ...item } : item;
                        })
                      : [],
                    selectedCols: Array.isArray(source.selectionUi.headerRects.selectedCols)
                      ? source.selectionUi.headerRects.selectedCols.map(function (item) {
                          return item && typeof item === 'object' ? { ...item } : item;
                        })
                      : [],
                    selectedRows: Array.isArray(source.selectionUi.headerRects.selectedRows)
                      ? source.selectionUi.headerRects.selectedRows.map(function (item) {
                          return item && typeof item === 'object' ? { ...item } : item;
                        })
                      : [],
                    dependencyCols: Array.isArray(source.selectionUi.headerRects.dependencyCols)
                      ? source.selectionUi.headerRects.dependencyCols.map(function (item) {
                          return item && typeof item === 'object' ? { ...item } : item;
                        })
                      : [],
                    dependencyRows: Array.isArray(source.selectionUi.headerRects.dependencyRows)
                      ? source.selectionUi.headerRects.dependencyRows.map(function (item) {
                          return item && typeof item === 'object' ? { ...item } : item;
                        })
                      : [],
                    selectedCorner:
                      source.selectionUi.headerRects.selectedCorner &&
                      typeof source.selectionUi.headerRects.selectedCorner === 'object'
                        ? { ...source.selectionUi.headerRects.selectedCorner }
                        : null,
                  }
                : null,
          }
        : null,
    selectionFillRange:
      source.selectionFillRange && typeof source.selectionFillRange === 'object'
        ? { ...source.selectionFillRange }
        : null,
    crossSheetPickContext:
      source.crossSheetPickContext && typeof source.crossSheetPickContext === 'object'
        ? { ...source.crossSheetPickContext }
        : null,
    editingSession:
      source.editingSession && typeof source.editingSession === 'object'
        ? { ...source.editingSession }
        : null,
    formulaValue: String(source.formulaValue || ''),
    cellNameValue: String(source.cellNameValue || ''),
    namedCellJumpUi:
      source.namedCellJumpUi && typeof source.namedCellJumpUi === 'object'
        ? {
            ...source.namedCellJumpUi,
            items: Array.isArray(source.namedCellJumpUi.items)
              ? source.namedCellJumpUi.items.map(function (item) {
                  return item && typeof item === 'object' ? { ...item } : item;
                })
              : [],
          }
        : null,
    aiModeUi:
      source.aiModeUi && typeof source.aiModeUi === 'object'
        ? { ...source.aiModeUi }
        : null,
    formulaBarUi:
      source.formulaBarUi && typeof source.formulaBarUi === 'object'
        ? {
            ...source.formulaBarUi,
            recentBgColors: Array.isArray(source.formulaBarUi.recentBgColors)
              ? source.formulaBarUi.recentBgColors.slice()
              : [],
          }
        : null,
    editorOverlayUi:
      source.editorOverlayUi && typeof source.editorOverlayUi === 'object'
        ? { ...source.editorOverlayUi }
        : null,
    mentionAutocompleteUi:
      source.mentionAutocompleteUi &&
      typeof source.mentionAutocompleteUi === 'object'
        ? {
            ...source.mentionAutocompleteUi,
            items: Array.isArray(source.mentionAutocompleteUi.items)
              ? source.mentionAutocompleteUi.items.map(function (item) {
                  return item && typeof item === 'object' ? { ...item } : item;
                })
              : [],
          }
        : null,
    fullscreenUi:
      source.fullscreenUi && typeof source.fullscreenUi === 'object'
        ? { ...source.fullscreenUi }
        : null,
    formulaTrackerUi:
      source.formulaTrackerUi && typeof source.formulaTrackerUi === 'object'
        ? {
            ...source.formulaTrackerUi,
            entries: Array.isArray(source.formulaTrackerUi.entries)
              ? source.formulaTrackerUi.entries.map(function (item) {
                  return item && typeof item === 'object' ? { ...item } : item;
                })
              : [],
          }
        : null,
    assistantUi:
      source.assistantUi && typeof source.assistantUi === 'object'
        ? {
            ...source.assistantUi,
            providers: Array.isArray(source.assistantUi.providers)
              ? source.assistantUi.providers.map(function (item) {
                  return item && typeof item === 'object' ? { ...item } : item;
                })
              : [],
            uploads: Array.isArray(source.assistantUi.uploads)
              ? source.assistantUi.uploads.map(function (item) {
                  return item && typeof item === 'object' ? { ...item } : item;
                })
              : [],
            messages: Array.isArray(source.assistantUi.messages)
              ? source.assistantUi.messages.map(function (item) {
                  return item && typeof item === 'object' ? { ...item } : item;
                })
              : [],
            activity: Array.isArray(source.assistantUi.activity)
              ? source.assistantUi.activity.map(function (item) {
                  return item && typeof item === 'object'
                    ? {
                        ...item,
                        toolResults: Array.isArray(item.toolResults)
                          ? item.toolResults.map(function (result) {
                              return result && typeof result === 'object'
                                ? { ...result }
                                : result;
                            })
                          : [],
                      }
                    : item;
                })
              : [],
          }
        : null,
    scheduleDialogUi:
      source.scheduleDialogUi && typeof source.scheduleDialogUi === 'object'
        ? {
            ...source.scheduleDialogUi,
            draft:
              source.scheduleDialogUi.draft &&
              typeof source.scheduleDialogUi.draft === 'object'
                ? { ...source.scheduleDialogUi.draft }
                : null,
          }
        : null,
    addTabMenuUi:
      source.addTabMenuUi && typeof source.addTabMenuUi === 'object'
        ? { ...source.addTabMenuUi }
        : null,
    contextMenuUi:
      source.contextMenuUi && typeof source.contextMenuUi === 'object'
        ? { ...source.contextMenuUi }
        : null,
    displayMode: String(source.displayMode || 'values'),
    reportMode: String(source.reportMode || 'edit'),
    isReportActive: source.isReportActive === true,
    reportUi:
      source.reportUi && typeof source.reportUi === 'object'
        ? {
            ...source.reportUi,
            render:
              source.reportUi.render && typeof source.reportUi.render === 'object'
                ? { ...source.reportUi.render }
                : null,
            toolbar:
              source.reportUi.toolbar &&
              typeof source.reportUi.toolbar === 'object'
                ? {
                    ...source.reportUi.toolbar,
                    selectionInside:
                      source.reportUi.toolbar.selectionInside === true,
                    canExecCommand:
                      source.reportUi.toolbar.canExecCommand === true,
                    commands:
                      source.reportUi.toolbar.commands &&
                      typeof source.reportUi.toolbar.commands === 'object'
                        ? { ...source.reportUi.toolbar.commands }
                        : null,
                  }
                : null,
          }
        : null,
  };
}

export function createWorkbookUiStore(initialSnapshot) {
  var currentSnapshot = normalizeSnapshot(initialSnapshot);
  var listeners = new Set();

  return {
    getSnapshot: function () {
      return currentSnapshot;
    },
    subscribe: function (listener) {
      if (typeof listener !== 'function') return function () {};
      listeners.add(listener);
      return function () {
        listeners.delete(listener);
      };
    },
    publish: function (nextSnapshot) {
      currentSnapshot = normalizeSnapshot(nextSnapshot);
      listeners.forEach(function (listener) {
        try {
          listener();
        } catch (error) {}
      });
      return currentSnapshot;
    },
  };
}

export function useWorkbookUiState(store) {
  var fallbackStore = {
    getSnapshot: function () {
      return normalizeSnapshot(null);
    },
    subscribe: function () {
      return function () {};
    },
  };
  var targetStore = store || fallbackStore;
  return useSyncExternalStore(
    targetStore.subscribe,
    targetStore.getSnapshot,
    targetStore.getSnapshot,
  );
}
