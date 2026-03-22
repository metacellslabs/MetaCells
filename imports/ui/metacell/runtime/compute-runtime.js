import { Meteor } from 'meteor/meteor';
import { traceCellUpdateClient } from '../../../lib/cell-update-profile.js';
import {
  collectLocalChannelCommandRuntimeState,
  getRenderTargetsForComputeResult,
  restoreLocalChannelCommandRuntimeState,
  syncFormulaBarWithActiveCell,
} from './compute-support-runtime.js';
import {
  applyRightOverflowText,
  measureOutputRequiredWidth,
  updateWrappedRowHeights,
} from './compute-layout-runtime.js';
import {
  applyComputedCellRender,
  clearComputedCellRenderState,
} from './compute-render-runtime.js';
import { getViewportInputRenderTargets } from './viewport-render-runtime.js';

function getInputRowIndex(app, input) {
  if (!input) return 0;
  var row =
    input.parentElement && input.parentElement.parentElement
      ? input.parentElement.parentElement
      : null;
  if (row && Number(row.rowIndex) > 0) return Number(row.rowIndex);
  var parsed =
    typeof app.parseCellId === 'function' ? app.parseCellId(input.id) : null;
  return parsed && parsed.row ? parsed.row : 0;
}

function buildDirtyLayoutOptions(inputs) {
  var dirtyRows = {};
  var dirtyCount = 0;
  var items = Array.isArray(inputs) ? inputs : [];
  for (var i = 0; i < items.length; i++) {
    var input = items[i];
    var rowIndex = getInputRowIndex(null, input);
    if (!Number.isFinite(rowIndex) || rowIndex < 1 || dirtyRows[rowIndex]) continue;
    dirtyRows[rowIndex] = true;
    dirtyCount++;
  }
  if (!dirtyCount) return null;
  return {
    rowIndexes: Object.keys(dirtyRows).map(function (rowIndex) {
      return Number(rowIndex);
    }),
  };
}

function collectFormulaProbeInputs(app, options) {
  if (!app) return [];
  if (options && options.includeDetached && Array.isArray(app.inputs)) {
    return app.inputs;
  }
  return typeof app.getMountedInputs === 'function'
    ? app.getMountedInputs()
    : app.inputs || [];
}

export function renderCurrentSheetFromStorage(app) {
  var options =
    arguments.length > 1 && arguments[1] && typeof arguments[1] === 'object'
      ? arguments[1]
      : {};
  if (app.isReportActive()) {
    app.renderReportLiveValues(true);
    return;
  }

  if (
    app.storage &&
    app.storage.storage &&
    typeof app.storage.storage.snapshot === 'function'
  ) {
    app.ensureGridCapacityForStorage(app.storage.storage.snapshot());
  }

  var formulaCount = 0;
  var mountedInputs = collectFormulaProbeInputs(app);
  for (var i = 0; i < mountedInputs.length; i++) {
    var probeRaw = app.getRawCellValue(mountedInputs[i].id);
    if (
      probeRaw &&
      (probeRaw.charAt(0) === '=' ||
        probeRaw.charAt(0) === '>' ||
        probeRaw.charAt(0) === '#' ||
        probeRaw.charAt(0) === "'")
    )
      formulaCount++;
  }
  var formulaDone = 0;
  app.updateCalcProgress(0, formulaCount);
  var renderInputs = getViewportInputRenderTargets(app, mountedInputs, options);
  app.renderedViewportInputCount = renderInputs.length;
  app.lastRenderedViewportRowRange = null;
  app.lastRenderedViewportReason = String(options.reason || '');
  app.lastRenderedViewportAt = Date.now();
  app.lastRenderedViewportInputIds = renderInputs.map(function (input) {
    return input.id;
  });
  app.lastRenderedViewportRowRange =
    renderInputs.length
      ? {
          startRow: Math.min.apply(
            null,
            renderInputs.map(function (input) {
              return getInputRowIndex(app, input);
            }),
          ),
          endRow: Math.max.apply(
            null,
            renderInputs.map(function (input) {
              return getInputRowIndex(app, input);
            }),
          ),
        }
      : null;
  renderInputs.forEach((input) => {
    try {
      var model = applyComputedCellRender(app, input, {
        showFormulas: app.displayMode === 'formulas',
      });
      if (model.isFormula) {
        formulaDone++;
        app.updateCalcProgress(formulaDone, formulaCount);
      }
    } catch (e) {
      clearComputedCellRenderState(input, app);
    }
  });

  var layoutOptions = buildDirtyLayoutOptions(renderInputs);
  updateWrappedRowHeights(app, layoutOptions);
  applyRightOverflowText(app, layoutOptions);
  app.applyDependencyHighlight();
  syncFormulaBarWithActiveCell(app);
  if (typeof app.syncEditorOverlay === 'function') app.syncEditorOverlay();
  app.syncAIModeUI();
  app.renderReportLiveValues(true);
  app.finishCalcProgress(formulaCount);
}

