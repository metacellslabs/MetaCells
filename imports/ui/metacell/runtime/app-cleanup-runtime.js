import { cleanupToolbarOffsetSync as cleanupToolbarOffsetSyncRuntime } from './toolbar-layout-runtime.js';
import { cleanupViewportRendering as cleanupViewportRenderingRuntime } from './viewport-render-runtime.js';

export function destroySpreadsheetAppRuntime(app) {
  app.syncServerEditLock(false);
  app.hideEditorOverlay();
  app.hideFloatingAttachmentPreview();
  cleanupAttachmentPreviewRuntime(app);
  cleanupEditorOverlayViewportRuntime(app);
  cleanupToolbarOffsetSyncRuntime(app);
  cleanupViewportRenderingRuntime(app);
  cleanupFloatingAttachmentPreviewNodeRuntime(app);
  cleanupAttachmentContentOverlayRuntime(app);
}

function cleanupAttachmentPreviewRuntime(app) {
  if (app.attachmentPreviewTimer) {
    clearTimeout(app.attachmentPreviewTimer);
    app.attachmentPreviewTimer = null;
  }
  if (app.handleAttachmentPreviewMouseOver) {
    document.removeEventListener(
      'mouseover',
      app.handleAttachmentPreviewMouseOver,
      true,
    );
  }
  if (app.handleAttachmentPreviewMouseOut) {
    document.removeEventListener(
      'mouseout',
      app.handleAttachmentPreviewMouseOut,
      true,
    );
  }
  if (app.handleAttachmentPreviewScroll) {
    window.removeEventListener(
      'scroll',
      app.handleAttachmentPreviewScroll,
      true,
    );
    window.removeEventListener(
      'resize',
      app.handleAttachmentPreviewScroll,
      true,
    );
  }
}

function cleanupEditorOverlayViewportRuntime(app) {
  if (app.handleEditorOverlayViewportSync) {
    if (app.tableWrap) {
      app.tableWrap.removeEventListener(
        'scroll',
        app.handleEditorOverlayViewportSync,
      );
    }
    window.removeEventListener('resize', app.handleEditorOverlayViewportSync);
  }
}

function cleanupFloatingAttachmentPreviewNodeRuntime(app) {
  if (
    app.floatingAttachmentPreview &&
    app.floatingAttachmentPreview.parentNode
  ) {
    app.floatingAttachmentPreview.parentNode.removeChild(
      app.floatingAttachmentPreview,
    );
  }
  app.floatingAttachmentPreview = null;
}

function cleanupAttachmentContentOverlayRuntime(app) {
  if (app.handleAttachmentContentOverlayKeydown) {
    document.removeEventListener(
      'keydown',
      app.handleAttachmentContentOverlayKeydown,
    );
  }
  if (
    app.attachmentContentOverlay &&
    app.attachmentContentOverlay.parentNode
  ) {
    app.attachmentContentOverlay.parentNode.removeChild(
      app.attachmentContentOverlay,
    );
  }
  app.attachmentContentOverlay = null;
}
