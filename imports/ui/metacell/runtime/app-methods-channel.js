import { Meteor } from 'meteor/meteor';
import {
  buildChannelSendAttachmentsFromPreparedPrompt,
  buildChannelSendBodyFromPreparedPrompt,
  parseChannelSendCommand,
  stripChannelSendFileAndImagePlaceholders,
} from '../../../api/channels/commands.js';

function normalizeChannelSendRecipients(value) {
  if (Array.isArray(value)) {
    return value
      .map((item) => String(item == null ? '' : item).trim())
      .filter(Boolean);
  }
  var raw = String(value == null ? '' : value).trim();
  if (!raw) return [];
  return raw
    .split(/[,\n;]/)
    .map(function (item) {
      return String(item || '').trim();
    })
    .filter(Boolean);
}

function parseStructuredChannelSendMessage(message) {
  var raw = String(message == null ? '' : message).trim();
  if (!raw || raw.charAt(0) !== '{') return null;
  try {
    var parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
      return null;
    }
    return parsed;
  } catch (e) {
    return null;
  }
}

function getChannelCommandResultText(result, fallbackLabel) {
  var source = result && typeof result === 'object' ? result : {};
  var stdout = String(source.stdout || '').trim();
  if (stdout) return stdout;
  var body = String(source.body || source.text || source.value || '').trim();
  if (body) return body;
  var stderr = String(source.stderr || '').trim();
  if (stderr) return stderr;
  var message = String(source.message || '').trim();
  if (message) return message;
  return `Sent to /${String(fallbackLabel || '').trim()}`;
}

function formatChannelCommandLogTimestamp(date) {
  var value = date instanceof Date ? date : new Date();
  var year = value.getFullYear();
  var month = String(value.getMonth() + 1).padStart(2, '0');
  var day = String(value.getDate()).padStart(2, '0');
  var hours = String(value.getHours()).padStart(2, '0');
  var minutes = String(value.getMinutes()).padStart(2, '0');
  var seconds = String(value.getSeconds()).padStart(2, '0');
  return `${year}-${month}-${day} ${hours}:${minutes}:${seconds}`;
}

function normalizeChannelCommandLogText(value) {
  return String(value == null ? '' : value)
    .replace(/\s+/g, ' ')
    .trim();
}

