export {
  applyAutoResort,
  compareSortValues,
  getSortState,
  normalizeSortValue,
  setupColumnSort,
  sortRowsByColumn,
  toggleSortByColumn,
  updateSortIcons,
} from './structure-sort-runtime.js';
export {
  deleteColumnsAtContext,
  deleteRowsAtContext,
  getSelectedColumnBounds,
  getSelectedRowBounds,
  insertColumnsAtContext,
  insertRowsAtContext,
  remapNamedCellsForStructureEdit,
} from './structure-edit-runtime.js';

export function setupGridResizing(app) {
  app.grid.installResizeHandles(
    (colIndex, width) =>
      app.storage.setColumnWidth(app.activeSheetId, colIndex, width),
    (rowIndex, height) =>
      app.storage.setRowHeight(app.activeSheetId, rowIndex, height),
    arguments.length > 1 ? arguments[1] : null,
  );
}
