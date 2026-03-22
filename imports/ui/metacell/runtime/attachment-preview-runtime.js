import { Meteor } from 'meteor/meteor';

function getVisibleSheetId(app) {
  return typeof app.getVisibleSheetId === 'function'
    ? String(app.getVisibleSheetId() || '')
    : String(app.activeSheetId || '');
}

function resolveCellAttachment(app, sheetId, cellId) {
  if (!app || typeof app.parseAttachmentSource !== 'function') return null;
  var raw = app.storage.getCellValue(sheetId, cellId);
  var computed = app.storage.getCellComputedValue(sheetId, cellId);
  var display = app.storage.getCellDisplayValue(sheetId, cellId);
  return (
    app.parseAttachmentSource(raw) ||
    app.parseAttachmentSource(computed) ||
    app.parseAttachmentSource(display)
  );
}

function ensureAttachmentContentOverlay(app) {
  if (app.attachmentContentOverlay) return app.attachmentContentOverlay;
  var overlay = document.createElement('div');
  overlay.className = 'attachment-content-overlay';
  overlay.style.display = 'none';
  overlay.innerHTML =
    "<div class='attachment-content-panel'>" +
    "<div class='attachment-content-header'>" +
    "<div class='attachment-content-title'></div>" +
    "<button type='button' class='attachment-content-close' title='Close'>✕</button>" +
    '</div>' +
    "<pre class='attachment-content-body'></pre>" +
    '</div>';
  document.body.appendChild(overlay);
  app.attachmentContentOverlay = overlay;
  app.attachmentContentTitle = overlay.querySelector('.attachment-content-title');
  app.attachmentContentBody = overlay.querySelector('.attachment-content-body');
  overlay.addEventListener('click', (event) => {
    if (
      event.target === overlay ||
      (event.target.closest && event.target.closest('.attachment-content-close'))
    ) {
      hideAttachmentContentOverlay(app);
    }
  });
  app.handleAttachmentContentOverlayKeydown = (event) => {
    if (event.key !== 'Escape') return;
    if (
      !app.attachmentContentOverlay ||
      app.attachmentContentOverlay.style.display === 'none'
    )
      return;
    event.preventDefault();
    hideAttachmentContentOverlay(app);
  };
  document.addEventListener('keydown', app.handleAttachmentContentOverlayKeydown);
  return overlay;
}

export function hideAttachmentContentOverlay(app) {
  if (!app || !app.attachmentContentOverlay) return;
  app.attachmentContentOverlay.style.display = 'none';
  if (app.attachmentContentTitle) app.attachmentContentTitle.textContent = '';
  if (app.attachmentContentBody) app.attachmentContentBody.textContent = '';
}

async function loadAttachmentContentText(attachment) {
  var source = attachment && typeof attachment === 'object' ? attachment : {};
  var inlineContent = String(source.content || '');
  if (inlineContent && String(source.encoding || 'utf8').toLowerCase() !== 'base64') {
    return inlineContent;
  }
  var artifactId = String(source.contentArtifactId || '').trim();
  if (!artifactId) return '';
  var artifact = await Meteor.callAsync('artifacts.get', artifactId);
  if (!artifact || String(artifact.kind || '') !== 'text') return '';
  return String(artifact.text || '');
}

export async function openAttachmentContentPreview(app, sheetId, cellId) {
  var attachment = resolveCellAttachment(app, sheetId, cellId);
  if (!attachment) return;
  var overlay = ensureAttachmentContentOverlay(app);
  var name = String(attachment.name || 'Attached file');
  if (app.attachmentContentTitle) app.attachmentContentTitle.textContent = name;
  if (app.attachmentContentBody) {
    app.attachmentContentBody.textContent = 'Loading...';
  }
  overlay.style.display = 'flex';
  try {
    var text = await loadAttachmentContentText(attachment);
    if (app.attachmentContentBody) {
      app.attachmentContentBody.textContent =
        text ||
        'No extracted text content is available for this attachment.';
    }
  } catch (error) {
    if (app.attachmentContentBody) {
      app.attachmentContentBody.textContent = String(
        (error && (error.reason || error.message)) ||
          'Failed to load extracted content',
      ).trim();
    }
  }
}

export function ensureFloatingAttachmentPreview(app) {
  if (app.floatingAttachmentPreview) return app.floatingAttachmentPreview;
  var el = document.createElement('div');
  el.className = 'floating-attachment-preview';
  el.style.display = 'none';
  document.body.appendChild(el);
  app.floatingAttachmentPreview = el;
  return el;
}

