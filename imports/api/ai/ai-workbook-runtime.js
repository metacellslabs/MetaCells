import { GRID_COLS, GRID_ROWS } from '../../engine/constants.js';
import {
  buildListSystemPrompt,
  buildTableSystemPrompt,
} from '../../ui/metacell/runtime/ai-prompts.js';
import { createEmptyWorkbook } from '../../engine/workbook-storage-adapter.js';

export function htmlToMarkdown(html) {
  return String(html == null ? '' : html)
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/<style[\s\S]*?<\/style>/gi, '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export function columnIndexToLabel(index) {
  let n = index;
  let label = '';
  while (n > 0) {
    const rem = (n - 1) % 26;
    label = String.fromCharCode(65 + rem) + label;
    n = Math.floor((n - 1) / 26);
  }
  return label;
}

export function columnLabelToIndex(label) {
  let result = 0;
  for (let i = 0; i < label.length; i += 1) {
    result = result * 26 + (label.charCodeAt(i) - 64);
  }
  return result;
}

export function buildCellIds(workbookData) {
  const ids = [];
  let maxRow = GRID_ROWS;
  let maxCol = GRID_COLS;
  const workbook =
    workbookData && typeof workbookData === 'object'
      ? workbookData
      : createEmptyWorkbook();
  const sheets =
    workbook.sheets && typeof workbook.sheets === 'object'
      ? workbook.sheets
      : {};

  Object.keys(sheets).forEach((sheetId) => {
    const cells =
      sheets[sheetId] && typeof sheets[sheetId].cells === 'object'
        ? sheets[sheetId].cells
        : {};
    Object.keys(cells).forEach((cellId) => {
      const match = /^([A-Za-z]+)([0-9]+)$/.exec(
        String(cellId || '').toUpperCase(),
      );
      if (!match) return;
      const col = columnLabelToIndex(String(match[1]).toUpperCase());
      const row = parseInt(match[2], 10);
      if (!Number.isNaN(col) && col > maxCol) maxCol = col;
      if (!Number.isNaN(row) && row > maxRow) maxRow = row;
    });
  });

  for (let row = 1; row <= maxRow; row += 1) {
    for (let col = 1; col <= maxCol; col += 1) {
      ids.push(`${columnIndexToLabel(col)}${row}`);
    }
  }

  return ids;
}

export function buildListInstruction(count) {
  return buildListSystemPrompt(count);
}

export function buildTableInstruction(colsLimit, rowsLimit) {
  return buildTableSystemPrompt(colsLimit, rowsLimit);
}

export function parseCellId(cellId) {
  const match = /^([A-Za-z]+)([0-9]+)$/.exec(
    String(cellId || '').toUpperCase(),
  );
  if (!match) return null;
  return {
    col: columnLabelToIndex(String(match[1]).toUpperCase()),
    row: parseInt(match[2], 10) || 0,
  };
}
