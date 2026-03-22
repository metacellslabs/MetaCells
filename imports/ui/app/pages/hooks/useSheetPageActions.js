import { Meteor } from 'meteor/meteor';
import { useEffect, useState } from 'react';

export function useSheetPageActions({ appRef, sheet, sheetId }) {
  const [workbookName, setWorkbookName] = useState('');
  const [isRenaming, setIsRenaming] = useState(false);

  useEffect(() => {
    if (!sheet) return;
    setWorkbookName(String(sheet.name || ''));
  }, [sheet && sheet.name]);

  const commitWorkbookRename = () => {
    if (!sheet || isRenaming) return;
    const nextName = String(workbookName || '').trim();
    const currentName = String(sheet.name || '');
    if (!nextName) {
      setWorkbookName(currentName);
      return;
    }
    if (nextName === currentName) return;
    setIsRenaming(true);
    Meteor.callAsync('sheets.rename', sheetId, nextName)
      .then(() => {
        setIsRenaming(false);
      })
      .catch((error) => {
        setIsRenaming(false);
        setWorkbookName(currentName);
        window.alert(error.reason || error.message || 'Failed to rename metacell');
      });
  };

  const handlePublishReport = () => {
    if (!appRef.current || typeof appRef.current.publishCurrentReport !== 'function') return;
    appRef.current.publishCurrentReport();
  };

  const handleUpdateAI = () => {
    if (!appRef.current || typeof appRef.current.runManualAIUpdate !== 'function') return;
    appRef.current.runManualAIUpdate();
  };

  const handleToggleCellBorders = () => {
    if (!appRef.current || typeof appRef.current.toggleCellBordersPicker !== 'function') {
      return;
    }
    appRef.current.toggleCellBordersPicker();
  };

  const handleToggleBgColor = () => {
    if (!appRef.current || typeof appRef.current.toggleBgColorPicker !== 'function') {
      return;
    }
    appRef.current.toggleBgColorPicker();
  };

  const handleToggleCellFormat = () => {
    if (!appRef.current || typeof appRef.current.toggleCellFormatPicker !== 'function') {
      return;
    }
    appRef.current.toggleCellFormatPicker();
  };

  const handleToggleCellFontFamily = () => {
    if (!appRef.current || typeof appRef.current.toggleCellFontFamilyPicker !== 'function') {
      return;
    }
    appRef.current.toggleCellFontFamilyPicker();
  };

  const handleToggleAIMode = () => {
    if (!appRef.current || typeof appRef.current.toggleAIModePicker !== 'function') {
      return;
    }
    appRef.current.toggleAIModePicker();
  };

  const handleToggleDisplayMode = () => {
    if (!appRef.current || typeof appRef.current.toggleDisplayModePicker !== 'function') {
      return;
    }
    appRef.current.toggleDisplayModePicker();
  };

  const handleSetDisplayMode = (event, mode) => {
    if (event && typeof event.preventDefault === 'function') {
      event.preventDefault();
    }
    if (event && typeof event.stopPropagation === 'function') {
      event.stopPropagation();
    }
    if (!appRef.current || typeof appRef.current.setDisplayMode !== 'function') {
      return;
    }
    appRef.current.setDisplayMode(mode);
    if (typeof appRef.current.publishUiState === 'function') {
      appRef.current.publishUiState();
    }
    if (typeof appRef.current.toggleDisplayModePicker === 'function') {
      const isOpen = !!(
        appRef.current.formulaBarUiState &&
        appRef.current.formulaBarUiState.displayModePickerOpen
      );
      if (isOpen) {
        appRef.current.toggleDisplayModePicker();
      }
    }
  };

  const handleSetAIMode = (event, mode) => {
    if (event && typeof event.preventDefault === 'function') {
      event.preventDefault();
    }
    if (event && typeof event.stopPropagation === 'function') {
      event.stopPropagation();
    }
    if (!appRef.current || typeof appRef.current.setAIMode !== 'function') {
      return;
    }
    appRef.current.setAIMode(mode);
    if (typeof appRef.current.publishUiState === 'function') {
      appRef.current.publishUiState();
    }
    if (typeof appRef.current.toggleAIModePicker === 'function') {
      const isOpen = !!(
        appRef.current.aiModeUiState && appRef.current.aiModeUiState.pickerOpen
      );
      if (isOpen) {
        appRef.current.toggleAIModePicker();
      }
    }
  };

  const handleToggleNamedCellJump = () => {
    if (!appRef.current || typeof appRef.current.toggleNamedCellJumpPicker !== 'function') {
      return;
    }
    appRef.current.toggleNamedCellJumpPicker();
  };

  const handleNamedCellJumpSelect = (name) => {
    if (!appRef.current || typeof appRef.current.navigateToNamedCell !== 'function') {
      return;
    }
    appRef.current.navigateToNamedCell(name);
  };

  const handleNamedCellJumpHover = (index) => {
    if (!appRef.current || typeof appRef.current.setNamedCellJumpActiveIndex !== 'function') {
      return;
    }
    appRef.current.setNamedCellJumpActiveIndex(index);
  };

  const handleExportPdf = () => {
    if (!appRef.current || typeof appRef.current.exportCurrentReportPdf !== 'function') return;
    appRef.current.exportCurrentReportPdf();
  };

  return {
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
  };
}
