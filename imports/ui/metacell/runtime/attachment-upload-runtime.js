import { Meteor } from 'meteor/meteor';
import { openAttachmentContentPreview } from './attachment-preview-runtime.js';

function getVisibleSheetId(app) {
  return typeof app.getVisibleSheetId === 'function'
    ? String(app.getVisibleSheetId() || '')
    : String(app.activeSheetId || '');
}

function getAttachmentDisplayValue(app, rawValue) {
  var raw = String(rawValue == null ? '' : rawValue);
  var attachment = app.parseAttachmentSource(raw);
  if (!attachment) return raw;
  return String(
    attachment.name ||
      (attachment.converting
        ? 'Converting file...'
        : attachment.pending
          ? 'Choose file'
          : 'Attached file'),
  );
}

function syncActiveAttachmentValue(app, cellId, rawValue) {
  if (String(app.activeCellId || '') !== String(cellId || '').toUpperCase()) {
    return;
  }
  var displayValue = getAttachmentDisplayValue(app, rawValue);
  app.syncActiveEditorValue(displayValue);
}

function refreshAttachmentUi(app, sheetId) {
  if (!app) return;
  var visibleSheetId = getVisibleSheetId(app);
  var targetSheetId = String(sheetId || visibleSheetId || '');
  if (
    targetSheetId &&
    visibleSheetId === targetSheetId &&
    typeof app.renderCurrentSheetFromStorage === 'function'
  ) {
    app.renderCurrentSheetFromStorage();
    return;
  }
  if (typeof app.renderReportLiveValues === 'function') {
    app.renderReportLiveValues(true);
  }
}

function revealAttachmentCell(app, sheetId, cellId) {
  if (!app || !app.grid) return;
  var targetSheetId = String(sheetId || '');
  var targetCellId = String(cellId || '').toUpperCase();
  if (!targetSheetId || !targetCellId) return;
  if (getVisibleSheetId(app) !== targetSheetId) return;
  var input =
    typeof app.getCellInput === 'function'
      ? app.getCellInput(targetCellId)
      : app.inputById
        ? app.inputById[targetCellId]
        : null;
  if (!input || typeof app.grid.setEditing !== 'function') return;
  app.grid.setEditing(input, false);
}

export function arrayBufferToBase64(app, buffer) {
  var bytes = new Uint8Array(buffer || new ArrayBuffer(0));
  var chunkSize = 0x8000;
  var binary = '';
  for (var i = 0; i < bytes.length; i += chunkSize) {
    var chunk = bytes.subarray(i, i + chunkSize);
    binary += String.fromCharCode.apply(null, chunk);
  }
  return window.btoa(binary);
}

export function readAttachedFileContent(app, file, preparedBase64) {
  if (!file || typeof file.arrayBuffer !== 'function') {
    return Promise.reject(new Error('Failed to read file'));
  }
  var base64Promise =
    typeof preparedBase64 === 'string' && preparedBase64
      ? Promise.resolve(preparedBase64)
      : file.arrayBuffer().then((buffer) => arrayBufferToBase64(app, buffer));
  return base64Promise
    .then((base64) =>
      Meteor.callAsync(
        'files.extractContent',
        String(file.name || 'Attached file'),
        String(file.type || ''),
        base64,
      ),
    )
    .then((result) => ({
      content: String(result && result.content != null ? result.content : ''),
      contentArtifactId: String((result && result.contentArtifactId) || ''),
      binaryArtifactId: String((result && result.binaryArtifactId) || ''),
      downloadUrl: String((result && result.downloadUrl) || ''),
      previewUrl: String((result && result.previewUrl) || ''),
    }));
}

