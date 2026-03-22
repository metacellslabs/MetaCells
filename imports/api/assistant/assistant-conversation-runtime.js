import { Mongo } from 'meteor/mongo';
import {
  buildAttachmentSourceValue,
  getArtifactText,
} from '../artifacts/index.js';

export const AssistantConversations = new Mongo.Collection(
  'assistant_conversations',
);

export function isPlainObject(value) {
  return !!value && typeof value === 'object' && !Array.isArray(value);
}

export function createConversationMessage(role, content, extraFields) {
  const now = new Date();
  return {
    id:
      'assistant-msg-' +
      now.getTime() +
      '-' +
      Math.random().toString(36).slice(2, 10),
    role: String(role || 'assistant'),
    content: String(content == null ? '' : content),
    createdAt: now.toISOString(),
    ...(isPlainObject(extraFields) ? extraFields : {}),
  };
}

export async function loadAssistantConversationDoc(sheetDocumentId) {
  return (
    (await AssistantConversations.findOneAsync({
      sheetDocumentId: String(sheetDocumentId || ''),
    })) || null
  );
}

export async function getStoredConversationMessages(sheetDocumentId) {
  const doc = await loadAssistantConversationDoc(sheetDocumentId);
  return Array.isArray(doc && doc.messages) ? doc.messages.slice() : [];
}

export async function getStoredConversationUploads(sheetDocumentId) {
  const doc = await loadAssistantConversationDoc(sheetDocumentId);
  return Array.isArray(doc && doc.uploads) ? doc.uploads.slice() : [];
}

export async function saveAssistantConversationMessages(
  sheetDocumentId,
  messages,
  extraFields,
) {
  const now = new Date();
  const current = await loadAssistantConversationDoc(sheetDocumentId);
  const nextMessages = Array.isArray(messages) ? messages.slice() : [];
  if (current && current._id) {
    await AssistantConversations.updateAsync(
      { _id: current._id },
      {
        $set: {
          sheetDocumentId: String(sheetDocumentId || ''),
          messages: nextMessages,
          updatedAt: now,
          ...(isPlainObject(extraFields) ? extraFields : {}),
        },
      },
    );
    return current._id;
  }
  return AssistantConversations.insertAsync({
    sheetDocumentId: String(sheetDocumentId || ''),
    messages: nextMessages,
    createdAt: now,
    updatedAt: now,
    ...(isPlainObject(extraFields) ? extraFields : {}),
  });
}

export function serializeAssistantUpload(upload, includeContent) {
  const source = isPlainObject(upload) ? upload : {};
  const next = {
    id: String(source.id || ''),
    name: String(source.name || ''),
    type: String(source.type || ''),
    contentArtifactId: String(source.contentArtifactId || ''),
    binaryArtifactId: String(source.binaryArtifactId || ''),
    downloadUrl: String(source.downloadUrl || ''),
    previewUrl: String(source.previewUrl || ''),
    createdAt: String(source.createdAt || ''),
  };
  if (includeContent) {
    next.content = String(source.content || '');
  }
  return next;
}

export async function hydrateAssistantUploadsForPrompt(uploads) {
  const source = Array.isArray(uploads) ? uploads : [];
  const hydrated = [];
  for (let i = 0; i < source.length; i += 1) {
    const upload = isPlainObject(source[i]) ? source[i] : null;
    if (!upload) continue;
    const content =
      upload.contentArtifactId && !upload.content
        ? await getArtifactText(String(upload.contentArtifactId || ''))
        : String(upload.content || '');
    hydrated.push(
      serializeAssistantUpload(
        {
          ...upload,
          content,
        },
        true,
      ),
    );
  }
  return hydrated;
}

export async function saveAssistantConversationUploads(sheetDocumentId, uploads) {
  const now = new Date();
  const current = await loadAssistantConversationDoc(sheetDocumentId);
  const nextUploads = Array.isArray(uploads) ? uploads.slice() : [];
  if (current && current._id) {
    await AssistantConversations.updateAsync(
      { _id: current._id },
      {
        $set: {
          sheetDocumentId: String(sheetDocumentId || ''),
          uploads: nextUploads,
          updatedAt: now,
        },
      },
    );
    return current._id;
  }
  return AssistantConversations.insertAsync({
    sheetDocumentId: String(sheetDocumentId || ''),
    messages: [],
    uploads: nextUploads,
    createdAt: now,
    updatedAt: now,
  });
}

export async function appendAssistantConversationUpload(sheetDocumentId, upload) {
  const current = await getStoredConversationUploads(sheetDocumentId);
  const source = isPlainObject(upload) ? upload : {};
  const uploadId =
    String(source.id || '').trim() ||
    'assistant-upload-' +
      Date.now() +
      '-' +
      Math.random().toString(36).slice(2, 10);
  const nextUpload = {
    id: uploadId,
    name: String(source.name || ''),
    type: String(source.type || ''),
    contentArtifactId: String(source.contentArtifactId || ''),
    binaryArtifactId: String(source.binaryArtifactId || ''),
    downloadUrl: String(source.downloadUrl || ''),
    previewUrl: String(source.previewUrl || ''),
    createdAt: String(source.createdAt || new Date().toISOString()),
  };
  const deduped = current.filter((item) => String(item && item.id) !== uploadId);
  deduped.push(nextUpload);
  await saveAssistantConversationUploads(sheetDocumentId, deduped);
  return nextUpload;
}

export async function removeAssistantConversationUpload(sheetDocumentId, uploadId) {
  const current = await getStoredConversationUploads(sheetDocumentId);
  const nextUploads = current.filter(
    (item) => String(item && item.id) !== String(uploadId || ''),
  );
  await saveAssistantConversationUploads(sheetDocumentId, nextUploads);
  return nextUploads;
}

export function buildAttachmentSourceFromAssistantUpload(upload) {
  if (!upload) {
    throw new Error('Assistant upload not found');
  }
  return buildAttachmentSourceValue({
    name: String(upload.name || 'Attached file'),
    type: String(upload.type || ''),
    content: '',
    contentArtifactId: String(upload.contentArtifactId || ''),
    binaryArtifactId: String(upload.binaryArtifactId || ''),
    downloadUrl: String(upload.downloadUrl || ''),
    previewUrl: String(upload.previewUrl || ''),
    pending: false,
  });
}

export async function getAssistantUploadById(sheetDocumentId, uploadId) {
  const uploads = await getStoredConversationUploads(sheetDocumentId);
  return (
    uploads.find((item) => item && String(item.id || '') === String(uploadId || '')) ||
    null
  );
}

export function toPlainTextContent(content) {
  if (Array.isArray(content)) {
    return content
      .map((part) =>
        typeof part === 'string'
          ? part
          : part && typeof part === 'object'
            ? String(part.text || '')
            : '',
      )
      .join('\n\n')
      .trim();
  }
  return String(content == null ? '' : content);
}
