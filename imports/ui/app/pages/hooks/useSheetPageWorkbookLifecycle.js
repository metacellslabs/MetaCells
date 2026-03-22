import { Meteor } from 'meteor/meteor';
import { useEffect } from 'react';
import { mountSpreadsheetApp } from '../../../metacell/runtime/index.js';
import { decodeWorkbookDocument } from '../../../../api/sheets/workbook-codec.js';
import { createSheetDocStorage } from '../../../metacell/sheetDocStorage.js';

export function useSheetPageWorkbookLifecycle({
  sheetId,
  initialTabId,
  publishedMode,
  isLoading,
  sheet,
  availableChannels,
  workbookUiStoreRef,
  appRef,
  storageRef,
  cellContentStoreRef,
  lastWorkbookDocumentRef,
  lastWorkbookSyncKeyRef,
  pendingWorkbookDocumentRef,
  pendingWorkbookSyncKeyRef,
  remoteSyncTimerRef,
}) {
  const canApplyRemoteWorkbook = () => {
    if (!appRef.current || !storageRef.current) return false;
    if (
      typeof appRef.current.hasPendingLocalEdit === 'function' &&
      appRef.current.hasPendingLocalEdit()
    ) {
      return false;
    }
    if (
      storageRef.current &&
      typeof storageRef.current.hasPendingPersistence === 'function' &&
      storageRef.current.hasPendingPersistence()
    ) {
      return false;
    }
    return true;
  };

  const applyRemoteWorkbookDocument = (workbookDocument, syncKey) => {
    if (!appRef.current || !storageRef.current) return false;
    lastWorkbookDocumentRef.current = workbookDocument;
    lastWorkbookSyncKeyRef.current = syncKey;
    pendingWorkbookDocumentRef.current = null;
    pendingWorkbookSyncKeyRef.current = '';
    storageRef.current.replaceAll(decodeWorkbookDocument(workbookDocument));
    if (typeof appRef.current.renderCurrentSheetFromStorage === 'function') {
      appRef.current.renderCurrentSheetFromStorage();
    } else {
      appRef.current.computeAll();
    }
    return true;
  };

  const flushPendingRemoteWorkbook = () => {
    if (!pendingWorkbookDocumentRef.current) return false;
    if (!canApplyRemoteWorkbook()) return false;
    return applyRemoteWorkbookDocument(
      pendingWorkbookDocumentRef.current,
      pendingWorkbookSyncKeyRef.current,
    );
  };

  useEffect(() => {
    document.body.classList.add(
      publishedMode ? 'route-published-report' : 'route-sheet',
    );
    document.body.classList.remove('route-home');
    document.body.classList.remove('route-settings');
    return () => {
      document.body.classList.remove('route-sheet');
      document.body.classList.remove('route-published-report');
    };
  }, [publishedMode]);

  useEffect(() => {
    if (isLoading || !sheet || appRef.current) return;
    const workbookDocument = sheet.workbook || {};
    const workbook = decodeWorkbookDocument(workbookDocument);
    storageRef.current = createSheetDocStorage(sheetId, workbook);
    lastWorkbookDocumentRef.current = workbookDocument;
    lastWorkbookSyncKeyRef.current = String(
      sheet && sheet.updatedAt && typeof sheet.updatedAt.getTime === 'function'
        ? sheet.updatedAt.getTime()
        : sheet && sheet.updatedAt
          ? sheet.updatedAt
          : '',
    );
    appRef.current = mountSpreadsheetApp({
      storage: storageRef.current,
      sheetDocumentId: sheetId,
      initialSheetId: initialTabId,
      availableChannels,
      uiStore: workbookUiStoreRef.current,
      cellContentStore: null,
      useReactShellTabs: true,
      useReactShellControls: true,
      onActiveSheetChange: (nextTabId) => {
        const nextPath = publishedMode
          ? `/report/${encodeURIComponent(sheetId)}/${encodeURIComponent(nextTabId || initialTabId || '')}`
          : nextTabId
            ? `/metacell/${encodeURIComponent(sheetId)}/${encodeURIComponent(nextTabId)}`
            : `/metacell/${encodeURIComponent(sheetId)}`;
        if (window.location.pathname !== nextPath) {
          window.history.replaceState({}, '', nextPath);
        }
      },
    });

    return () => {
      if (remoteSyncTimerRef.current) {
        clearInterval(remoteSyncTimerRef.current);
        remoteSyncTimerRef.current = null;
      }
      if (appRef.current && typeof appRef.current.destroy === 'function') {
        appRef.current.destroy();
      }
      appRef.current = null;
      if (
        cellContentStoreRef.current &&
        typeof cellContentStoreRef.current.clear === 'function'
      ) {
        cellContentStoreRef.current.clear();
      }
      storageRef.current = null;
      lastWorkbookDocumentRef.current = null;
      lastWorkbookSyncKeyRef.current = '';
      pendingWorkbookDocumentRef.current = null;
      pendingWorkbookSyncKeyRef.current = '';
    };
  }, [isLoading, sheetId, initialTabId, publishedMode]);

  useEffect(() => {
    if (remoteSyncTimerRef.current) {
      clearInterval(remoteSyncTimerRef.current);
      remoteSyncTimerRef.current = null;
    }
    remoteSyncTimerRef.current = Meteor.setInterval(() => {
      flushPendingRemoteWorkbook();
    }, 250);
    return () => {
      if (remoteSyncTimerRef.current) {
        clearInterval(remoteSyncTimerRef.current);
        remoteSyncTimerRef.current = null;
      }
    };
  }, []);

  useEffect(() => {
    if (!appRef.current || typeof appRef.current.setAvailableChannels !== 'function') {
      return;
    }
    appRef.current.setAvailableChannels(availableChannels);
  }, [JSON.stringify(availableChannels)]);

  useEffect(() => {
    if (!appRef.current || !initialTabId) return;
    if (typeof appRef.current.switchToSheet !== 'function') return;
    if (
      !(
        typeof appRef.current.activeSheetId === 'string' &&
        appRef.current.activeSheetId === initialTabId
      )
    ) {
      appRef.current.switchToSheet(initialTabId);
    }
    if (publishedMode && typeof appRef.current.setReportMode === 'function') {
      appRef.current.setReportMode('view');
    }
  }, [initialTabId, publishedMode]);

  useEffect(() => {
    if (isLoading || !sheet || !appRef.current || !storageRef.current) return;
    const nextWorkbookDocument = sheet.workbook || {};
    const nextWorkbookSyncKey = String(
      sheet && sheet.updatedAt && typeof sheet.updatedAt.getTime === 'function'
        ? sheet.updatedAt.getTime()
        : sheet && sheet.updatedAt
          ? sheet.updatedAt
          : '',
    );
    if (
      nextWorkbookDocument === lastWorkbookDocumentRef.current &&
      nextWorkbookSyncKey === lastWorkbookSyncKeyRef.current
    ) {
      return;
    }
    if (!canApplyRemoteWorkbook()) {
      pendingWorkbookDocumentRef.current = nextWorkbookDocument;
      pendingWorkbookSyncKeyRef.current = nextWorkbookSyncKey;
      return;
    }
    applyRemoteWorkbookDocument(nextWorkbookDocument, nextWorkbookSyncKey);
  }, [isLoading, sheet]);
}