export function computeAll(app) {
  var options = arguments.length > 1 ? arguments[1] : {};
  var trace =
    options && options.trace && typeof options.trace === 'object'
      ? options.trace
      : null;
  var isManualTrigger = !!(options && options.manualTriggerAI);
  app.backgroundComputeEnabled = true;
  if (app.isReportActive()) {
    app.renderReportLiveValues();
    return;
  }
  if (
    !options.forceRefreshAI &&
    !options.bypassPendingEdit &&
    app.hasPendingLocalEdit()
  ) {
    return;
  }
  app.ensureActiveCell();

  var formulaCount = 0;
  var computeProbeInputs = collectFormulaProbeInputs(app, { includeDetached: true });
  for (var i = 0; i < computeProbeInputs.length; i++) {
    var probeRaw = app.getRawCellValue(computeProbeInputs[i].id);
    if (
      probeRaw &&
      (probeRaw.charAt(0) === '=' ||
        probeRaw.charAt(0) === '>' ||
        probeRaw.charAt(0) === '#' ||
        probeRaw.charAt(0) === "'")
    )
      formulaCount++;
  }
  var formulaDone = 0;
  app.updateCalcProgress(0, formulaCount);

  var didResort = app.applyAutoResort();
  var requestToken = ++app.computeRequestToken;
  var activeSheetId =
    typeof app.getVisibleSheetId === 'function'
      ? app.getVisibleSheetId()
      : app.activeSheetId;
  if (isManualTrigger) {
    app.isManualAIUpdating = true;
    app.manualUpdateRequestToken = requestToken;
    app.syncAIModeUI();
  }
  var finishManualUpdate = function () {
    if (!isManualTrigger) return;
    if (app.manualUpdateRequestToken !== requestToken) return;
    app.isManualAIUpdating = false;
    app.manualUpdateRequestToken = 0;
    app.syncAIModeUI();
  };
  traceCellUpdateClient(trace, 'compute_call.start', {
    activeSheetId: activeSheetId,
    forceRefreshAI: !!options.forceRefreshAI,
    manualTriggerAI: isManualTrigger,
  });
  Meteor.callAsync('sheets.computeGrid', app.sheetDocumentId, activeSheetId, {
    forceRefreshAI: !!options.forceRefreshAI,
    manualTriggerAI: isManualTrigger,
    traceId: trace && trace.id ? trace.id : '',
    workbookSnapshot:
      app.storage &&
      app.storage.storage &&
      typeof app.storage.storage.snapshot === 'function'
        ? app.storage.storage.snapshot()
        : {},
  })
    .then((result) => {
      var preservedChannelCommandState =
        result && result.workbook
          ? collectLocalChannelCommandRuntimeState(app)
          : [];
      traceCellUpdateClient(trace, 'compute_call.done', {
        returnedValues:
          result && result.values ? Object.keys(result.values).length : 0,
        hasWorkbook: !!(result && result.workbook),
      });
      if (requestToken !== app.computeRequestToken) {
        finishManualUpdate();
        return;
      }
      var currentVisibleSheetId =
        typeof app.getVisibleSheetId === 'function'
          ? app.getVisibleSheetId()
          : app.activeSheetId;
      if (activeSheetId !== currentVisibleSheetId) {
        finishManualUpdate();
        return;
      }

      if (
        result &&
        result.workbook &&
        app.storage.storage &&
        typeof app.storage.storage.replaceAll === 'function'
      ) {
        app.storage.storage.replaceAll(result.workbook);
        restoreLocalChannelCommandRuntimeState(
          app,
          preservedChannelCommandState,
        );
      }

      if (result && result.workbook) {
        app.ensureGridCapacityForStorage(result.workbook);
      }

      app.computedValuesBySheet[activeSheetId] =
        result && result.values ? result.values : {};
      if (result && result.workbook) {
        renderCurrentSheetFromStorage(app);
        finishManualUpdate();
        return;
      }
      var computedValues = app.computedValuesBySheet[activeSheetId] || {};
      var renderTargets = getRenderTargetsForComputeResult(
        app,
        computedValues,
        didResort,
      );
      renderTargets = getViewportInputRenderTargets(app, renderTargets, {
        alwaysIncludeInputs: renderTargets,
      });
      var renderSheetId =
        typeof app.getVisibleSheetId === 'function'
          ? app.getVisibleSheetId()
          : app.activeSheetId;
      var renderFn = () => {
        renderTargets.forEach((input) => {
          try {
            var raw = app.getRawCellValue(input.id);
            var model = applyComputedCellRender(app, input, {
              raw: raw,
              storedDisplay: app.storage.getCellDisplayValue(
                renderSheetId,
                input.id,
              ),
              storedComputed: app.storage.getCellComputedValue(
                renderSheetId,
                input.id,
              ),
              cellState: app.storage.getCellState(
                renderSheetId,
                input.id,
              ),
              errorHint: app.storage.getCellError(
                renderSheetId,
                input.id,
              ),
              generatedBy: app.storage.getGeneratedCellSource(
                renderSheetId,
                input.id,
              ),
              showFormulas: app.displayMode === 'formulas',
            });
            if (model.isFormula) {
              formulaDone++;
              app.updateCalcProgress(formulaDone, formulaCount);
            }
          } catch (e) {
            clearComputedCellRenderState(input, app);
          }
        });
      };
      if (renderTargets.length) {
        if (didResort) app.runWithAISuppressed(renderFn);
        else renderFn();
        var layoutOptions = buildDirtyLayoutOptions(renderTargets);
        updateWrappedRowHeights(app, layoutOptions);
        applyRightOverflowText(app, layoutOptions);
      }

      syncFormulaBarWithActiveCell(app);

      app.syncAIModeUI();
      app.applyDependencyHighlight();
      if (typeof app.syncEditorOverlay === 'function') app.syncEditorOverlay();
      app.renderReportLiveValues();
      app.finishCalcProgress(formulaCount);
      finishManualUpdate();
      traceCellUpdateClient(trace, 'render.done', {
        renderTargets: renderTargets.length,
        didResort: !!didResort,
      });
    })
    .catch((error) => {
      console.error('[sheet] computeAll failed', error);
      finishManualUpdate();
      app.syncAIModeUI();
      app.finishCalcProgress(formulaCount);
      traceCellUpdateClient(trace, 'compute_call.failed', {
        message: String(error && error.message ? error.message : error || ''),
      });
    });
}

export function hasUncomputedCells(app) {
  if (app.isReportActive()) return false;
  var inputs =
    typeof app.getMountedInputs === 'function' ? app.getMountedInputs() : app.inputs;
  for (var i = 0; i < inputs.length; i++) {
    var input = inputs[i];
    var raw = app.getRawCellValue(input.id);
    if (!raw || (raw.charAt(0) !== '=' && raw.charAt(0) !== '>')) continue;

    var output = input.parentElement.querySelector('.cell-output');
    var shown = output ? String(output.textContent || '').trim() : '';
    if (shown === '...') return true;
  }
  return false;
}

export function startUncomputedMonitor(app) {
  if (app.uncomputedMonitorId) clearInterval(app.uncomputedMonitorId);

  app.uncomputedMonitorId = setInterval(() => {
    if (!app.backgroundComputeEnabled) return;
    if (app.hasPendingLocalEdit()) return;
    if (app.aiService.hasInFlightWork()) return;
    if (!hasUncomputedCells(app)) return;
    app.computeAll();
  }, app.uncomputedMonitorMs);
}
