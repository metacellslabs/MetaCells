import { AI_MODE } from './constants.js';
import { buildCellRenderModel } from './cell-render-model.js';
import { ensureGridCellChrome } from './grid-cell-runtime.js';

function buildRenderSignature(app, model) {
  if (!model) return '';
  return JSON.stringify({
    displayMode: app && app.displayMode ? app.displayMode : 'values',
    aiMode:
      app && app.aiService && typeof app.aiService.getMode === 'function'
        ? String(app.aiService.getMode() || '')
        : '',
    isEditing: !!model.isEditing,
    isFormula: !!model.isFormula,
    displayValue: String(model.displayValue == null ? '' : model.displayValue),
    errorHint: String(model.errorHint || ''),
    cellState: String(model.cellState || ''),
    generatedBy: String(model.generatedBy || ''),
    attachmentName:
      model.attachment && model.attachment.name
        ? String(model.attachment.name)
        : '',
    attachmentType:
      model.attachment && model.attachment.type
        ? String(model.attachment.type)
        : '',
    showAISkeleton: !!model.showAISkeleton,
    aiSkeletonVariant: String(model.aiSkeletonVariant || ''),
    highlightEmptyMentioned: !!model.highlightEmptyMentioned,
    scheduleTitle: String(model.scheduleTitle || ''),
    formatMeta: model.formatMeta || null,
    literalDisplay: !!model.literalDisplay,
    showFormulas: !!model.showFormulas,
  });
}

export function applyComputedCellRender(app, input, options) {
  var opts = options && typeof options === 'object' ? options : {};
  var targetSheetId =
    app && typeof app.getVisibleSheetId === 'function'
      ? app.getVisibleSheetId()
      : app.activeSheetId;
  var modelOptions = {
    isEditing:
      Object.prototype.hasOwnProperty.call(opts, 'isEditing')
        ? opts.isEditing
        : app && typeof app.isEditingCell === 'function'
          ? app.isEditingCell(input)
          : document.activeElement === input,
    showFormulas:
      Object.prototype.hasOwnProperty.call(opts, 'showFormulas')
        ? opts.showFormulas
        : app.displayMode === 'formulas',
  };
  if (Object.prototype.hasOwnProperty.call(opts, 'raw')) {
    modelOptions.raw = opts.raw;
  }
  if (Object.prototype.hasOwnProperty.call(opts, 'storedDisplay')) {
    modelOptions.storedDisplay = opts.storedDisplay;
  }
  if (Object.prototype.hasOwnProperty.call(opts, 'storedComputed')) {
    modelOptions.storedComputed = opts.storedComputed;
  }
  if (Object.prototype.hasOwnProperty.call(opts, 'cellState')) {
    modelOptions.cellState = opts.cellState;
  }
  if (Object.prototype.hasOwnProperty.call(opts, 'errorHint')) {
    modelOptions.errorHint = opts.errorHint;
  }
  if (Object.prototype.hasOwnProperty.call(opts, 'generatedBy')) {
    modelOptions.generatedBy = opts.generatedBy;
  }
  var model = buildCellRenderModel(
    app,
    targetSheetId,
    input.id,
    modelOptions,
  );
  var renderSignature = buildRenderSignature(app, model);
  var cell = input.parentElement;
  if (cell) {
    ensureGridCellChrome(cell, input);
  }
  if (cell && cell.dataset.renderSignature === renderSignature) {
    model.renderSkipped = true;
    return model;
  }

  input.parentElement.classList.toggle(
    'manual-formula',
    app.aiService.getMode() === AI_MODE.manual && model.isFormula,
  );
  input.parentElement.classList.toggle('has-formula', model.isFormula);
  input.parentElement.classList.toggle(
    'empty-mentioned-cell',
    model.highlightEmptyMentioned,
  );
  input.parentElement.classList.toggle(
    'has-display-value',
    String(model.displayValue == null ? '' : model.displayValue) !== '',
  );
  input.parentElement.classList.toggle('has-attachment', !!model.attachment);
  input.parentElement.classList.toggle('has-error', !!model.errorHint);
  if (model.errorHint) {
    input.parentElement.setAttribute('data-error-hint', model.errorHint);
  } else {
    input.parentElement.removeAttribute('data-error-hint');
  }
  app.grid.renderCellValue(input, model.displayValue, model.isEditing, model.isFormula, {
    literal: model.showFormulas ? true : model.literalDisplay,
    attachment: model.attachment,
    aiSkeleton: model.showAISkeleton,
    aiSkeletonVariant: model.aiSkeletonVariant,
    error: !!model.errorHint,
    state: model.cellState,
    alignRight: !model.showFormulas && model.formatMeta.isNumeric,
    align: model.showFormulas ? 'left' : model.formatMeta.align,
    wrapText: !model.showFormulas && model.formatMeta.wrapText,
    bold: !model.showFormulas && model.formatMeta.bold,
    italic: !model.showFormulas && model.formatMeta.italic,
    backgroundColor: !model.showFormulas ? model.formatMeta.backgroundColor : '',
    fontFamily: !model.showFormulas ? model.formatMeta.fontFamily : 'default',
    fontSize: !model.showFormulas ? model.formatMeta.fontSize : 14,
    borders: model.formatMeta.borders,
    hasSchedule: !!model.cellSchedule,
    scheduleTitle: model.scheduleTitle,
  });
  if (cell) {
    cell.dataset.renderSignature = renderSignature;
    cell.removeAttribute('data-viewport-pruned');
  }
  return model;
}

export function clearComputedCellRenderState(input, app) {
  if (!input || !input.parentElement) return;
  input.parentElement.classList.remove('manual-formula');
  input.parentElement.classList.remove('has-formula');
  input.parentElement.classList.remove('empty-mentioned-cell');
  input.parentElement.classList.remove('has-display-value');
  input.parentElement.classList.remove('has-attachment');
  input.parentElement.classList.remove('has-error');
  input.parentElement.removeAttribute('data-error-hint');
  input.parentElement.removeAttribute('data-render-signature');
  if (
    app &&
    app.cellContentStore &&
    typeof app.cellContentStore.resetCell === 'function'
  ) {
    app.cellContentStore.resetCell(input.id);
  }
}
