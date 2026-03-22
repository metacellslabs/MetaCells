import { normalizeCellSchedule } from '../lib/cell-schedule.js';
import {
  deepClone,
  isPlainObject,
  normalizeChannelFeedMeta,
  normalizeCellRecord,
} from './workbook-storage-core.js';

export function installWorkbookStorageCellMethods(WorkbookStorageAdapter) {
  Object.assign(WorkbookStorageAdapter.prototype, {
    listSheetIds() {
      return Object.keys(this.workbook.sheets || {});
    },

    listCellIds(sheetId) {
      var sheet = this.ensureSheet(sheetId);
      return sheet ? Object.keys(sheet.cells || {}) : [];
    },

    getCellRecord(sheetId, cellId) {
      var sheet = this.ensureSheet(sheetId);
      if (!sheet) return null;
      var id = String(cellId || '').toUpperCase();
      return isPlainObject(sheet.cells[id]) ? sheet.cells[id] : null;
    },

    getCellDisplayValue(sheetId, cellId) {
      var cell = this.getCellRecord(sheetId, cellId);
      if (!cell) return '';
      if (String(cell.displayValue == null ? '' : cell.displayValue) !== '') {
        return String(cell.displayValue == null ? '' : cell.displayValue);
      }
      return String(cell.value == null ? '' : cell.value);
    },

    getCellComputedValue(sheetId, cellId) {
      var cell = this.getCellRecord(sheetId, cellId);
      if (!cell) return '';
      return String(cell.value == null ? '' : cell.value);
    },

    getCellState(sheetId, cellId) {
      var cell = this.getCellRecord(sheetId, cellId);
      if (!cell) return '';
      return String(cell.state || '');
    },

    getCellError(sheetId, cellId) {
      var cell = this.getCellRecord(sheetId, cellId);
      if (!cell) return '';
      return String(cell.error || '');
    },

    getCellProcessedChannelEventIds(sheetId, cellId) {
      var cell = this.getCellRecord(sheetId, cellId);
      if (!cell) return {};
      return isPlainObject(cell.lastProcessedChannelEventIds)
        ? deepClone(cell.lastProcessedChannelEventIds)
        : {};
    },

    getCellVersionInfo(sheetId, cellId) {
      var cell = this.getCellRecord(sheetId, cellId);
      if (!cell) {
        return {
          sourceVersion: 0,
          computedVersion: 0,
          dependencyVersion: 0,
          dependencySignature: '',
        };
      }
      return {
        sourceVersion: Number(cell.sourceVersion) || Number(cell.version) || 0,
        computedVersion: Number(cell.computedVersion) || 0,
        dependencyVersion: Number(cell.dependencyVersion) || 0,
        dependencySignature: String(cell.dependencySignature || ''),
      };
    },

    getCellSource(sheetId, cellId) {
      var cell = this.getCellRecord(sheetId, cellId);
      return cell ? String(cell.source || '') : '';
    },

    getCellFormat(sheetId, cellId) {
      var cell = this.getCellRecord(sheetId, cellId);
      return cell ? String(cell.format || 'text') : 'text';
    },

    getCellPresentation(sheetId, cellId) {
      var cell = this.getCellRecord(sheetId, cellId);
      return {
        format: cell ? String(cell.format || 'text') : 'text',
        align: cell ? String(cell.align || 'left') : 'left',
        wrapText: !!(cell && cell.wrapText === true),
        bold: !!(cell && cell.bold === true),
        italic: !!(cell && cell.italic === true),
        decimalPlaces:
          cell && Number.isInteger(cell.decimalPlaces)
            ? Math.max(0, Math.min(6, cell.decimalPlaces))
            : null,
        backgroundColor: cell ? String(cell.backgroundColor || '') : '',
        fontFamily: cell ? String(cell.fontFamily || 'default') : 'default',
        fontSize:
          cell && Number.isFinite(cell.fontSize)
            ? Math.max(10, Math.min(28, Number(cell.fontSize)))
            : 14,
        borders:
          cell && isPlainObject(cell.borders)
            ? {
                top: cell.borders.top === true,
                right: cell.borders.right === true,
                bottom: cell.borders.bottom === true,
                left: cell.borders.left === true,
              }
            : {
                top: false,
                right: false,
                bottom: false,
                left: false,
              },
      };
    },

    getCellSchedule(sheetId, cellId) {
      var cell = this.getCellRecord(sheetId, cellId);
      return cell ? normalizeCellSchedule(cell.schedule) : null;
    },

    setCellSource(sheetId, cellId, value, meta) {
      var sheet = this.ensureSheet(sheetId);
      if (!sheet) return;
      var id = String(cellId || '').toUpperCase();
      var previous = this.getCellRecord(sheetId, id);
      var next = normalizeCellRecord(value, previous);
      var generatedBy =
        meta && meta.generatedBy ? String(meta.generatedBy).toUpperCase() : '';
      next.generatedBy =
        generatedBy || String((previous && previous.generatedBy) || '');
      if (
        !generatedBy &&
        previous &&
        previous.generatedBy &&
        String(value || '') === ''
      ) {
        next.generatedBy = '';
      }
      if (
        (!meta || meta.preserveSchedule !== true) &&
        previous &&
        previous.schedule &&
        String(previous.source || '') !== String(next.source || '')
      ) {
        var previousSchedule = normalizeCellSchedule(previous.schedule);
        if (previousSchedule && previousSchedule.origin === 'detected') {
          next.schedule = null;
        }
      }

      if (
        !next.source &&
        !next.generatedBy &&
        !next.schedule &&
        String(next.format || 'text') === 'text' &&
        String(next.align || 'left') === 'left' &&
        next.wrapText !== true &&
        next.bold !== true &&
        next.italic !== true &&
        next.decimalPlaces == null &&
        String(next.backgroundColor || '') === '' &&
        String(next.fontFamily || 'default') === 'default' &&
        Number(next.fontSize || 14) === 14 &&
        (!next.borders ||
          (next.borders.top !== true &&
            next.borders.right !== true &&
            next.borders.bottom !== true &&
            next.borders.left !== true))
      ) {
        if (
          previous &&
          String(previous.source || '') !== String(next.source || '')
        ) {
          this.clearCellDependencies(sheetId, id);
        }
        delete sheet.cells[id];
        return;
      }

      next.error = '';
      sheet.cells[id] = next;
      if (
        !previous ||
        String(previous.source || '') !== String(next.source || '')
      ) {
        this.clearCellDependencies(sheetId, id);
      }
    },

    setCellFormat(sheetId, cellId, format) {
      var sheet = this.ensureSheet(sheetId);
      if (!sheet) return;
      var id = String(cellId || '').toUpperCase();
      var nextFormat =
        [
          'text',
          'number',
          'number_0',
          'number_2',
          'percent',
          'percent_2',
          'date',
          'currency_usd',
          'currency_eur',
          'currency_gbp',
        ].indexOf(String(format || '')) >= 0
          ? String(format)
          : 'text';
      var cell = this.getCellRecord(sheetId, id);
      if (!cell) {
        if (nextFormat === 'text') return;
        cell = normalizeCellRecord('', null);
      }
      cell.format = nextFormat;
      if (
        !cell.source &&
        !cell.generatedBy &&
        nextFormat === 'text' &&
        String(cell.align || 'left') === 'left' &&
        cell.wrapText !== true &&
        cell.bold !== true &&
        cell.italic !== true
      ) {
        delete sheet.cells[id];
        return;
      }
      sheet.cells[id] = cell;
    },

    setCellPresentation(sheetId, cellId, presentation) {
      var sheet = this.ensureSheet(sheetId);
      if (!sheet) return;
      var id = String(cellId || '').toUpperCase();
      var nextPresentation = isPlainObject(presentation) ? presentation : {};
      var cell = this.getCellRecord(sheetId, id);
      if (!cell) {
        var hasMeaningfulPresentation =
          !!normalizeCellSchedule(nextPresentation.schedule) ||
          String(nextPresentation.align || 'left') !== 'left' ||
          nextPresentation.wrapText === true ||
          nextPresentation.bold === true ||
          nextPresentation.italic === true ||
          nextPresentation.decimalPlaces != null ||
          String(nextPresentation.backgroundColor || '') !== '' ||
          String(nextPresentation.fontFamily || 'default') !== 'default' ||
          (Number.isFinite(nextPresentation.fontSize) &&
            Number(nextPresentation.fontSize) !== 14) ||
          (isPlainObject(nextPresentation.borders) &&
            (nextPresentation.borders.top === true ||
              nextPresentation.borders.right === true ||
              nextPresentation.borders.bottom === true ||
              nextPresentation.borders.left === true));
        if (!hasMeaningfulPresentation) return;
        cell = normalizeCellRecord('', null);
      }
      if (Object.prototype.hasOwnProperty.call(nextPresentation, 'align')) {
        var nextAlign = String(nextPresentation.align || 'left');
        cell.align =
          nextAlign === 'center' || nextAlign === 'right' ? nextAlign : 'left';
      }
      if (Object.prototype.hasOwnProperty.call(nextPresentation, 'wrapText')) {
        cell.wrapText = nextPresentation.wrapText === true;
      }
      if (Object.prototype.hasOwnProperty.call(nextPresentation, 'bold')) {
        cell.bold = nextPresentation.bold === true;
      }
      if (Object.prototype.hasOwnProperty.call(nextPresentation, 'italic')) {
        cell.italic = nextPresentation.italic === true;
      }
      if (
        Object.prototype.hasOwnProperty.call(nextPresentation, 'decimalPlaces')
      ) {
        cell.decimalPlaces = Number.isInteger(nextPresentation.decimalPlaces)
          ? Math.max(0, Math.min(6, Number(nextPresentation.decimalPlaces)))
          : null;
      }
      if (
        Object.prototype.hasOwnProperty.call(nextPresentation, 'backgroundColor')
      ) {
        cell.backgroundColor =
          typeof nextPresentation.backgroundColor === 'string'
            ? String(nextPresentation.backgroundColor)
            : '';
      }
      if (Object.prototype.hasOwnProperty.call(nextPresentation, 'fontFamily')) {
        var nextFontFamily = String(nextPresentation.fontFamily || 'default');
        cell.fontFamily =
          ['default', 'serif', 'sans', 'mono', 'display'].indexOf(
            nextFontFamily,
          ) >= 0
            ? nextFontFamily
            : 'default';
      }
      if (Object.prototype.hasOwnProperty.call(nextPresentation, 'fontSize')) {
        cell.fontSize = Number.isFinite(nextPresentation.fontSize)
          ? Math.max(10, Math.min(28, Number(nextPresentation.fontSize)))
          : 14;
      }
      if (Object.prototype.hasOwnProperty.call(nextPresentation, 'borders')) {
        var nextBorders = isPlainObject(nextPresentation.borders)
          ? nextPresentation.borders
          : {};
        cell.borders = {
          top: nextBorders.top === true,
          right: nextBorders.right === true,
          bottom: nextBorders.bottom === true,
          left: nextBorders.left === true,
        };
      }
      if (Object.prototype.hasOwnProperty.call(nextPresentation, 'schedule')) {
        cell.schedule = normalizeCellSchedule(nextPresentation.schedule) || null;
      }
      if (
        !cell.source &&
        !cell.generatedBy &&
        !cell.schedule &&
        String(cell.format || 'text') === 'text' &&
        String(cell.align || 'left') === 'left' &&
        cell.wrapText !== true &&
        cell.bold !== true &&
        cell.italic !== true &&
        cell.decimalPlaces == null &&
        String(cell.backgroundColor || '') === '' &&
        String(cell.fontFamily || 'default') === 'default' &&
        Number(cell.fontSize || 14) === 14 &&
        (!cell.borders ||
          (cell.borders.top !== true &&
            cell.borders.right !== true &&
            cell.borders.bottom !== true &&
            cell.borders.left !== true))
      ) {
        delete sheet.cells[id];
        return;
      }
      sheet.cells[id] = cell;
    },

    setCellSchedule(sheetId, cellId, scheduleValue) {
      var sheet = this.ensureSheet(sheetId);
      if (!sheet) return;
      var id = String(cellId || '').toUpperCase();
      var schedule = normalizeCellSchedule(scheduleValue) || null;
      var cell = this.getCellRecord(sheetId, id);
      if (!cell) {
        if (!schedule) return;
        cell = normalizeCellRecord('', null);
      }
      cell.schedule = schedule;
      if (
        !cell.source &&
        !cell.generatedBy &&
        !cell.schedule &&
        String(cell.format || 'text') === 'text' &&
        String(cell.align || 'left') === 'left' &&
        cell.wrapText !== true &&
        cell.bold !== true &&
        cell.italic !== true &&
        cell.decimalPlaces == null &&
        String(cell.backgroundColor || '') === '' &&
        String(cell.fontFamily || 'default') === 'default' &&
        Number(cell.fontSize || 14) === 14 &&
        (!cell.borders ||
          (cell.borders.top !== true &&
            cell.borders.right !== true &&
            cell.borders.bottom !== true &&
            cell.borders.left !== true))
      ) {
        delete sheet.cells[id];
        return;
      }
      sheet.cells[id] = cell;
    },

    setComputedCellValue(sheetId, cellId, value, state, errorMessage, meta) {
      var sheet = this.ensureSheet(sheetId);
      if (!sheet) return;
      var id = String(cellId || '').toUpperCase();
      var cell = this.getCellRecord(sheetId, id);
      if (!cell) return;
      var details = isPlainObject(meta) ? meta : {};
      cell.value = String(value == null ? '' : value);
      if (Object.prototype.hasOwnProperty.call(details, 'displayValue')) {
        cell.displayValue = String(details.displayValue == null ? '' : details.displayValue);
      } else {
        cell.displayValue = String(value == null ? '' : value);
      }
      cell.state = String(state || 'resolved');
      cell.error = String(errorMessage || '');
      cell.computedVersion = Math.max(1, (Number(cell.computedVersion) || 0) + 1);
      if (Object.prototype.hasOwnProperty.call(details, 'dependencySignature')) {
        var nextSignature = String(details.dependencySignature || '');
        if (cell.dependencySignature !== nextSignature) {
          cell.dependencyVersion = Math.max(
            1,
            (Number(cell.dependencyVersion) || 0) + 1,
          );
          cell.dependencySignature = nextSignature;
        }
      }
      sheet.cells[id] = cell;
    },

    setCellRuntimeState(sheetId, cellId, updates) {
      var sheet = this.ensureSheet(sheetId);
      if (!sheet) return;
      var id = String(cellId || '').toUpperCase();
      var cell = this.getCellRecord(sheetId, id);
      if (!cell) return;
      var next = isPlainObject(updates) ? updates : {};
      if (Object.prototype.hasOwnProperty.call(next, 'value')) {
        cell.value = String(next.value == null ? '' : next.value);
      }
      if (Object.prototype.hasOwnProperty.call(next, 'displayValue')) {
        cell.displayValue = String(
          next.displayValue == null ? '' : next.displayValue,
        );
      }
      if (Object.prototype.hasOwnProperty.call(next, 'state')) {
        cell.state = String(next.state || '');
      }
      if (Object.prototype.hasOwnProperty.call(next, 'error')) {
        cell.error = String(next.error || '');
      }
      if (
        Object.prototype.hasOwnProperty.call(next, 'lastProcessedChannelEventIds')
      ) {
        cell.lastProcessedChannelEventIds = isPlainObject(
          next.lastProcessedChannelEventIds,
        )
          ? deepClone(next.lastProcessedChannelEventIds)
          : {};
      }
      if (Object.prototype.hasOwnProperty.call(next, 'channelFeedMeta')) {
        cell.channelFeedMeta = normalizeChannelFeedMeta(next.channelFeedMeta);
      }
      if (Object.prototype.hasOwnProperty.call(next, 'computedVersion')) {
        cell.computedVersion = Number(next.computedVersion) || 0;
      }
      if (Object.prototype.hasOwnProperty.call(next, 'dependencyVersion')) {
        cell.dependencyVersion = Number(next.dependencyVersion) || 0;
      }
      if (Object.prototype.hasOwnProperty.call(next, 'dependencySignature')) {
        cell.dependencySignature = String(next.dependencySignature || '');
      }
      sheet.cells[id] = cell;
    },

    getGeneratedCellSource(sheetId, cellId) {
      var cell = this.getCellRecord(sheetId, cellId);
      return cell ? String(cell.generatedBy || '') : '';
    },

    listGeneratedCellsBySource(sheetId, sourceCellId) {
      var source = String(sourceCellId || '').toUpperCase();
      if (!source) return [];
      var ids = this.listCellIds(sheetId);
      var result = [];
      for (var i = 0; i < ids.length; i++) {
        var cell = this.getCellRecord(sheetId, ids[i]);
        if (!cell) continue;
        if (String(cell.generatedBy || '').toUpperCase() === source)
          result.push(ids[i]);
      }
      return result;
    },

    clearGeneratedCellsBySource(sheetId, sourceCellId) {
      var ids = this.listGeneratedCellsBySource(sheetId, sourceCellId);
      for (var i = 0; i < ids.length; i++) {
        this.setCellSource(sheetId, ids[i], '', { generatedBy: '' });
      }
      return ids.length;
    },
  });
}
