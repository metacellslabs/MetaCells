import { WorkbookReportShell } from './WorkbookReportShell.jsx';
import {
  WorkbookEditorOverlay,
  WorkbookSelectionOverlay,
  WorkbookFullscreenOverlay,
  WorkbookMentionAutocomplete,
} from './WorkbookOverlays.jsx';
import {
  WorkbookFormulaTrackerPanel,
  WorkbookAssistantPanel,
  WorkbookAddTabMenu,
  WorkbookContextMenu,
  WorkbookScheduleDialog,
} from './WorkbookPanels.jsx';
import { WorkbookTabBar } from './WorkbookShellBits.jsx';

export function SheetWorkbookViewport({
  workbookUiState,
  appRef,
  handlePublishReport,
  handleExportPdf,
}) {
  return (
    <>
      <div className="table-wrap">
        <table></table>
        <WorkbookSelectionOverlay workbookUiState={workbookUiState} appRef={appRef} />
        <WorkbookEditorOverlay workbookUiState={workbookUiState} />
      </div>
      <WorkbookMentionAutocomplete workbookUiState={workbookUiState} appRef={appRef} />
      <WorkbookAssistantPanel workbookUiState={workbookUiState} appRef={appRef} />
      <WorkbookFullscreenOverlay workbookUiState={workbookUiState} appRef={appRef} />
      <WorkbookFormulaTrackerPanel workbookUiState={workbookUiState} appRef={appRef} />
      <WorkbookAddTabMenu workbookUiState={workbookUiState} appRef={appRef} />
      <WorkbookContextMenu workbookUiState={workbookUiState} appRef={appRef} />
      <WorkbookScheduleDialog workbookUiState={workbookUiState} appRef={appRef} />
      <WorkbookReportShell
        workbookUiState={workbookUiState}
        appRef={appRef}
        onPublishReport={handlePublishReport}
        onExportPdf={handleExportPdf}
      />
      <WorkbookTabBar workbookUiState={workbookUiState} appRef={appRef} />
    </>
  );
}
