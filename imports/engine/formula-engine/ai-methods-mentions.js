import {
  extractChannelMentionLabels,
  normalizeChannelLabel,
} from '../../api/channels/mentioning.js';

export const aiMentionMethods = {
  isCellDependencyResolved(sheetId, cellId) {
    var raw = String(this.storageService.getCellValue(sheetId, cellId) || '');
    if (!raw) return true;
    var isFormula = /^[='>#]/.test(raw);
    var state = String(this.storageService.getCellState(sheetId, cellId) || '');
    var computedValue =
      this.storageService &&
      typeof this.storageService.getCellComputedValue === 'function'
        ? String(this.storageService.getCellComputedValue(sheetId, cellId) || '')
        : '';
    var displayValue =
      this.storageService &&
      typeof this.storageService.getCellDisplayValue === 'function'
        ? String(this.storageService.getCellDisplayValue(sheetId, cellId) || '')
        : '';
    if (!state) {
      if (!isFormula) return true;
      if (
        computedValue === '...' ||
        computedValue === '(manual: click Update)' ||
        displayValue === '...' ||
        displayValue === '(manual: click Update)'
      ) {
        return false;
      }
      return !!(computedValue || displayValue);
    }
    if (state === 'error') return true;
    if (state === 'resolved') {
      if (
        computedValue === '...' ||
        computedValue === '(manual: click Update)'
      ) {
        return false;
      }
      return true;
    }
    return false;
  },

  isRegionDependencyResolved(sheetId, startCellId, endCellId) {
    var start = this.parseCellId(startCellId);
    var end = this.parseCellId(endCellId);
    if (!start || !end) return true;

    var rowStart = Math.min(start.row, end.row);
    var rowEnd = Math.max(start.row, end.row);
    var colStart = Math.min(start.col, end.col);
    var colEnd = Math.max(start.col, end.col);

    for (var r = rowStart; r <= rowEnd; r++) {
      for (var c = colStart; c <= colEnd; c++) {
        var cellId = this.columnIndexToLabel(c) + r;
        if (!this.isCellDependencyResolved(sheetId, cellId)) return false;
      }
    }

    return true;
  },

  arePromptDependenciesResolved(sheetId, text, options) {
    var dependencies = this.collectAIPromptDependencies(sheetId, text);
    for (var i = 0; i < dependencies.length; i++) {
      var dependency = dependencies[i];
      if (!dependency || !dependency.kind) continue;
      if (dependency.kind === 'cell') {
        if (
          !this.isCellDependencyResolved(dependency.sheetId, dependency.cellId)
        )
          return false;
        continue;
      }
      if (dependency.kind === 'region') {
        if (
          !this.isRegionDependencyResolved(
            dependency.sheetId,
            dependency.startCellId,
            dependency.endCellId,
          )
        )
          return false;
        continue;
      }
      if (dependency.kind === 'channel') {
        if (!this.isChannelDependencyResolved(dependency.label, options))
          return false;
      }
    }
    return true;
  },

  collectAIPromptDependencies(sheetId, text) {
    var source = String(text == null ? '' : text);
    if (!source) return [];
    var pattern =
      /@@?(?:'([^']+)'|([A-Za-z][A-Za-z0-9 _-]*))!([A-Za-z]+[0-9]+):([A-Za-z]+[0-9]+)|@@?([A-Za-z]+[0-9]+):([A-Za-z]+[0-9]+)|@@?(?:'([^']+)'|([A-Za-z][A-Za-z0-9 _-]*))!([A-Za-z]+[0-9]+)|@@?([A-Za-z_][A-Za-z0-9_]*)/g;
    var results = [];
    var seen = {};
    var m;

    while ((m = pattern.exec(source))) {
      var dependency = null;

      if (m[3] && m[4]) {
        var rangeSheetName = m[1] || m[2] || '';
        var rangeSheetId = this.findSheetIdByName(rangeSheetName);
        if (rangeSheetId) {
          dependency = {
            kind: 'region',
            sheetId: rangeSheetId,
            startCellId: String(m[3]).toUpperCase(),
            endCellId: String(m[4]).toUpperCase(),
          };
        }
      } else if (m[5] && m[6]) {
        dependency = {
          kind: 'region',
          sheetId: sheetId,
          startCellId: String(m[5]).toUpperCase(),
          endCellId: String(m[6]).toUpperCase(),
        };
      } else if (m[9]) {
        var refSheetName = m[7] || m[8] || '';
        var refSheetId = this.findSheetIdByName(refSheetName);
        if (refSheetId) {
          dependency = {
            kind: 'cell',
            sheetId: refSheetId,
            cellId: String(m[9]).toUpperCase(),
          };
        }
      } else if (m[10]) {
        var token = String(m[10] || '').trim();
        if (this.isExistingCellId(token)) {
          dependency = {
            kind: 'cell',
            sheetId: sheetId,
            cellId: token.toUpperCase(),
          };
        } else {
          var named = this.storageService.resolveNamedCell(token);
          if (named && named.sheetId && named.startCellId && named.endCellId) {
            dependency = {
              kind: 'region',
              sheetId: named.sheetId,
              startCellId: String(named.startCellId).toUpperCase(),
              endCellId: String(named.endCellId).toUpperCase(),
            };
          } else if (named && named.sheetId && named.cellId) {
            dependency = {
              kind: 'cell',
              sheetId: named.sheetId,
              cellId: String(named.cellId).toUpperCase(),
            };
          }
        }
      }

      if (!dependency) continue;
      var key =
        dependency.kind === 'region'
          ? 'region:' +
            dependency.sheetId +
            ':' +
            dependency.startCellId +
            ':' +
            dependency.endCellId
          : 'cell:' + dependency.sheetId + ':' + dependency.cellId;
      if (seen[key]) continue;
      seen[key] = true;
      results.push(dependency);
    }

    var channelLabels = extractChannelMentionLabels(source);
    for (var i = 0; i < channelLabels.length; i++) {
      var label = normalizeChannelLabel(channelLabels[i]);
      var key = 'channel:' + label;
      if (!label || seen[key]) continue;
      seen[key] = true;
      results.push({
        kind: 'channel',
        label: label,
      });
    }

    return results;
  },

  expandChannelMentionsInPromptText(text, options) {
    var source = String(text == null ? '' : text);
    if (!source) return '';
    var self = this;
    return source.replace(
      /(^|[^A-Za-z0-9_:/])\/([A-Za-z][A-Za-z0-9_-]*)\b/g,
      function (_match, prefix, label) {
        if (typeof self.recordDependencyChannel === 'function') {
          self.recordDependencyChannel(options, label);
        }
        var resolved = self.getChannelMentionValue(label, options);
        return String(prefix || '') + String(resolved || '');
      },
    );
  },

  wrapResolvedMentionsForAI(sheetId, text, stack, options) {
    var source = String(text == null ? '' : text);
    if (!source) return '';
    var pattern =
      /(_)?@(?:'([^']+)'|([A-Za-z][A-Za-z0-9 _-]*))!([A-Za-z]+[0-9]+):([A-Za-z]+[0-9]+)|(_)?@([A-Za-z]+[0-9]+):([A-Za-z]+[0-9]+)|(_)?@(?:'([^']+)'|([A-Za-z][A-Za-z0-9 _-]*))!([A-Za-z]+[0-9]+)|(_)?@([A-Za-z_][A-Za-z0-9_]*)/g;

    return source.replace(
      pattern,
      (
        _,
        rangeRawPrefix,
        qSheetRange,
        pSheetRange,
        rangeStart,
        rangeEnd,
        localRangeRawPrefix,
        localRangeStart,
        localRangeEnd,
        sheetRawPrefix,
        qSheetCell,
        pSheetCell,
        sheetCellId,
        plainRawPrefix,
        plainToken,
      ) => {
        try {
          var resolved = '';
          var imageAttachment = null;
          var textAttachment = null;
          if (rangeStart && rangeEnd) {
            var rangeSheetName = qSheetRange || pSheetRange || '';
            var rangeSheetId = this.findSheetIdByName(rangeSheetName);
            if (!rangeSheetId) return '';
            resolved = this.regionToCsv(
              rangeSheetId,
              rangeStart.toUpperCase(),
              rangeEnd.toUpperCase(),
              stack || {},
              options,
            );
          } else if (localRangeStart && localRangeEnd) {
            resolved = this.regionToCsv(
              sheetId,
              localRangeStart.toUpperCase(),
              localRangeEnd.toUpperCase(),
              stack || {},
              options,
            );
          } else if (sheetCellId) {
            var sheetName = qSheetCell || pSheetCell || '';
            var refSheetId = this.findSheetIdByName(sheetName);
            if (!refSheetId) return '';
            var rawMode = !!sheetRawPrefix;
            if (!rawMode) {
              imageAttachment = this.getImageAttachmentForCell(
                refSheetId,
                sheetCellId.toUpperCase(),
                options,
              );
              if (!imageAttachment) {
                textAttachment = this.getTextAttachmentForCell(
                  refSheetId,
                  sheetCellId.toUpperCase(),
                  options,
                );
              }
            }
            resolved = rawMode
              ? this.getMentionRawValue(refSheetId, sheetCellId.toUpperCase())
              : this.getMentionValue(
                  refSheetId,
                  sheetCellId.toUpperCase(),
                  stack,
                  options,
                );
          } else if (plainToken) {
            if (!plainRawPrefix) {
              imageAttachment = this.resolveImageAttachmentMention(
                sheetId,
                plainToken,
                options,
              );
              if (!imageAttachment) {
                textAttachment = this.resolveTextAttachmentMention(
                  sheetId,
                  plainToken,
                  options,
                );
              }
            }
            resolved = this.getPlainMentionValue(
              sheetId,
              plainToken,
              stack,
              options,
              !!plainRawPrefix,
            );
          }
          if (imageAttachment) {
            this.appendAIPromptImageAttachment(options, imageAttachment);
            return (
              '<attached image: ' +
              String(
                imageAttachment.name || imageAttachment.cellId || 'image',
              ) +
              '>'
            );
          }
          if (textAttachment) {
            this.appendAIPromptTextAttachment(options, textAttachment);
            return (
              '<attached file: ' +
              String(textAttachment.name || textAttachment.cellId || 'file') +
              '>'
            );
          }
          return String(resolved == null ? '' : resolved);
        } catch (_e) {
          return '';
        }
      },
    );
  },

  expandMentionsInPromptText(sheetId, text, stack, options) {
    var source = String(text == null ? '' : text);
    if (!source) return '';
    var pattern =
      /(_)?@(?:'([^']+)'|([A-Za-z][A-Za-z0-9 _-]*))!([A-Za-z]+[0-9]+):([A-Za-z]+[0-9]+)|(_)?@([A-Za-z]+[0-9]+):([A-Za-z]+[0-9]+)|(_)?@(?:'([^']+)'|([A-Za-z][A-Za-z0-9 _-]*))!([A-Za-z]+[0-9]+)|(_)?@([A-Za-z_][A-Za-z0-9_]*)/g;

    return source.replace(
      pattern,
      (
        _,
        rangeRawPrefix,
        qSheetRange,
        pSheetRange,
        rangeStart,
        rangeEnd,
        localRangeRawPrefix,
        localRangeStart,
        localRangeEnd,
        sheetRawPrefix,
        qSheetCell,
        pSheetCell,
        sheetCellId,
        plainRawPrefix,
        plainToken,
      ) => {
        try {
          if (rangeStart && rangeEnd) {
            var rangeSheetName = qSheetRange || pSheetRange || '';
            var rangeSheetId = this.findSheetIdByName(rangeSheetName);
            if (!rangeSheetId) return '';
            return this.regionToCsv(
              rangeSheetId,
              rangeStart.toUpperCase(),
              rangeEnd.toUpperCase(),
              stack || {},
              options,
            );
          }

          if (localRangeStart && localRangeEnd) {
            return this.regionToCsv(
              sheetId,
              localRangeStart.toUpperCase(),
              localRangeEnd.toUpperCase(),
              stack || {},
              options,
            );
          }

          if (sheetCellId) {
            var sheetName = qSheetCell || pSheetCell || '';
            var refSheetId = this.findSheetIdByName(sheetName);
            if (!refSheetId) return '';
            var rawMode = !!sheetRawPrefix;
            var sheetValue = rawMode
              ? this.getMentionRawValue(refSheetId, sheetCellId.toUpperCase())
              : this.getMentionValue(
                  refSheetId,
                  sheetCellId.toUpperCase(),
                  stack,
                  options,
                );
            return String(sheetValue == null ? '' : sheetValue);
          }

          if (plainToken) {
            var plainValue = this.getPlainMentionValue(
              sheetId,
              plainToken,
              stack,
              options,
              !!plainRawPrefix,
            );
            return String(plainValue == null ? '' : plainValue);
          }
        } catch (_e) {
          return '';
        }
        return '';
      },
    );
  },
};
