import { parseChannelSendCommand } from '../../../api/channels/commands.js';

export function installRecomputeMethods(SpreadsheetApp) {
  SpreadsheetApp.prototype.hasDownstreamDependents = function (cellId) {
    return this.getDependentSourceKeysForActiveCell(cellId).length > 0;
  };

  SpreadsheetApp.prototype.hasDownstreamDependentsForCell = function (sheetId, cellId) {
    return this.getTransitiveDependentSourceKeysForCell(sheetId, cellId).length > 0;
  };

  SpreadsheetApp.prototype.parseDependencySourceKey = function (sourceKey) {
    var normalized = String(sourceKey || '');
    var separatorIndex = normalized.indexOf(':');
    if (separatorIndex === -1) return null;
    return {
      sheetId: normalized.slice(0, separatorIndex),
      cellId: normalized.slice(separatorIndex + 1).toUpperCase(),
    };
  };

  SpreadsheetApp.prototype.getTransitiveDependentSourceKeys = function (cellId) {
    return this.getTransitiveDependentSourceKeysForCell(
      this.activeSheetId,
      cellId,
    );
  };

  SpreadsheetApp.prototype.getTransitiveDependentSourceKeysForCell = function (sheetId, cellId) {
    var graph = this.storage.getDependencyGraph();
    var startKey =
      String(sheetId || '') +
      ':' +
      String(cellId || '').toUpperCase();
    var queue = [];
    var seen = Object.create(null);
    var result = [];
    var enqueue = function (key) {
      var normalized = String(key || '');
      if (!normalized || seen[normalized]) return;
      seen[normalized] = true;
      queue.push(normalized);
      result.push(normalized);
    };

    var direct =
      graph && graph.dependentsByCell ? graph.dependentsByCell[startKey] : [];
    direct = Array.isArray(direct) ? direct : [];
    for (var i = 0; i < direct.length; i++) enqueue(direct[i]);
    var scannedDirect = this.scanDependentSourceKeys(startKey);
    for (var s = 0; s < scannedDirect.length; s++) enqueue(scannedDirect[s]);

    var namedCells = this.storage.readNamedCells();
    for (var name in namedCells) {
      if (!Object.prototype.hasOwnProperty.call(namedCells, name)) continue;
      var ref = namedCells[name];
      if (!ref || ref.sheetId !== String(sheetId || '')) continue;
      if (
        String(ref.cellId || '').toUpperCase() !==
        String(cellId || '').toUpperCase()
      )
        continue;
      var namedDependents =
        graph && graph.dependentsByNamedRef
          ? graph.dependentsByNamedRef[String(name)]
          : [];
      namedDependents = Array.isArray(namedDependents) ? namedDependents : [];
      for (var j = 0; j < namedDependents.length; j++) {
        enqueue(namedDependents[j]);
      }
    }

    while (queue.length) {
      var current = queue.shift();
      var downstream =
        graph && graph.dependentsByCell ? graph.dependentsByCell[current] : [];
      downstream = Array.isArray(downstream) ? downstream : [];
      for (var d = 0; d < downstream.length; d++) enqueue(downstream[d]);
      var scannedDownstream = this.scanDependentSourceKeys(current);
      for (var sd = 0; sd < scannedDownstream.length; sd++) {
        enqueue(scannedDownstream[sd]);
      }
    }

    return result;
  };

  SpreadsheetApp.prototype.scanDependentSourceKeys = function (sourceKey) {
    var normalizedSourceKey = String(sourceKey || '');
    if (!normalizedSourceKey) return [];
    var separatorIndex = normalizedSourceKey.indexOf(':');
    if (separatorIndex === -1) return [];
    var targetSheetId = normalizedSourceKey.slice(0, separatorIndex);
    var targetCellId = normalizedSourceKey
      .slice(separatorIndex + 1)
      .toUpperCase();
    var results = [];
    var seen = Object.create(null);
    var escapeRegExp = function (value) {
      return String(value || '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    };
    var sourceNames = [];
    var namedCells = this.storage.readNamedCells();
    for (var name in namedCells) {
      if (!Object.prototype.hasOwnProperty.call(namedCells, name)) continue;
      var ref = namedCells[name];
      if (!ref || String(ref.sheetId || '') !== targetSheetId) continue;
      if (String(ref.cellId || '').toUpperCase() !== targetCellId) continue;
      sourceNames.push(String(name));
    }
    var allCells =
      this.storage && typeof this.storage.listAllCellIds === 'function'
        ? this.storage.listAllCellIds()
        : [];

    for (var i = 0; i < allCells.length; i++) {
      var entry = allCells[i];
      if (!entry || !entry.sheetId || !entry.cellId) continue;
      var sourceSheetId = String(entry.sheetId || '');
      var sourceCellId = String(entry.cellId || '').toUpperCase();
      var raw = String(
        this.storage.getCellValue(sourceSheetId, sourceCellId) || '',
      );
      var isChannelCommand = !!parseChannelSendCommand(raw);
      if (!this.isFormulaLikeRawValue(raw) && !isChannelCommand) continue;
      var dependencies = [];
      try {
        dependencies = this.formulaEngine.collectCellDependencies(
          sourceSheetId,
          sourceCellId,
        );
      } catch (error) {
        dependencies = [];
      }
      var matches = false;
      for (var d = 0; d < dependencies.length; d++) {
        var dependency = dependencies[d];
        if (!dependency || dependency.kind !== 'cell') continue;
        if (String(dependency.sheetId || '') !== targetSheetId) continue;
        if (String(dependency.cellId || '').toUpperCase() !== targetCellId) {
          continue;
        }
        matches = true;
        break;
      }
      if (!matches) {
        var body =
          raw.charAt(0) === '=' ||
          raw.charAt(0) === "'" ||
          raw.charAt(0) === '>' ||
          raw.charAt(0) === '#'
            ? raw.substring(1)
            : raw;
        if (sourceSheetId === targetSheetId) {
          var cellPattern = new RegExp(
            '(^|[^A-Za-z0-9_!])@?' + escapeRegExp(targetCellId) + '\\b',
            'i',
          );
          matches = cellPattern.test(body);
        }
        if (!matches && sourceNames.length) {
          for (var n = 0; n < sourceNames.length; n++) {
            var namedPattern = new RegExp(
              '(^|[^A-Za-z0-9_])@?' + escapeRegExp(sourceNames[n]) + '\\b',
              'i',
            );
            if (namedPattern.test(body)) {
              matches = true;
              break;
            }
          }
        }
      }
      if (!matches) continue;
      var key = sourceSheetId + ':' + sourceCellId;
      if (seen[key]) continue;
      seen[key] = true;
      results.push(key);
    }

    return results;
  };

  SpreadsheetApp.prototype.isExplicitAsyncFormulaRaw = function (rawValue) {
    var raw = String(rawValue == null ? '' : rawValue);
    if (!raw) return false;
    if (raw.charAt(0) === "'" || raw.charAt(0) === '>' || raw.charAt(0) === '#') {
      return true;
    }
    if (raw.charAt(0) !== '=') return false;
    var expression = raw.substring(1);
    if (/(^|[^A-Za-z0-9_])(askAI|listAI|recalc|update)\s*\(/i.test(expression)) {
      return true;
    }
    return false;
  };

  SpreadsheetApp.prototype.canLocallyResolveSyncSourceKey = function (sourceKey, trace) {
    var parsed = this.parseDependencySourceKey(sourceKey);
    if (!parsed) return false;
    var visiting = trace || Object.create(null);
    var normalizedKey = parsed.sheetId + ':' + parsed.cellId;
    if (visiting[normalizedKey]) return true;
    visiting[normalizedKey] = true;

    try {
      var raw = String(
        this.storage.getCellValue(parsed.sheetId, parsed.cellId) || '',
      );
      if (!raw || raw.charAt(0) !== '=') return false;
      if (this.isExplicitAsyncFormulaRaw(raw)) return false;
      if (this.parseAttachmentSource(raw)) return false;

      var deps =
        this.storage.getCellDependencies(parsed.sheetId, parsed.cellId) || {};
      if (Array.isArray(deps.channelLabels) && deps.channelLabels.length) {
        return false;
      }
      if (Array.isArray(deps.attachments) && deps.attachments.length) {
        return false;
      }

      var namedRefs = Array.isArray(deps.namedRefs) ? deps.namedRefs : [];
      for (var n = 0; n < namedRefs.length; n++) {
        var ref = this.storage.resolveNamedCell(namedRefs[n]);
        if (!ref || !ref.sheetId) return false;
        if (ref.cellId) {
          var namedRaw = String(
            this.storage.getCellValue(ref.sheetId, ref.cellId) || '',
          );
          if (this.isFormulaLikeRawValue(namedRaw)) {
            if (
              !this.canLocallyResolveSyncSourceKey(
                ref.sheetId + ':' + String(ref.cellId).toUpperCase(),
                visiting,
              )
            ) {
              return false;
            }
          }
        } else {
          return false;
        }
      }

      var cells = Array.isArray(deps.cells) ? deps.cells : [];
      for (var i = 0; i < cells.length; i++) {
        var entry = cells[i];
        if (!entry || typeof entry !== 'object') continue;
        var depSheetId = String(entry.sheetId || '');
        var depCellId = String(entry.cellId || '').toUpperCase();
        var depRaw = String(
          this.storage.getCellValue(depSheetId, depCellId) || '',
        );
        if (this.isFormulaLikeRawValue(depRaw)) {
          if (
            !this.canLocallyResolveSyncSourceKey(
              depSheetId + ':' + depCellId,
              visiting,
            )
          ) {
            return false;
          }
        }
      }

      return true;
    } finally {
      delete visiting[normalizedKey];
    }
  };

  SpreadsheetApp.prototype.collectLocalSyncRecomputePlan = function (cellId, rawValue) {
    var sheetId =
      typeof this.getVisibleSheetId === 'function'
        ? this.getVisibleSheetId()
        : this.activeSheetId;
    return this.collectLocalSyncRecomputePlanForCell(
      sheetId,
      cellId,
      rawValue,
    );
  };

  SpreadsheetApp.prototype.collectLocalSyncRecomputePlanForCell = function (sheetId, cellId, rawValue) {
    var normalizedCellId = String(cellId || '').toUpperCase();
    var raw = String(rawValue == null ? '' : rawValue);
    var targets = [];
    var seen = Object.create(null);
    var needsServer = false;
    var serverTargets = [];
    var add = function (key) {
      var normalized = String(key || '');
      if (!normalized || seen[normalized]) return;
      seen[normalized] = true;
      targets.push(normalized);
    };

    if (raw && raw.charAt(0) === '=') {
      add(String(sheetId || '') + ':' + normalizedCellId);
    }

    var downstream = this.getTransitiveDependentSourceKeysForCell(
      sheetId,
      normalizedCellId,
    );
    for (var i = 0; i < downstream.length; i++) {
      var parsedDownstream = this.parseDependencySourceKey(downstream[i]);
      if (!parsedDownstream) continue;
      var downstreamRaw = String(
        this.storage.getCellValue(parsedDownstream.sheetId, parsedDownstream.cellId) || '',
      );
      if (parseChannelSendCommand(downstreamRaw)) continue;
      add(downstream[i]);
    }

    if (!targets.length) {
      return {
        localTargets: [],
        serverTargets: [],
        needsServer: false,
      };
    }
    for (var t = 0; t < targets.length; t++) {
      if (
        !this.canLocallyResolveSyncSourceKey(targets[t], Object.create(null))
      ) {
        needsServer = true;
        serverTargets.push(targets[t]);
        targets.splice(t, 1);
        t -= 1;
      }
    }
    return {
      localTargets: targets,
      serverTargets: serverTargets,
      needsServer: needsServer,
    };
  };

  SpreadsheetApp.prototype.markServerRecomputeTargetsStale = function (sourceKeys) {
    var targets = Array.isArray(sourceKeys) ? sourceKeys : [];
    for (var i = 0; i < targets.length; i++) {
      var parsed = this.parseDependencySourceKey(targets[i]);
      if (!parsed) continue;
      var raw = String(
        this.storage.getCellValue(parsed.sheetId, parsed.cellId) || '',
      );
      if (!this.isFormulaLikeRawValue(raw)) continue;
      if (this.isGeneratedAIResultSourceRaw(raw)) {
        this.storage.clearGeneratedCellsBySource(parsed.sheetId, parsed.cellId);
      }
      var nextState = {
        state: 'stale',
        error: '',
      };
      if (this.isExplicitAsyncFormulaRaw(raw)) nextState.value = '';
      this.storage.setCellRuntimeState(parsed.sheetId, parsed.cellId, nextState);
    }
  };

  SpreadsheetApp.prototype.recomputeLocalSyncTargets = function (sourceKeys) {
    var targets = Array.isArray(sourceKeys) ? sourceKeys : [];
    if (!targets.length) return false;

    for (var i = 0; i < targets.length; i++) {
      var parsed = this.parseDependencySourceKey(targets[i]);
      if (!parsed) continue;
      try {
        var runtimeMeta = {};
        var value = this.formulaEngine.evaluateCell(
          parsed.sheetId,
          parsed.cellId,
          {},
          { forceRefreshAI: false, runtimeMeta: runtimeMeta },
        );
        var nextValue = String(value == null ? '' : value);
        var nextState = nextValue === '...' ? 'pending' : 'resolved';
        this.storage.setCellRuntimeState(parsed.sheetId, parsed.cellId, {
          value: nextValue,
          displayValue: String(runtimeMeta.displayValue || nextValue),
          state: nextState,
          error: '',
        });
        if (!this.computedValuesBySheet[parsed.sheetId]) {
          this.computedValuesBySheet[parsed.sheetId] = {};
        }
        this.computedValuesBySheet[parsed.sheetId][parsed.cellId] = nextValue;
      } catch (error) {
        var message = String(
          error && error.message ? error.message : error || '',
        );
        var displayValue =
          message === '#SELECT_FILE'
            ? '#SELECT_FILE'
            : message.indexOf('#REF!') === 0
              ? '#REF!'
              : '#ERROR';
        this.storage.setCellRuntimeState(parsed.sheetId, parsed.cellId, {
          value: displayValue,
          state: 'error',
          error: message || displayValue,
        });
        if (!this.computedValuesBySheet[parsed.sheetId]) {
          this.computedValuesBySheet[parsed.sheetId] = {};
        }
        this.computedValuesBySheet[parsed.sheetId][parsed.cellId] =
          displayValue;
      }
    }
    return true;
  };

  SpreadsheetApp.prototype.applyRawCellUpdate = function (sheetId, cellId, rawValue, meta) {
    var targetSheetId = String(sheetId || '');
    var normalizedCellId = String(cellId || '').toUpperCase();
    var raw = String(rawValue == null ? '' : rawValue);
    this.storage.setCellValue(targetSheetId, normalizedCellId, raw, meta);
    this.syncCellDependencyHints(targetSheetId, normalizedCellId, raw);
    this.aiService.notifyActiveCellChanged();
    var recomputePlan = this.collectLocalSyncRecomputePlanForCell(
      targetSheetId,
      normalizedCellId,
      raw,
    );
    var localTargets =
      recomputePlan && Array.isArray(recomputePlan.localTargets)
        ? recomputePlan.localTargets
        : [];
    var serverTargets =
      recomputePlan && Array.isArray(recomputePlan.serverTargets)
        ? recomputePlan.serverTargets
        : [];
    var needsServer = !!(recomputePlan && recomputePlan.needsServer);
    if (localTargets.length) {
      this.recomputeLocalSyncTargets(localTargets);
    }
    if (serverTargets.length) {
      this.markServerRecomputeTargetsStale(serverTargets);
    }
    if (
      needsServer ||
      this.isFormulaLikeRawValue(raw) ||
      (serverTargets.length > 0 && !localTargets.length)
    ) {
      this.computeAll({ bypassPendingEdit: true });
    }
    var attachment = this.parseAttachmentSource(raw);
    if (!attachment || (!attachment.pending && !attachment.converting)) {
      this.dispatchDependentChannelCommandsForSource(
        targetSheetId,
        normalizedCellId,
      );
    }
  };
}
