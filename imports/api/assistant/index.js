import { Meteor } from 'meteor/meteor';
import { check, Match } from 'meteor/check';
import { Sheets } from '../sheets/index.js';
import {
  decodeWorkbookDocument,
} from '../sheets/workbook-codec.js';
import { WorkbookStorageAdapter } from '../../engine/workbook-storage-adapter.js';
import { StorageService } from '../../engine/storage-service.js';
import {
  hydrateWorkbookAttachmentArtifacts,
} from '../artifacts/index.js';
import {
  AssistantConversations,
  appendAssistantConversationUpload,
  buildAttachmentSourceFromAssistantUpload,
  createConversationMessage,
  getAssistantUploadById,
  getStoredConversationMessages,
  getStoredConversationUploads,
  hydrateAssistantUploadsForPrompt,
  isPlainObject,
  loadAssistantConversationDoc,
  removeAssistantConversationUpload,
  saveAssistantConversationMessages,
  serializeAssistantUpload,
  toPlainTextContent,
} from './assistant-conversation-runtime.js';
import {
  buildAssistantManifest,
  buildAssistantSystemPrompt,
  buildChannelPromptContext,
  buildConversationMessages,
  buildWorkbookPromptContext,
  compactUploadsForPrompt,
  compactWorkbookForPrompt,
  estimateAssistantMessageTokens,
} from './assistant-prompt-runtime.js';
import {
  buildAssistantToolsManifest,
  getRegisteredAssistantTools,
  registerAssistantTool,
  registerBuiltInAssistantTools,
  runAssistantTool,
} from './assistant-tools-runtime.js';
import {
  handleAssistantChat,
} from './assistant-chat-runtime.js';

async function sendAssistantChannelMessage(channelLabel, payload, channelId) {
  const sendByLabel =
    Meteor.server &&
    Meteor.server.method_handlers &&
    Meteor.server.method_handlers['channels.sendByLabel'];
  if (typeof sendByLabel === 'function') {
    return sendByLabel.apply({}, [channelLabel, payload]);
  }
  const sendChannel =
    Meteor.server &&
    Meteor.server.method_handlers &&
    Meteor.server.method_handlers['channels.send'];
  if (typeof sendChannel !== 'function') {
    throw new Error('Channel send method is unavailable');
  }
  return sendChannel.apply({}, [channelId, payload]);
}

async function searchAssistantChannel(channelLabel, payload, channelId) {
  const searchByLabel =
    Meteor.server &&
    Meteor.server.method_handlers &&
    Meteor.server.method_handlers['channels.searchByLabel'];
  if (typeof searchByLabel === 'function') {
    return searchByLabel.apply({}, [
      channelLabel,
      String((payload && payload.query) || ''),
      payload,
    ]);
  }
  const searchChannel =
    Meteor.server &&
    Meteor.server.method_handlers &&
    Meteor.server.method_handlers['channels.search'];
  if (typeof searchChannel !== 'function') {
    throw new Error('Channel search method is unavailable');
  }
  return searchChannel.apply({}, [
    channelId,
    String((payload && payload.query) || ''),
    payload,
  ]);
}

registerBuiltInAssistantTools({
  buildAttachmentSourceFromAssistantUpload,
  getAssistantUploadById,
  isPlainObject,
  serializeAssistantUpload,
});

if (Meteor.isServer) {
  Meteor.methods({
    async 'assistant.chat'(payload) {
      check(payload, Match.Where(isPlainObject));
      check(payload.sheetDocumentId, String);
      check(payload.message, String);
      const result = await handleAssistantChat(payload, {
        buildAssistantManifest,
        buildAssistantToolsManifest,
        getAssistantUploadById,
        isPlainObject,
        runAssistantTool,
        toPlainTextContent,
        sendAssistantChannelMessage,
        searchAssistantChannel,
      });
      await saveAssistantConversationMessages(
        payload.sheetDocumentId,
        Array.isArray(result && result.conversation) ? result.conversation : [],
        {
          lastMessageAt: new Date(),
        },
      );
      return result;
    },
    async 'assistant.getManifest'(sheetDocumentId, workbookSnapshot) {
      check(sheetDocumentId, String);
      const sheetDoc = await Sheets.findOneAsync(
        { _id: sheetDocumentId },
        { fields: { workbook: 1 } },
      );
      if (!sheetDoc) throw new Meteor.Error('not-found', 'Workbook not found');
      return buildAssistantManifest(
        sheetDocumentId,
        workbookSnapshot || sheetDoc.workbook || {},
        (channels) => buildAssistantToolsManifest(channels, isPlainObject),
      );
    },
    async 'assistant.getConversation'(sheetDocumentId) {
      check(sheetDocumentId, String);
      const sheetDoc = await Sheets.findOneAsync(
        { _id: sheetDocumentId },
        { fields: { _id: 1 } },
      );
      if (!sheetDoc) throw new Meteor.Error('not-found', 'Workbook not found');
      const doc = await loadAssistantConversationDoc(sheetDocumentId);
      return {
        messages:
          Array.isArray(doc && doc.messages) ? doc.messages.slice() : [],
        uploads: Array.isArray(doc && doc.uploads)
          ? doc.uploads.map((item) => serializeAssistantUpload(item, false))
          : [],
        updatedAt:
          doc && doc.updatedAt instanceof Date
            ? doc.updatedAt.toISOString()
            : String((doc && doc.updatedAt) || ''),
      };
    },
    async 'assistant.uploadFile'(sheetDocumentId, fileName, mimeType, base64Data) {
      check(sheetDocumentId, String);
      check(fileName, String);
      check(mimeType, String);
      check(base64Data, String);
      const sheetDoc = await Sheets.findOneAsync(
        { _id: sheetDocumentId },
        { fields: { _id: 1 } },
      );
      if (!sheetDoc) throw new Meteor.Error('not-found', 'Workbook not found');
      const extractContent =
        Meteor.server &&
        Meteor.server.method_handlers &&
        Meteor.server.method_handlers['files.extractContent'];
      if (typeof extractContent !== 'function') {
        throw new Meteor.Error(
          'files-unavailable',
          'File extraction method is unavailable',
        );
      }
      const extracted = await extractContent.apply({}, [
        fileName,
        mimeType,
        base64Data,
      ]);
      const upload = await appendAssistantConversationUpload(sheetDocumentId, {
        id:
          'assistant-upload-' +
          Date.now() +
          '-' +
          Math.random().toString(36).slice(2, 10),
        name: String((extracted && extracted.name) || fileName || 'Attached file'),
        type: String((extracted && extracted.type) || mimeType || ''),
        contentArtifactId: String(
          (extracted && extracted.contentArtifactId) || '',
        ),
        binaryArtifactId: String(
          (extracted && extracted.binaryArtifactId) || '',
        ),
        downloadUrl: String((extracted && extracted.downloadUrl) || ''),
        previewUrl: String((extracted && extracted.previewUrl) || ''),
        createdAt: new Date().toISOString(),
      });
      return serializeAssistantUpload(upload, false);
    },
    async 'assistant.clearConversation'(sheetDocumentId) {
      check(sheetDocumentId, String);
      await AssistantConversations.removeAsync({
        sheetDocumentId: String(sheetDocumentId || ''),
      });
      return { ok: true };
    },
    async 'assistant.removeUpload'(sheetDocumentId, uploadId) {
      check(sheetDocumentId, String);
      check(uploadId, String);
      const uploads = await removeAssistantConversationUpload(
        sheetDocumentId,
        uploadId,
      );
      return {
        ok: true,
        uploads: uploads.map((item) => serializeAssistantUpload(item, false)),
      };
    },
  });
}
