import {
  extractChannelMentionLabels,
} from '../../api/channels/mentioning.js';
import { aiAttachmentMethods } from './ai-methods-attachments.js';
import { aiChannelMethods } from './ai-methods-channel.js';
import { aiMentionMethods } from './ai-methods-mentions.js';
import { aiShortcutMethods } from './ai-methods-shortcuts.js';

// Description: ai methods extracted from FormulaEngine for smaller logical modules.
export const aiMethods = {
  ...aiAttachmentMethods,
  ...aiChannelMethods,
  ...aiMentionMethods,
  ...aiShortcutMethods,

  listAI(
    sheetId,
    sourceCellId,
    text,
    count,
    forceRefresh,
    stack,
    options,
    fillStartFromIndex,
  ) {
    var sourceRaw = String(
      this.storageService.getCellValue(sheetId, sourceCellId) || '',
    );
    var dependencies = this.collectAIPromptDependencies(sheetId, text);
    if (typeof this.recordAIPromptDependencies === 'function') {
      this.recordAIPromptDependencies(options, dependencies);
    }
    if (!this.arePromptDependenciesResolved(sheetId, text, options)) {
      return '...';
    }
    var prepared = this.prepareAIPrompt(sheetId, text, stack, options);
    var prompt = prepared.userPrompt;
    var total = parseInt(count, 10);
    if (isNaN(total) || total < 1) total = 5;
    if (total > 50) total = 50;
    var startIndex =
      typeof fillStartFromIndex === 'number' ? fillStartFromIndex : 1;

    return this.aiService.list(
      prompt,
      total,
      (items) => {
        if (
          String(this.storageService.getCellValue(sheetId, sourceCellId) || '') !==
          sourceRaw
        ) {
          return;
        }
        var rows = (Array.isArray(items) ? items : [])
          .slice(startIndex)
          .map((item) => [String(item == null ? '' : item)]);
        this.spillMatrixToSheet(sheetId, sourceCellId, rows, {
          preserveSourceCell: true,
        });
      },
      {
        forceRefresh: !!forceRefresh,
        systemPrompt: prepared.systemPrompt,
        userContent: prepared.userContent,
        queueMeta: {
          formulaKind: 'list',
          sourceCellId: sourceCellId,
          promptTemplate: this.normalizeQueuedPromptTemplate(text),
          count: total,
          dependencies: dependencies,
          attachmentLinks: prepared.attachmentLinks,
        },
      },
    );
  },

  tableAI(
    sheetId,
    sourceCellId,
    text,
    cols,
    rows,
    forceRefresh,
    stack,
    options,
  ) {
    var sourceRaw = String(
      this.storageService.getCellValue(sheetId, sourceCellId) || '',
    );
    var dependencies = this.collectAIPromptDependencies(sheetId, text);
    if (typeof this.recordAIPromptDependencies === 'function') {
      this.recordAIPromptDependencies(options, dependencies);
    }
    if (!this.arePromptDependenciesResolved(sheetId, text, options)) {
      return '...';
    }
    var prepared = this.prepareAIPrompt(sheetId, text, stack, options);
    var prompt = prepared.userPrompt;
    var channelLabels = extractChannelMentionLabels(
      String(text == null ? '' : text),
    );
    var appendBelowExisting = this.shouldAppendForChannelEvent(
      sheetId,
      sourceCellId,
      channelLabels,
      options,
    );

    this.aiService
      .askTable(prompt, cols, rows, {
        forceRefresh: !!forceRefresh,
        onResult: (matrix) => {
          if (
            String(this.storageService.getCellValue(sheetId, sourceCellId) || '') !==
            sourceRaw
          ) {
            return;
          }
          this.spillMatrixToSheet(sheetId, sourceCellId, matrix, {
            preserveSourceCell: true,
            appendBelowExisting: appendBelowExisting,
          });
        },
        systemPrompt: prepared.systemPrompt,
        userContent: prepared.userContent,
        queueMeta: {
          formulaKind: 'table',
          sourceCellId: sourceCellId,
          promptTemplate: this.normalizeQueuedPromptTemplate(text),
          colsLimit: cols,
          rowsLimit: rows,
          dependencies: dependencies,
          attachmentLinks: prepared.attachmentLinks,
        },
      })
      .catch(() => {});

    return '#';
  },

  isTableShortcutRaw(rawValue) {
    var raw = String(rawValue == null ? '' : rawValue).trim();
    if (!raw) return false;
    var head = raw.charAt(0);
    if (head !== '#') return false;
    return (
      this.stripOptionalFormulaQuestionMarker(raw.substring(1)).trim() !== ''
    );
  },

  isListShortcutRaw(rawValue) {
    var raw = String(rawValue == null ? '' : rawValue).trim();
    if (!raw) return false;
    var head = raw.charAt(0);
    if (head !== '>') return false;
    return (
      this.stripOptionalFormulaQuestionMarker(raw.substring(1)).trim() !== ''
    );
  },

  readListShortcutResult(sheetId, sourceCellId, stack, options) {
    var source = this.parseCellId(sourceCellId);
    if (!source) return '';
    var generatedIds =
      this.storageService.listGeneratedCellsBySource(sheetId, sourceCellId) ||
      [];
    if (generatedIds.length) {
      var generatedValues = generatedIds
        .map((cellId) => {
          var parsed = this.parseCellId(cellId);
          return {
            cellId: String(cellId || '').toUpperCase(),
            row: parsed ? parsed.row : 0,
            col: parsed ? parsed.col : 0,
          };
        })
        .sort((left, right) => {
          if (left.row !== right.row) return left.row - right.row;
          return left.col - right.col;
        })
        .map((item) => {
          var value = this.evaluateCell(
            sheetId,
            item.cellId,
            stack || {},
            options,
          );
          return String(value == null ? '' : value);
        })
        .filter((value) => value.trim() !== '');
      if (generatedValues.length) {
        return generatedValues.join('\n');
      }
    }
    var bounds = this.getGridBounds();
    var maxRow = bounds.maxRow;
    var values = [];
    for (var row = source.row + 1; row <= maxRow; row++) {
      var cellId = this.columnIndexToLabel(source.col) + row;
      var raw = String(this.storageService.getCellValue(sheetId, cellId) || '');
      if (raw.trim() === '') break;
      var value = this.evaluateCell(sheetId, cellId, stack || {}, options);
      values.push(String(value == null ? '' : value));
    }
    return values.join('\n');
  },

  readTableShortcutResult(sheetId, sourceCellId, stack, options) {
    var matrix = this.readTableShortcutMatrix(
      sheetId,
      sourceCellId,
      stack,
      options,
    );
    if (!matrix.length) return '';
    var lines = [];
    for (var r = 0; r < matrix.length; r++) {
      lines.push(
        matrix[r]
          .map((v) => this.escapeCsv(String(v == null ? '' : v)))
          .join(','),
      );
    }
    return lines.join('\n');
  },

  readTableShortcutMatrix(sheetId, sourceCellId, stack, options) {
    var source = this.parseCellId(sourceCellId);
    if (!source) return [];
    var generatedIds =
      this.storageService.listGeneratedCellsBySource(sheetId, sourceCellId) ||
      [];
    if (generatedIds.length) {
      var generatedCells = generatedIds
        .map((cellId) => {
          var parsed = this.parseCellId(cellId);
          if (!parsed) return null;
          return {
            cellId: String(cellId || '').toUpperCase(),
            row: parsed.row,
            col: parsed.col,
          };
        })
        .filter(Boolean);
      if (generatedCells.length) {
        var minRow = generatedCells[0].row;
        var maxRowGenerated = generatedCells[0].row;
        var minCol = generatedCells[0].col;
        var maxColGenerated = generatedCells[0].col;
        for (var g = 1; g < generatedCells.length; g++) {
          if (generatedCells[g].row < minRow) minRow = generatedCells[g].row;
          if (generatedCells[g].row > maxRowGenerated)
            maxRowGenerated = generatedCells[g].row;
          if (generatedCells[g].col < minCol) minCol = generatedCells[g].col;
          if (generatedCells[g].col > maxColGenerated)
            maxColGenerated = generatedCells[g].col;
        }

        var generatedMap = {};
        for (var gm = 0; gm < generatedCells.length; gm++) {
          generatedMap[generatedCells[gm].cellId] = true;
        }

        var generatedMatrix = [];
        for (var rowIndex = minRow; rowIndex <= maxRowGenerated; rowIndex++) {
          var rowValues = [];
          var hasAny = false;
          for (var colIndex = minCol; colIndex <= maxColGenerated; colIndex++) {
            var targetCellId = this.columnIndexToLabel(colIndex) + rowIndex;
            if (!generatedMap[targetCellId]) {
              rowValues.push('');
              continue;
            }
            var generatedValue = this.evaluateCell(
              sheetId,
              targetCellId,
              stack || {},
              options,
            );
            var stringValue = String(
              generatedValue == null ? '' : generatedValue,
            );
            if (stringValue.trim() !== '') hasAny = true;
            rowValues.push(stringValue);
          }
          if (hasAny) generatedMatrix.push(rowValues);
        }
        if (generatedMatrix.length) return generatedMatrix;
      }
    }
    var bounds = this.getGridBounds();
    var maxRow = bounds.maxRow;
    var maxCol = bounds.maxCol;
    var startRow = source.row + 1;
    var startCol = source.col;

    var width = 0;
    for (var col = startCol; col <= maxCol; col++) {
      var firstRowCellId = this.columnIndexToLabel(col) + startRow;
      var firstRaw = String(
        this.storageService.getCellValue(sheetId, firstRowCellId) || '',
      );
      if (firstRaw.trim() === '') break;
      width++;
    }
    if (width < 1) return [];

    var matrix = [];
    for (var row = startRow; row <= maxRow; row++) {
      var rowValues = [];
      var hasAny = false;
      for (var c = 0; c < width; c++) {
        var cellId = this.columnIndexToLabel(startCol + c) + row;
        var raw = String(
          this.storageService.getCellValue(sheetId, cellId) || '',
        );
        if (raw.trim() !== '') hasAny = true;
        var value = this.evaluateCell(sheetId, cellId, stack || {}, options);
        rowValues.push(String(value == null ? '' : value));
      }
      if (!hasAny) break;
      matrix.push(rowValues);
    }

    return matrix;
  },

  spillMatrixToSheet(sheetId, sourceCellId, matrix, spillOptions) {
    var source = this.parseCellId(sourceCellId);
    if (!source) return;
    var sourceKey = String(sourceCellId || '').toUpperCase();
    var opts =
      spillOptions && typeof spillOptions === 'object' ? spillOptions : {};
    var preserveSourceCell = opts.preserveSourceCell !== false;
    var appendBelowExisting = !!opts.appendBelowExisting;
    var baseRow = source.row + (preserveSourceCell ? 1 : 0);
    var baseCol = source.col;

    if (!appendBelowExisting) {
      this.storageService.clearGeneratedCellsBySource(sheetId, sourceCellId);
    } else {
      var existing =
        this.storageService.listGeneratedCellsBySource(sheetId, sourceCellId) ||
        [];
      var maxRow = 0;
      for (var i = 0; i < existing.length; i++) {
        var parsed = this.parseCellId(existing[i]);
        if (parsed && parsed.row > maxRow) maxRow = parsed.row;
      }
      if (maxRow > 0) {
        baseRow = maxRow + 1;
      }
    }

    for (var r = 0; r < matrix.length; r++) {
      var rowValues = Array.isArray(matrix[r]) ? matrix[r] : [matrix[r]];
      for (var c = 0; c < rowValues.length; c++) {
        var targetRow = baseRow + r;
        var targetCol = baseCol + c;
        if (targetRow < 1 || targetCol < 1) continue;
        var targetCellId = this.columnIndexToLabel(targetCol) + targetRow;
        this.storageService.setCellValue(
          sheetId,
          targetCellId,
          String(rowValues[c] == null ? '' : rowValues[c]),
          { generatedBy: sourceKey },
        );
      }
    }
  },

  getGridBounds() {
    var maxRow = 1;
    var maxCol = 1;
    for (var i = 0; i < this.cellIds.length; i++) {
      var parsed = this.parseCellId(this.cellIds[i]);
      if (!parsed) continue;
      if (parsed.row > maxRow) maxRow = parsed.row;
      if (parsed.col > maxCol) maxCol = parsed.col;
    }
    if (
      this.storageService &&
      typeof this.storageService.listAllCellIds === 'function'
    ) {
      var refs = this.storageService.listAllCellIds();
      for (var s = 0; s < refs.length; s++) {
        var match = /^([A-Za-z]+)([0-9]+)$/.exec(
          String((refs[s] && refs[s].cellId) || '').toUpperCase(),
        );
        if (!match) continue;
        var col = this.columnLabelToIndex(String(match[1]).toUpperCase());
        var row = parseInt(match[2], 10);
        if (row > maxRow) maxRow = row;
        if (col > maxCol) maxCol = col;
      }
    }
    return { maxRow: maxRow, maxCol: maxCol };
  },

  prepareAIPrompt(sheetId, text, stack, options) {
    var rawText = String(text == null ? '' : text);
    var mentionOptions = Object.assign({}, options || {}, {
      aiPromptPreferDisplay: true,
    });
    var channelLabels = extractChannelMentionLabels(rawText);
    for (var c = 0; c < channelLabels.length; c++) {
      if (typeof this.recordDependencyChannel === 'function') {
        this.recordDependencyChannel(options, channelLabels[c]);
      }
    }
    var pattern =
      /@@(?:'([^']+)'|([A-Za-z][A-Za-z0-9 _-]*))!([A-Za-z]+[0-9]+)|@@(_?)([A-Za-z_][A-Za-z0-9_]*)/g;
    var contextLines = [];
    var cursor = 0;
    var userParts = [];
    var m;

    while ((m = pattern.exec(rawText))) {
      var idx = m.index;
      if (idx > cursor) userParts.push(rawText.slice(cursor, idx));

      var token = m[0];
      var sheetQuoted = m[1];
      var sheetPlain = m[2];
      var sheetCell = m[3];
      var plainRawPrefix = m[4];
      var plainToken = m[5];
      var value = '';
      var key = '';

      try {
        if (sheetCell) {
          var sheetName = sheetQuoted || sheetPlain || '';
          var refSheetId = this.findSheetIdByName(sheetName);
          if (refSheetId) {
            var refCell = sheetCell.toUpperCase();
            value = this.getMentionValue(
              refSheetId,
              refCell,
              stack,
              mentionOptions,
            );
            key = sheetName + '!' + refCell;
          }
        } else if (plainToken) {
          value = this.getPlainMentionValue(
            sheetId,
            plainToken,
            stack,
            mentionOptions,
            plainRawPrefix === '_',
          );
          key = plainToken;
        }
      } catch (e) {}

      if (key) {
        contextLines.push(
          '- ' + key + ': ' + String(value == null ? '' : value),
        );
      }

      cursor = idx + token.length;
    }

    if (cursor < rawText.length) userParts.push(rawText.slice(cursor));
    var userPrompt = userParts
      .join('')
      .replace(/\s{2,}/g, ' ')
      .trim();
    userPrompt = this.wrapResolvedMentionsForAI(
      sheetId,
      userPrompt,
      stack,
      mentionOptions,
    ).trim();
    userPrompt = this.expandChannelMentionsInPromptText(userPrompt, options)
      .replace(/\s{2,}/g, ' ')
      .trim();
    var imageAttachments =
      mentionOptions && Array.isArray(mentionOptions.aiImageAttachments)
        ? mentionOptions.aiImageAttachments.slice()
        : [];
    var textAttachments =
      mentionOptions && Array.isArray(mentionOptions.aiTextAttachments)
        ? mentionOptions.aiTextAttachments.slice()
        : [];
    var systemPrompt = '';
    if (contextLines.length) {
      systemPrompt = 'Spreadsheet context:\n' + contextLines.join('\n');
    }
    var channelAttachmentSystemPrompt = this.buildChannelAttachmentSystemPrompt(
      channelLabels,
      options,
    );
    var attachmentLinks = this.buildChannelAttachmentLinks(
      channelLabels,
      options,
    );
    if (channelAttachmentSystemPrompt) {
      systemPrompt = systemPrompt
        ? systemPrompt + '\n\n' + channelAttachmentSystemPrompt
        : channelAttachmentSystemPrompt;
    }
    return {
      userPrompt: userPrompt,
      systemPrompt: systemPrompt,
      imageAttachments: imageAttachments,
      textAttachments: textAttachments,
      userContent: this.buildAIUserContent(
        userPrompt,
        imageAttachments,
        textAttachments,
      ),
      attachmentLinks: attachmentLinks,
    };
  },
};