function appendChannelCommandLog(previousDisplayValue, entry) {
  var source = String(previousDisplayValue == null ? '' : previousDisplayValue).trim();
  var line = String(entry == null ? '' : entry).trim();
  if (!line) return source;
  if (!source || /^Sending to \//.test(source) || source === '#ERROR') return line;
  return `${source}\n${line}`;
}

function buildChannelCommandLogEntry(timestamp, messageText, resultText) {
  var summary = normalizeChannelCommandLogText(resultText);
  return (
    `[${formatChannelCommandLogTimestamp(timestamp)}] ` +
    `${normalizeChannelCommandLogText(messageText) || '(empty message)'} -> ` +
    `${summary || 'Sent'}`
  );
}

function buildChannelSendPayloadSignature(payload) {
  var source = payload && typeof payload === 'object' ? payload : {};
  var attachments = Array.isArray(source.attachments) ? source.attachments : [];
  return JSON.stringify({
    to: normalizeChannelSendRecipients(source.to),
    subj: String(source.subj || ''),
    body: String(source.body || ''),
    command: String(source.command || ''),
    attachments: attachments.map(function (item) {
      var attachment = item && typeof item === 'object' ? item : {};
      return {
        name: String(attachment.name || ''),
        type: String(attachment.type || ''),
        binaryArtifactId: String(attachment.binaryArtifactId || ''),
        contentArtifactId: String(attachment.contentArtifactId || ''),
        downloadUrl: String(attachment.downloadUrl || ''),
      };
    }),
  });
}

var CHANNEL_COMMAND_REPEAT_DEDUPE_WINDOW_MS = 5000;

export function installChannelMethods(SpreadsheetApp) {
  SpreadsheetApp.prototype.runChannelSendCommandForCell = function (cellId, rawValue, options) {
    var normalizedCellId = String(cellId || '').toUpperCase();
    var raw = String(rawValue == null ? '' : rawValue);
    var opts = options && typeof options === 'object' ? options : {};
    var targetSheetId = String(opts.sheetId || this.activeSheetId || '');
    var commandCellKey = targetSheetId + ':' + normalizedCellId;
    var force = opts.force === true;
    var storedRaw = String(
      this.storage.getCellValue(targetSheetId, normalizedCellId) || '',
    );
    if (!force && storedRaw === raw) {
      return true;
    }
    var command = parseChannelSendCommand(raw);
    if (!command || !command.label || !command.message) return false;
    var structuredPayload = parseStructuredChannelSendMessage(command.message);
    var commandTemplate =
      structuredPayload && Object.prototype.hasOwnProperty.call(structuredPayload, 'command')
        ? String(structuredPayload.command || '')
        : '';
    var bodyTemplate =
      structuredPayload && Object.prototype.hasOwnProperty.call(structuredPayload, 'body')
        ? String(structuredPayload.body || '')
        : '';
    var messageTemplate = structuredPayload
      ? commandTemplate || bodyTemplate
      : command.message;
    var prepared = this.formulaEngine.prepareAIPrompt(
      targetSheetId,
      messageTemplate,
      {},
      {},
    );
    var outboundAttachments =
      buildChannelSendAttachmentsFromPreparedPrompt(prepared);
    var outboundBody = outboundAttachments.length
      ? stripChannelSendFileAndImagePlaceholders(prepared.userPrompt || '')
      : buildChannelSendBodyFromPreparedPrompt(prepared);
    var outboundPayload = structuredPayload
      ? Object.assign({}, structuredPayload, {
          to: normalizeChannelSendRecipients(structuredPayload.to),
          subj: String(structuredPayload.subj || ''),
          body: commandTemplate ? bodyTemplate : outboundBody,
          command: commandTemplate ? outboundBody : String(structuredPayload.command || ''),
          attachments: outboundAttachments,
        })
      : {
          body: outboundBody,
          attachments: outboundAttachments,
        };
    var commandLogMessage = outboundBody || messageTemplate || command.message;
    var payloadSignature = buildChannelSendPayloadSignature(outboundPayload);
    var previousDisplayValue = String(
      this.storage.getCellDisplayValue(targetSheetId, normalizedCellId) || '',
    );
    var lastSettled = this.channelCommandLastSettledByCell[commandCellKey];
    if (
      lastSettled &&
      lastSettled.signature === payloadSignature &&
      Date.now() - Number(lastSettled.timestamp || 0) <
        CHANNEL_COMMAND_REPEAT_DEDUPE_WINDOW_MS
    ) {
      return true;
    }
    if (this.channelCommandInFlightByCell[commandCellKey]) {
      if (
        this.channelCommandInFlightSignatureByCell[commandCellKey] ===
        payloadSignature
      ) {
        return true;
      }
      var queuedExisting = this.channelCommandQueuedByCell[commandCellKey];
      if (
        queuedExisting &&
        queuedExisting.signature &&
        queuedExisting.signature === payloadSignature
      ) {
        return true;
      }
      this.channelCommandQueuedByCell[commandCellKey] = {
        cellId: normalizedCellId,
        rawValue: raw,
        signature: payloadSignature,
        options: Object.assign({}, opts, {
          sheetId: targetSheetId,
          force: true,
        }),
      };
      return true;
    }

    this.channelCommandInFlightByCell[commandCellKey] = true;
    this.channelCommandInFlightSignatureByCell[commandCellKey] =
      payloadSignature;
    this.storage.setCellValue(targetSheetId, normalizedCellId, raw);
    this.storage.setCellRuntimeState(targetSheetId, normalizedCellId, {
      value: `Sending to /${command.label}...`,
      displayValue: `Sending to /${command.label}...`,
      state: 'pending',
      error: '',
    });
    this.renderCurrentSheetFromStorage();
    var activeCellId = this.getSelectionActiveCellId();
    if (
      targetSheetId === this.activeSheetId &&
      activeCellId === normalizedCellId
    ) {
      this.formulaInput.value = raw;
    }

    var finalizeChannelSend = () => {
      delete this.channelCommandInFlightByCell[commandCellKey];
      delete this.channelCommandInFlightSignatureByCell[commandCellKey];
      var queued = this.channelCommandQueuedByCell[commandCellKey];
      if (!queued) return;
      delete this.channelCommandQueuedByCell[commandCellKey];
      this.runChannelSendCommandForCell(
        queued.cellId,
        queued.rawValue,
        queued.options,
      );
    };

    Meteor.callAsync('channels.sendByLabel', command.label, outboundPayload)
      .then((result) => {
        var resultText = getChannelCommandResultText(result, command.label);
        var logEntry = buildChannelCommandLogEntry(
          new Date(),
          commandLogMessage,
          resultText,
        );
        this.storage.setCellRuntimeState(targetSheetId, normalizedCellId, {
          value: appendChannelCommandLog(previousDisplayValue, logEntry),
          displayValue: appendChannelCommandLog(previousDisplayValue, logEntry),
          state: 'resolved',
          error: '',
        });
        this.channelCommandLastSettledByCell[commandCellKey] = {
          signature: payloadSignature,
          timestamp: Date.now(),
        };
        this.renderCurrentSheetFromStorage();
        finalizeChannelSend();
      })
      .catch((error) => {
        var message = String(
          (error && (error.reason || error.message)) ||
            'Failed to send channel message',
        ).trim();
        var logEntry = buildChannelCommandLogEntry(
          new Date(),
          commandLogMessage,
          `ERROR: ${message}`,
        );
        this.storage.setCellRuntimeState(targetSheetId, normalizedCellId, {
          value: appendChannelCommandLog(previousDisplayValue, logEntry),
          displayValue: appendChannelCommandLog(previousDisplayValue, logEntry),
          state: 'error',
          error: message,
        });
        this.channelCommandLastSettledByCell[commandCellKey] = {
          signature: payloadSignature,
          timestamp: Date.now(),
        };
        this.renderCurrentSheetFromStorage();
        finalizeChannelSend();
      });
    return true;
  };

  SpreadsheetApp.prototype.dispatchDependentChannelCommandsForSource = function (sheetId, cellId) {
    var downstream = this.getTransitiveDependentSourceKeysForCell(
      String(sheetId || ''),
      String(cellId || '').toUpperCase(),
    );
    for (var i = 0; i < downstream.length; i += 1) {
      var parsed = this.parseDependencySourceKey(downstream[i]);
      if (!parsed) continue;
      var raw = String(
        this.storage.getCellValue(parsed.sheetId, parsed.cellId) || '',
      );
      if (!parseChannelSendCommand(raw)) continue;
      this.runChannelSendCommandForCell(parsed.cellId, raw, {
        sheetId: parsed.sheetId,
        force: true,
      });
    }
  };

  SpreadsheetApp.prototype.isGeneratedAIResultSourceRaw = function (rawValue) {
    var raw = String(rawValue == null ? '' : rawValue);
    if (!raw) return false;
    if (raw.charAt(0) === '>' || raw.charAt(0) === '#') return true;
    if (raw.charAt(0) !== '=') return false;
    return /(^|[^A-Za-z0-9_])(listAI|tableAI)\s*\(/i.test(raw.substring(1));
  };

  SpreadsheetApp.prototype.runQuotedPromptForCell = function (cellId, rawValue, inputElement) {
    var raw = String(rawValue == null ? '' : rawValue);
    if (!raw || raw.charAt(0) !== "'") return false;
    var activeCellId = this.getSelectionActiveCellId();
    this.captureHistorySnapshot(
      'cell:' + this.activeSheetId + ':' + String(cellId || '').toUpperCase(),
    );

    var prompt = raw.substring(1).trim();
    var updateFormulaBar = () => {
      if (activeCellId === cellId) {
        this.formulaInput.value = this.getRawCellValue(cellId);
      }
    };

    if (!prompt) {
      this.setRawCellValue(cellId, '');
      if (inputElement) inputElement.value = '';
      updateFormulaBar();
      this.computeAll();
      return true;
    }

    this.setRawCellValue(cellId, raw);
    if (inputElement) inputElement.value = raw;
    updateFormulaBar();
    this.aiService.withManualTrigger(() => this.computeAll());
    return true;
  };

  SpreadsheetApp.prototype.parseTablePromptSpec = function (rawValue) {
    var raw = String(rawValue == null ? '' : rawValue);
    if (!raw) return null;
    var marker = raw.charAt(0);
    if (marker !== '#') return null;

    var payload = raw.substring(1).trim();
    if (!payload) return { prompt: '', cols: null, rows: null };

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
        };
      }
    }

    return { prompt: payload, cols: null, rows: null };
  };

  SpreadsheetApp.prototype.parseChannelFeedPromptSpec = function (rawValue) {
    var raw = String(rawValue == null ? '' : rawValue);
    if (!raw || raw.charAt(0) !== '#') return null;

    var payload = raw.substring(1).trim();
    if (!payload) return null;

    var match = /^(\+)?(\d+)?\s*(.+)$/.exec(payload);
    if (!match) return null;

    var includeAttachments = match[1] === '+';
    var dayToken = String(match[2] || '').trim();
    var prompt = String(match[3] || '').trim();
    if (!prompt) return null;
    if (!/(^|[^A-Za-z0-9_:/])\/([A-Za-z][A-Za-z0-9_-]*)\b/.test(prompt))
      return null;

    var days = dayToken ? parseInt(dayToken, 10) : 1;
    if (isNaN(days) || days < 1) return null;

    return { prompt: prompt, days: days, includeAttachments: includeAttachments };
  };

  SpreadsheetApp.prototype.runTablePromptForCell = function (cellId, rawValue, inputElement) {
    var activeCellId = this.getSelectionActiveCellId();
    var channelSpec = this.parseChannelFeedPromptSpec(rawValue);
    if (channelSpec) {
      this.captureHistorySnapshot(
        'cell:' + this.activeSheetId + ':' + String(cellId || '').toUpperCase(),
      );
      this.setRawCellValue(cellId, String(rawValue));
      if (inputElement) inputElement.value = String(rawValue);
      if (activeCellId === cellId) this.formulaInput.value = String(rawValue);
      this.computeAll();
      return true;
    }
    var spec = this.parseTablePromptSpec(rawValue);
    if (!spec) return false;
    this.captureHistorySnapshot(
      'cell:' + this.activeSheetId + ':' + String(cellId || '').toUpperCase(),
    );
    var prompt = spec.prompt;
    if (!prompt) {
      this.setRawCellValue(cellId, '');
      if (inputElement) inputElement.value = '';
      if (activeCellId === cellId) this.formulaInput.value = '';
      this.computeAll();
      return true;
    }

    var sourceCellId = String(cellId || '').toUpperCase();
    var sourceRaw = String(rawValue == null ? '' : rawValue);

    this.setRawCellValue(cellId, sourceRaw);
    if (inputElement) inputElement.value = String(rawValue);
    if (activeCellId === cellId) this.formulaInput.value = String(rawValue);
    this.computeAll();

    var prepared = this.formulaEngine.prepareAIPrompt(
      this.activeSheetId,
      prompt,
      {},
      {},
    );
    var dependencies = this.formulaEngine.collectAIPromptDependencies(
      this.activeSheetId,
      prompt,
    );
    this.aiService
      .askTable(prepared.userPrompt, spec.cols, spec.rows, {
        onResult: (rows) => {
          if (String(this.getRawCellValue(sourceCellId) || '') !== sourceRaw) {
            return;
          }
          this.placeTableAtCell(sourceCellId, rows, true);
        },
        systemPrompt: prepared.systemPrompt,
        userContent: prepared.userContent,
        queueMeta: {
          formulaKind: 'table',
          sourceCellId: sourceCellId,
          promptTemplate: prompt,
          colsLimit: spec.cols,
          rowsLimit: spec.rows,
          dependencies: dependencies,
        },
      })
      .then(() => {
        if (String(this.getRawCellValue(sourceCellId) || '') === sourceRaw) {
          this.computeAll();
        }
      })
      .catch((err) => {
        if (String(this.getRawCellValue(sourceCellId) || '') !== sourceRaw) {
          return;
        }
        var message =
          '#AI_ERROR: ' + (err && err.message ? err.message : String(err));
        this.setRawCellValue(sourceCellId, sourceRaw);
        var parsed = this.parseCellId(sourceCellId);
        if (parsed) {
          var errCellId = this.formatCellId(parsed.col, parsed.row + 1);
          if (this.inputById[errCellId]) this.setRawCellValue(errCellId, message);
        }
        if (this.getSelectionActiveCellId() === sourceCellId) {
          this.formulaInput.value = sourceRaw;
        }
        this.computeAll();
      });
    return true;
  };

  SpreadsheetApp.prototype.placeTableAtCell = function (cellId, rows, preserveSourceCell) {
    var start = this.parseCellId(cellId);
    if (!start) return;
    var sourceKey = String(cellId || '').toUpperCase();
    var matrix = Array.isArray(rows) ? rows : [];
    if (!matrix.length) {
      if (!preserveSourceCell) this.setRawCellValue(cellId, '');
      return;
    }

    var baseRow = start.row + (preserveSourceCell ? 1 : 0);
    var baseCol = start.col;

    for (var r = 0; r < matrix.length; r++) {
      var row = Array.isArray(matrix[r]) ? rows[r] : [rows[r]];
      for (var c = 0; c < row.length; c++) {
        var targetCellId = this.formatCellId(baseCol + c, baseRow + r);
        if (!this.inputById[targetCellId]) continue;
        this.setRawCellValue(
          targetCellId,
          String(row[c] == null ? '' : row[c]),
          { generatedBy: sourceKey },
        );
      }
    }
  };

  SpreadsheetApp.prototype.collectGeneratedResultCellIdsForSource = function (sheetId, sourceCellId, rawValue) {
    var sourceKey = String(sourceCellId || '').toUpperCase();
    var result = [];
    var seen = Object.create(null);
    var add = function (cellId) {
      var normalized = String(cellId || '').toUpperCase();
      if (!normalized || seen[normalized]) return;
      seen[normalized] = true;
      result.push(normalized);
    };

    var generatedIds =
      this.storage.listGeneratedCellsBySource(sheetId, sourceKey) || [];
    for (var i = 0; i < generatedIds.length; i++) add(generatedIds[i]);

    var raw = String(rawValue == null ? '' : rawValue);
    if (raw.charAt(0) !== '#') return result;
    if (this.parseChannelFeedPromptSpec(raw)) return result;
    if (
      !this.formulaEngine ||
      typeof this.formulaEngine.readTableShortcutMatrix !== 'function'
    ) {
      return result;
    }

    var source = this.parseCellId(sourceKey);
    if (!source) return result;
    var matrix = this.formulaEngine.readTableShortcutMatrix(
      sheetId,
      sourceKey,
      {},
      {},
    );
    var rows = Array.isArray(matrix) ? matrix : [];
    for (var rowIndex = 0; rowIndex < rows.length; rowIndex++) {
      var rowValues = Array.isArray(rows[rowIndex]) ? rows[rowIndex] : [];
      for (var colIndex = 0; colIndex < rowValues.length; colIndex++) {
        add(this.formatCellId(source.col + colIndex, source.row + 1 + rowIndex));
      }
    }
    return result;
  };

  SpreadsheetApp.prototype.clearGeneratedResultCellsForSource = function (sheetId, sourceCellId, rawValue) {
    var generatedIds = this.collectGeneratedResultCellIdsForSource(
      sheetId,
      sourceCellId,
      rawValue,
    );
    var computedCache = this.computedValuesBySheet[sheetId];
    for (var i = 0; i < generatedIds.length; i++) {
      var targetCellId = String(generatedIds[i] || '').toUpperCase();
      if (computedCache) delete computedCache[targetCellId];
      this.storage.setCellValue(sheetId, targetCellId, '', { generatedBy: '' });
    }
    return generatedIds.length;
  };
}
