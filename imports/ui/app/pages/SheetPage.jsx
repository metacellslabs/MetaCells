import { Meteor } from 'meteor/meteor';
import { useTracker } from 'meteor/react-meteor-data';
import { useRef } from 'react';
import {
  createCellContentStore,
} from '../../metacell/runtime/cell-content-store.js';
import {
  createWorkbookUiStore,
  useWorkbookUiState,
} from '../../metacell/runtime/workbook-ui-store.js';
import { AppSettings, DEFAULT_SETTINGS_ID } from '../../../api/settings/index.js';
import { Sheets } from '../../../api/sheets/index.js';
import {
  WorkbookFormulaBar,
  SheetWorkbookViewport,
  WorkbookShellRoot,
} from '../components/workbook/WorkbookChrome.jsx';
import { SheetFormulaBarFormatRow } from '../components/workbook/SheetFormulaBarFormatRow.jsx';
import { SheetFormulaBarMainRow } from '../components/workbook/SheetFormulaBarMainRow.jsx';
import { useSheetPageActions } from './hooks/useSheetPageActions.js';
import { useSheetPageFormulaBarState } from './hooks/useSheetPageFormulaBarState.js';
import { useSheetPageWorkbookLifecycle } from './hooks/useSheetPageWorkbookLifecycle.js';

export function SheetPage({
  sheetId,
  initialTabId,
  onOpenHelp,
  publishedMode = false,
}) {
  const workbookUiStoreRef = useRef(null);
  const cellContentStoreRef = useRef(null);
  if (!workbookUiStoreRef.current) {
    workbookUiStoreRef.current = createWorkbookUiStore();
  }
  if (!cellContentStoreRef.current) {
    cellContentStoreRef.current = createCellContentStore();
  }
  const appRef = useRef(null);
  const storageRef = useRef(null);
  const lastWorkbookDocumentRef = useRef(null);
  const lastWorkbookSyncKeyRef = useRef('');
  const pendingWorkbookDocumentRef = useRef(null);
  const pendingWorkbookSyncKeyRef = useRef('');
  const remoteSyncTimerRef = useRef(null);
  const workbookUiState = useWorkbookUiState(workbookUiStoreRef.current);
  const formulaBarUi =
    workbookUiState && workbookUiState.formulaBarUi
      ? workbookUiState.formulaBarUi
      : {
          disabled: true,
          currentFormat: 'text',
          align: 'left',
          wrapText: false,
          bold: false,
        italic: false,
        backgroundColor: '',
        bordersPreset: 'none',
        fontFamily: 'default',
          fontSize: 14,
          decimalsDisabled: true,
          fontSizeDisabled: true,
        };
  const {
    cellNameValue,
    setCellNameValue,
    bgColorCustomValue,
    setBgColorCustomValue,
    cellNameInputRef,
  } = useSheetPageFormulaBarState({
    workbookUiState,
    formulaBarUi,
  });

  const { isLoading, sheet, settings } = useTracker(() => {
    const handle = Meteor.subscribe('sheets.one', sheetId);
    const settingsHandle = Meteor.subscribe('settings.default');
    return {
      isLoading: !handle.ready() || !settingsHandle.ready(),
      sheet: Sheets.findOne(sheetId),
      settings: AppSettings.findOne(DEFAULT_SETTINGS_ID),
    };
  }, [sheetId]);

  const availableChannels = Array.isArray(settings && settings.communicationChannels)
    ? settings.communicationChannels
        .filter((channel) => channel && channel.enabled !== false)
        .map((channel) => ({
          id: String(channel.id || ''),
          label: String(channel.label || '').trim(),
        }))
        .filter((channel) => channel.label)
    : [];
  useSheetPageWorkbookLifecycle({
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
  });
  const {
    workbookName,
    setWorkbookName,
    isRenaming,
    commitWorkbookRename,
    handlePublishReport,
    handleUpdateAI,
    handleToggleCellBorders,
    handleToggleBgColor,
    handleToggleCellFormat,
    handleToggleCellFontFamily,
    handleToggleAIMode,
    handleToggleDisplayMode,
    handleSetDisplayMode,
    handleSetAIMode,
    handleToggleNamedCellJump,
    handleNamedCellJumpSelect,
    handleNamedCellJumpHover,
    handleExportPdf,
  } = useSheetPageActions({
    appRef,
    sheet,
    sheetId,
  });

  if (isLoading) {
    return <main className="sheet-loading">Loading metacell...</main>;
  }

  if (!sheet) {
    return (
      <main className="sheet-loading">
        <p>Metacell not found.</p>
        <a href="/">← Back</a>
      </main>
    );
  }

  return (
    <WorkbookShellRoot publishedMode={publishedMode} workbookUiState={workbookUiState}>
      <WorkbookFormulaBar workbookUiState={workbookUiState}>
        <SheetFormulaBarMainRow
          workbookName={workbookName}
          setWorkbookName={setWorkbookName}
          commitWorkbookRename={commitWorkbookRename}
          isRenaming={isRenaming}
          sheetName={sheet.name}
          cellNameInputRef={cellNameInputRef}
          cellNameValue={cellNameValue}
          setCellNameValue={setCellNameValue}
          workbookUiState={workbookUiState}
          formulaBarUi={formulaBarUi}
          handleToggleNamedCellJump={handleToggleNamedCellJump}
          handleNamedCellJumpHover={handleNamedCellJumpHover}
          handleNamedCellJumpSelect={handleNamedCellJumpSelect}
          handleToggleAIMode={handleToggleAIMode}
          handleSetAIMode={handleSetAIMode}
          handleToggleDisplayMode={handleToggleDisplayMode}
          handleSetDisplayMode={handleSetDisplayMode}
          handleUpdateAI={handleUpdateAI}
          onOpenHelp={onOpenHelp}
        />
        <SheetFormulaBarFormatRow
          formulaBarUi={formulaBarUi}
          bgColorCustomValue={bgColorCustomValue}
          setBgColorCustomValue={setBgColorCustomValue}
          handleToggleCellFormat={handleToggleCellFormat}
          handleToggleCellBorders={handleToggleCellBorders}
          handleToggleBgColor={handleToggleBgColor}
          handleToggleCellFontFamily={handleToggleCellFontFamily}
        />
      </WorkbookFormulaBar>
      <SheetWorkbookViewport
        workbookUiState={workbookUiState}
        appRef={appRef}
        handlePublishReport={handlePublishReport}
        handleExportPdf={handleExportPdf}
      />
    </WorkbookShellRoot>
  );
}