export function setupAttachmentLinkPreview(app) {
  app.handleAttachmentPreviewMouseOver = (event) => {
    var target =
      event && event.target && event.target.closest
        ? event.target.closest(
            '.embedded-attachment-link.has-preview .embedded-attachment-open[data-preview-url]',
          )
        : null;
    if (!target) return;
    if (app.attachmentPreviewTimer) clearTimeout(app.attachmentPreviewTimer);
    app.attachmentPreviewTimer = setTimeout(() => {
      app.attachmentPreviewTimer = null;
      showFloatingAttachmentPreview(app, target);
    }, 500);
  };

  app.handleAttachmentPreviewMouseOut = (event) => {
    var target =
      event && event.target && event.target.closest
        ? event.target.closest(
            '.embedded-attachment-link.has-preview .embedded-attachment-open[data-preview-url]',
          )
        : null;
    if (!target) return;
    var related = event.relatedTarget;
    if (related && target.contains && target.contains(related)) return;
    if (app.attachmentPreviewTimer) {
      clearTimeout(app.attachmentPreviewTimer);
      app.attachmentPreviewTimer = null;
    }
    if (app.attachmentPreviewAnchor === target) {
      hideFloatingAttachmentPreview(app);
    }
  };

  app.handleAttachmentPreviewScroll = () => {
    if (!app.attachmentPreviewAnchor) return;
    positionFloatingAttachmentPreview(app, app.attachmentPreviewAnchor);
  };

  document.addEventListener(
    'mouseover',
    app.handleAttachmentPreviewMouseOver,
    true,
  );
  document.addEventListener(
    'mouseout',
    app.handleAttachmentPreviewMouseOut,
    true,
  );
  window.addEventListener('scroll', app.handleAttachmentPreviewScroll, true);
  window.addEventListener('resize', app.handleAttachmentPreviewScroll, true);
}

export function showFloatingAttachmentPreview(app, anchor) {
  if (!anchor) return;
  var previewUrl = String(anchor.getAttribute('data-preview-url') || '');
  var previewKind = String(anchor.getAttribute('data-preview-kind') || '');
  var previewName = String(
    anchor.getAttribute('data-preview-name') || 'attachment',
  );
  if (!previewUrl || !previewKind) return;

  var popup = ensureFloatingAttachmentPreview(app);
  var safeName = app.grid.escapeHtml(previewName);
  var safeUrl = app.grid.escapeHtml(previewUrl);
  var media =
    previewKind === 'pdf'
      ? "<iframe src='" +
        safeUrl +
        "' title='" +
        safeName +
        "' loading='lazy'></iframe>"
      : "<img src='" + safeUrl + "' alt='" + safeName + "' />";

  popup.innerHTML =
    '' +
    "<div class='floating-attachment-preview-media'>" +
    media +
    '</div>' +
    "<div class='floating-attachment-preview-actions'>" +
    "<a class='embedded-attachment-open' href='" +
    safeUrl +
    "' target='_blank' rel='noopener noreferrer'>Open</a>" +
    "<a class='embedded-attachment-download' href='" +
    safeUrl +
    "' download='" +
    safeName +
    "'>Download</a>" +
    '</div>';
  popup.style.display = 'block';
  app.attachmentPreviewAnchor = anchor;
  positionFloatingAttachmentPreview(app, anchor);
}

export function positionFloatingAttachmentPreview(app, anchor) {
  if (
    !anchor ||
    !app.floatingAttachmentPreview ||
    app.floatingAttachmentPreview.style.display === 'none'
  )
    return;
  var rect = anchor.getBoundingClientRect();
  var popup = app.floatingAttachmentPreview;
  var popupWidth = popup.offsetWidth || 320;
  var popupHeight = popup.offsetHeight || 280;
  var left = rect.left + window.scrollX;
  var top = rect.top + window.scrollY - popupHeight - 10;

  if (left + popupWidth > window.scrollX + window.innerWidth - 12) {
    left = window.scrollX + window.innerWidth - popupWidth - 12;
  }
  if (left < window.scrollX + 12) left = window.scrollX + 12;
  if (top < window.scrollY + 12) {
    top = rect.bottom + window.scrollY + 10;
  }

  popup.style.left = Math.round(left) + 'px';
  popup.style.top = Math.round(top) + 'px';
}

export function hideFloatingAttachmentPreview(app) {
  app.attachmentPreviewAnchor = null;
  if (!app.floatingAttachmentPreview) return;
  app.floatingAttachmentPreview.style.display = 'none';
  app.floatingAttachmentPreview.innerHTML = '';
}

export function getVisibleAttachmentSheetId(app) {
  return getVisibleSheetId(app);
}
