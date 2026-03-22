import { useEffect, useRef, useState } from 'react';

export function useSheetPageFormulaBarState({ workbookUiState, formulaBarUi }) {
  const [cellNameValue, setCellNameValue] = useState('');
  const [bgColorCustomValue, setBgColorCustomValue] = useState('#fff7cc');
  const cellNameInputRef = useRef(null);

  useEffect(() => {
    const input = cellNameInputRef.current;
    const nextValue = String(workbookUiState.cellNameValue || '');
    if (!input) {
      setCellNameValue(nextValue);
      return;
    }
    if (typeof document !== 'undefined' && document.activeElement === input) {
      return;
    }
    input.value = nextValue;
    setCellNameValue(nextValue);
  }, [workbookUiState.cellNameValue]);

  useEffect(() => {
    setBgColorCustomValue(String(formulaBarUi.customBgColorValue || '#fff7cc'));
  }, [formulaBarUi.customBgColorValue]);

  return {
    cellNameValue,
    setCellNameValue,
    bgColorCustomValue,
    setBgColorCustomValue,
    cellNameInputRef,
  };
}
