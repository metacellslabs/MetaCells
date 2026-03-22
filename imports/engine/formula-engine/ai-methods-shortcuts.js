import { extractChannelMentionLabels } from '../../api/channels/mentioning.js';

export const aiShortcutMethods = {
  parseListShortcutSpec(rawFormula) {
    var raw = String(rawFormula == null ? '' : rawFormula);
    if (!raw || raw.charAt(0) !== '>') return null;

    var parsed = this.parseFormulaDisplayPlaceholder(
      this.stripOptionalFormulaQuestionMarker(raw.substring(1)),
    );
    var body = String(parsed.content || '').trim();
    if (!body) return null;

    var includeAttachments = false;
    var days = 1;
    var prompt = body;
    var attachmentOptIn = /^\+(\d+)?\s*(.+)$/.exec(body);
    if (attachmentOptIn) {
      includeAttachments = true;
      days = attachmentOptIn[1] ? parseInt(attachmentOptIn[1], 10) : 1;
      if (isNaN(days) || days < 1) days = 1;
      prompt = String(attachmentOptIn[2] || '').trim();
    }

    if (!prompt) return null;
    return {
      prompt: prompt,
      includeAttachments: includeAttachments,
      days: days,
      placeholder: String(parsed.placeholder || ''),
    };
  },

  parseListShortcutPrompt(rawFormula) {
    var spec = this.parseListShortcutSpec(rawFormula);
    return spec && spec.prompt ? spec.prompt : '';
  },

  parseChannelFeedPromptSpec(rawValue) {
    var raw = String(rawValue == null ? '' : rawValue);
    if (!raw || raw.charAt(0) !== '#') return null;

    var parsed = this.parseFormulaDisplayPlaceholder(
      this.stripOptionalFormulaQuestionMarker(raw.substring(1)),
    );
    var payload = String(parsed.content || '').trim();
    if (!payload) return null;

    var match = /^(\+)?(\d+)?\s*(.+)$/.exec(payload);
    if (!match) return null;

    var includeAttachments = match[1] === '+';
    var dayToken = String(match[2] || '').trim();
    var prompt = String(match[3] || '').trim();
    if (!prompt) return null;

    var labels = extractChannelMentionLabels(prompt);
    if (!labels.length) return null;

    var days = dayToken ? parseInt(dayToken, 10) : 1;
    if (isNaN(days) || days < 1) return null;

    return {
      prompt: prompt,
      days: days,
      labels: labels,
      includeAttachments: includeAttachments,
      placeholder: String(parsed.placeholder || ''),
    };
  },

  parseTablePromptSpec(rawValue) {
    var raw = String(rawValue == null ? '' : rawValue);
    if (!raw || raw.charAt(0) !== '#') return null;
    if (/\r|\n/.test(raw)) return null;

    var parsed = this.parseFormulaDisplayPlaceholder(
      this.stripOptionalFormulaQuestionMarker(raw.substring(1)),
    );
    var payload = String(parsed.content || '').trim();
    if (!payload) {
      return {
        prompt: '',
        cols: null,
        rows: null,
        placeholder: String(parsed.placeholder || ''),
      };
    }

    var parts = payload.split(';');
    if (parts.length >= 3) {
      var maybeRows = parseInt(parts[parts.length - 1].trim(), 10);
      var maybeCols = parseInt(parts[parts.length - 2].trim(), 10);
      if (
        !isNaN(maybeCols) &&
        maybeCols > 0 &&
        !isNaN(maybeRows) &&
        maybeRows > 0
      ) {
        return {
          prompt: parts.slice(0, -2).join(';').trim(),
          cols: maybeCols,
          rows: maybeRows,
          placeholder: String(parsed.placeholder || ''),
        };
      }
    }

    return {
      prompt: payload,
      cols: null,
      rows: null,
      placeholder: String(parsed.placeholder || ''),
    };
  },

  tryDirectMentionTableSpill(sheetId, cellId, rawFormula, stack, options) {
    var target = this.resolveDirectMentionFormulaRef(sheetId, rawFormula);
    if (!target) return null;
    var targetRaw = String(
      this.storageService.getCellValue(target.sheetId, target.cellId) || '',
    );
    if (!this.isTableShortcutRaw(targetRaw)) return null;

    var matrix = this.readTableShortcutMatrix(
      target.sheetId,
      target.cellId,
      stack,
      options,
    );
    if (!matrix.length) return { applied: true, value: '' };

    this.spillMatrixToSheet(sheetId, cellId, matrix);
    return {
      applied: true,
      value: String(matrix[0][0] == null ? '' : matrix[0][0]),
    };
  },

  resolveDirectMentionFormulaRef(sheetId, rawFormula) {
    var raw = String(rawFormula == null ? '' : rawFormula);
    if (!raw || raw.charAt(0) !== '=') return null;
    var body = this.stripOptionalFormulaQuestionMarker(raw.substring(1)).trim();
    if (!body || body.charAt(0) !== '@') return null;
    var token = body.substring(1).trim();
    if (!token) return null;

    var sheetCellMatch =
      /^(?:'([^']+)'|([A-Za-z][A-Za-z0-9 _-]*))!([A-Za-z]+[0-9]+)$/.exec(token);
    if (sheetCellMatch) {
      var sheetName = sheetCellMatch[1] || sheetCellMatch[2] || '';
      var refSheetId = this.findSheetIdByName(sheetName);
      if (!refSheetId) return null;
      return { sheetId: refSheetId, cellId: sheetCellMatch[3].toUpperCase() };
    }

    var localCellMatch = /^([A-Za-z]+[0-9]+)$/.exec(token);
    if (localCellMatch) {
      return { sheetId: sheetId, cellId: localCellMatch[1].toUpperCase() };
    }

    var named = this.storageService.resolveNamedCell(token);
    if (named && named.sheetId && named.cellId) {
      return {
        sheetId: named.sheetId,
        cellId: String(named.cellId).toUpperCase(),
      };
    }
    return null;
  },
};
