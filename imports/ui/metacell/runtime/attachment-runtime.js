export {
  ensureFloatingAttachmentPreview,
  getVisibleAttachmentSheetId,
  hideAttachmentContentOverlay,
  hideFloatingAttachmentPreview,
  openAttachmentContentPreview,
  positionFloatingAttachmentPreview,
  setupAttachmentLinkPreview,
  showFloatingAttachmentPreview,
} from './attachment-preview-runtime.js';

export {
  setupChannelBindingControls as setupAttachmentChannelBindingControls,
  syncChannelBindingControl,
} from './attachment-channel-binding-runtime.js';

export {
  arrayBufferToBase64,
  readAttachedFileContent,
  setupAttachmentUploadControls,
} from './attachment-upload-runtime.js';

import { setupChannelBindingControls } from './attachment-channel-binding-runtime.js';
import { setupAttachmentUploadControls } from './attachment-upload-runtime.js';

export function setupAttachmentControls(app) {
  setupAttachmentUploadControls(app);
  setupChannelBindingControls(app);
}