export function setupAttachmentUploadControls(app) {
  app.syncAttachButtonState();
  if (app.attachFileButton) {
    app.attachFileButton.addEventListener('click', () => {
      var cellId = String(app.activeCellId || '').toUpperCase();
      var visibleSheetId = getVisibleSheetId(app);
      if (!app.hasSingleSelectedCell() || !cellId || !app.attachFileInput) return;
      var previousValue = app.getRawCellValue(cellId);
      app.pendingAttachmentContext = {
        sheetId: visibleSheetId,
        cellId: cellId,
        previousValue: String(previousValue == null ? '' : previousValue),
      };
      var pendingSource = app.buildAttachmentSource({ pending: true });
      app.applyRawCellUpdate(visibleSheetId, cellId, pendingSource);
      syncActiveAttachmentValue(app, cellId, pendingSource);
      revealAttachmentCell(app, visibleSheetId, cellId);
      refreshAttachmentUi(app, visibleSheetId);
    });
  }

  if (app.table) {
    app.table.addEventListener('click', (e) => {
      var contentPreviewButton =
        e.target && e.target.closest
          ? e.target.closest(
              '.attachment-content-preview, .generated-attachment-content-preview',
            )
          : null;
      var downloadLink =
        e.target && e.target.closest
          ? e.target.closest('.attachment-download')
          : null;
      var selectButton =
        e.target && e.target.closest
          ? e.target.closest('.attachment-select')
          : null;
      var removeButton =
        e.target && e.target.closest
          ? e.target.closest('.attachment-remove')
          : null;
      if (contentPreviewButton) {
        var previewTd =
          e.target && e.target.closest ? e.target.closest('td') : null;
        var previewInput = previewTd
          ? previewTd.querySelector('.cell-anchor-input')
          : null;
        if (!previewInput) return;
        e.preventDefault();
        e.stopPropagation();
        openAttachmentContentPreview(
          app,
          getVisibleSheetId(app),
          String(previewInput.id || '').toUpperCase(),
        );
        return;
      }
      if (downloadLink) {
        e.stopPropagation();
        return;
      }
      if (!selectButton && !removeButton) return;
      var td = e.target && e.target.closest ? e.target.closest('td') : null;
      var input = td ? td.querySelector('.cell-anchor-input') : null;
      if (!input) return;
      e.preventDefault();
      e.stopPropagation();
      app.setActiveInput(input);
      if (removeButton) {
        var visibleSheetId = getVisibleSheetId(app);
        app.captureHistorySnapshot(
          'attachment:' +
            visibleSheetId +
            ':' +
            String(input.id || '').toUpperCase(),
        );
        var pendingSource = app.buildAttachmentSource({ pending: true });
        app.applyRawCellUpdate(visibleSheetId, input.id, pendingSource);
        syncActiveAttachmentValue(app, input.id, pendingSource);
        revealAttachmentCell(
          app,
          visibleSheetId,
          String(input.id || '').toUpperCase(),
        );
        refreshAttachmentUi(app, visibleSheetId);
        return;
      }
      var previousRaw = app.getRawCellValue(input.id);
      app.pendingAttachmentContext = {
        sheetId: getVisibleSheetId(app),
        cellId: String(input.id || '').toUpperCase(),
        previousValue: String(previousRaw == null ? '' : previousRaw),
      };
      app.attachFileInput.value = '';
      app.attachFileInput.click();
    });
  }

  if (app.attachFileInput) {
    app.attachFileInput.addEventListener('change', async () => {
      var ctx = app.pendingAttachmentContext;
      app.pendingAttachmentContext = null;
      if (!ctx) return;

      var file = app.attachFileInput.files && app.attachFileInput.files[0];
      if (!file) {
        app.applyRawCellUpdate(ctx.sheetId, ctx.cellId, ctx.previousValue);
        syncActiveAttachmentValue(app, ctx.cellId, ctx.previousValue);
        revealAttachmentCell(app, ctx.sheetId, ctx.cellId);
        refreshAttachmentUi(app, ctx.sheetId);
        return;
      }

      try {
        var convertingSource = app.buildAttachmentSource({
          name: file.name || 'Attached file',
          type: file.type || '',
          pending: true,
          converting: true,
        });
        app.applyRawCellUpdate(ctx.sheetId, ctx.cellId, convertingSource);
        syncActiveAttachmentValue(app, ctx.cellId, convertingSource);
        revealAttachmentCell(app, ctx.sheetId, ctx.cellId);
        refreshAttachmentUi(app, ctx.sheetId);
        var base64 = await file
          .arrayBuffer()
          .then((buffer) => arrayBufferToBase64(app, buffer));
        var extracted = await readAttachedFileContent(app, file, base64);
        var attachmentSource = app.buildAttachmentSource({
          name: file.name || 'Attached file',
          type: file.type || '',
          content: extracted && extracted.content,
          contentArtifactId: extracted && extracted.contentArtifactId,
          binaryArtifactId: extracted && extracted.binaryArtifactId,
          downloadUrl: extracted && extracted.downloadUrl,
          previewUrl: extracted && extracted.previewUrl,
          pending: false,
        });
        app.captureHistorySnapshot(
          'attachment:' +
            String(ctx.sheetId || '') +
            ':' +
            String(ctx.cellId || '').toUpperCase(),
        );
        app.applyRawCellUpdate(ctx.sheetId, ctx.cellId, attachmentSource);
        syncActiveAttachmentValue(app, ctx.cellId, attachmentSource);
        revealAttachmentCell(app, ctx.sheetId, ctx.cellId);
        refreshAttachmentUi(app, ctx.sheetId);
      } catch (error) {
        app.applyRawCellUpdate(ctx.sheetId, ctx.cellId, ctx.previousValue);
        syncActiveAttachmentValue(app, ctx.cellId, ctx.previousValue);
        revealAttachmentCell(app, ctx.sheetId, ctx.cellId);
        refreshAttachmentUi(app, ctx.sheetId);
        window.alert(
          error && error.message ? error.message : 'Failed to read file',
        );
      }
    });
  }
}
