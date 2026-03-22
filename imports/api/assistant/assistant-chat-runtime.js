import { Meteor } from 'meteor/meteor';
import { Sheets } from '../sheets/index.js';
import { decodeWorkbookDocument } from '../sheets/workbook-codec.js';
import { WorkbookStorageAdapter } from '../../engine/workbook-storage-adapter.js';
import { StorageService } from '../../engine/storage-service.js';
import { getActiveAIProvider } from '../settings/index.js';
import { hydrateWorkbookAttachmentArtifacts } from '../artifacts/index.js';
import {
  buildConversationMessages,
  buildAssistantSystemPrompt,
  buildChannelPromptContext,
  buildWorkbookPromptContext,
  compactUploadsForPrompt,
  compactWorkbookForPrompt,
  estimateAssistantMessageTokens,
} from './assistant-prompt-runtime.js';
import {
  createConversationMessage,
  getStoredConversationMessages,
  getStoredConversationUploads,
  hydrateAssistantUploadsForPrompt,
  serializeAssistantUpload,
} from './assistant-conversation-runtime.js';

export async function callProviderChat(messages, toPlainTextContent) {
  const provider = await getActiveAIProvider();
  const model = String(
    provider && provider.model
      ? provider.model
      : provider && provider.type === 'openai'
        ? 'gpt-4.1-mini'
        : 'deepseek-chat',
  );
  const requestBaseUrl = String(provider.baseUrl || '').replace(/\/+$/, '');
  const requestHeaders = { 'Content-Type': 'application/json' };
  if (
    (provider.type === 'deepseek' || provider.type === 'openai') &&
    provider.apiKey
  ) {
    requestHeaders.Authorization = `Bearer ${provider.apiKey}`;
  }
  const response = await fetch(`${requestBaseUrl}/chat/completions`, {
    method: 'POST',
    headers: requestHeaders,
    body: JSON.stringify({
      model,
      messages: Array.isArray(messages)
        ? messages.map((message) => ({
            role: String(message.role || 'user'),
            content: toPlainTextContent(message.content),
          }))
        : [],
    }),
  });
  if (!response.ok) {
    const errorText = String(await response.text()).trim();
    throw new Error(
      `Assistant chat failed with HTTP ${response.status}${
        errorText ? `: ${errorText}` : ''
      }`,
    );
  }
  const data = await response.json();
  const message =
    data && data.choices && data.choices[0] && data.choices[0].message;
  return toPlainTextContent(message && message.content);
}

export function parseAssistantEnvelope(text) {
  const raw = String(text || '').trim();
  if (!raw) return { message: '', toolCalls: [] };
  const match = raw.match(/\{[\s\S]*\}/);
  if (!match) return { message: raw, toolCalls: [] };
  try {
    const parsed = JSON.parse(match[0]);
    return {
      message: String((parsed && parsed.message) || '').trim(),
      toolCalls: Array.isArray(parsed && parsed.toolCalls)
        ? parsed.toolCalls
        : [],
    };
  } catch (_error) {
    return { message: raw, toolCalls: [] };
  }
}

export async function persistAssistantWorkbook(sheetDocumentId, workbook) {
  const saveWorkbook =
    Meteor.server &&
    Meteor.server.method_handlers &&
    Meteor.server.method_handlers['sheets.saveWorkbook'];
  const computeGrid =
    Meteor.server &&
    Meteor.server.method_handlers &&
    Meteor.server.method_handlers['sheets.computeGrid'];
  if (typeof saveWorkbook !== 'function' || typeof computeGrid !== 'function') {
    throw new Error('Workbook persistence methods are unavailable');
  }
  await saveWorkbook.apply({}, [sheetDocumentId, workbook]);
  const activeTabId = String(workbook.activeTabId || '') || 'sheet-1';
  const result = await computeGrid.apply({}, [
    sheetDocumentId,
    activeTabId,
    { workbookSnapshot: workbook, forceRefreshAI: false, manualTriggerAI: false },
  ]);
  return result && result.workbook ? decodeWorkbookDocument(result.workbook) : decodeWorkbookDocument(workbook);
}

export async function handleAssistantChat(
  { sheetDocumentId, workbookSnapshot, message },
  deps,
) {
  const {
    buildAssistantManifest,
    buildAssistantToolsManifest,
    getAssistantUploadById,
    isPlainObject,
    runAssistantTool,
    toPlainTextContent,
    sendAssistantChannelMessage,
    searchAssistantChannel,
  } = deps;
  const sheetId = String(sheetDocumentId || '').trim();
  if (!sheetId) throw new Error('Assistant chat requires sheetDocumentId');
  const sheetDoc = await Sheets.findOneAsync({ _id: sheetId }, { fields: { workbook: 1 } });
  if (!sheetDoc) throw new Meteor.Error('not-found', 'Workbook not found');
  let workbook = await hydrateWorkbookAttachmentArtifacts(
    decodeWorkbookDocument(workbookSnapshot || sheetDoc.workbook || {}),
  );
  const persistedConversation = await getStoredConversationMessages(sheetId);
  const persistedUploads = await getStoredConversationUploads(sheetId);
  const promptUploads = await hydrateAssistantUploadsForPrompt(persistedUploads);
  const manifest = await buildAssistantManifest(
    sheetId,
    workbook,
    (channels) => buildAssistantToolsManifest(channels, isPlainObject),
  );
  const systemPrompt = buildAssistantSystemPrompt(manifest);
  const userTurn = createConversationMessage('user', String(message || ''));
  const conversation = persistedConversation.concat(userTurn);
  let messages = buildConversationMessages(
    systemPrompt,
    conversation,
    manifest,
    workbook,
    message,
    promptUploads,
  );
  const activity = [];
  let workbookMutated = false;
  let assistantMessage = '';

  for (let iteration = 0; iteration < 4; iteration += 1) {
    const responseText = await callProviderChat(messages, toPlainTextContent);
    const envelope = parseAssistantEnvelope(responseText);
    assistantMessage = envelope.message || assistantMessage;
    if (!Array.isArray(envelope.toolCalls) || !envelope.toolCalls.length) {
      break;
    }

    const adapter = new WorkbookStorageAdapter(workbook);
    const storage = new StorageService(adapter);
    const mutationLog = [];
    const context = {
      manifest,
      storage,
      getWorkbook: () => adapter.snapshot(),
      getUpload: (uploadId) => getAssistantUploadById(sheetId, uploadId),
      markMutated: (kind, details) => {
        workbookMutated = true;
        mutationLog.push({
          kind: String(kind || ''),
          details: isPlainObject(details) ? details : {},
        });
      },
      isPlainObject,
      sendAssistantChannelMessage,
      searchAssistantChannel,
    };

    const toolResults = [];
    for (let i = 0; i < envelope.toolCalls.length; i += 1) {
      const toolCall = envelope.toolCalls[i];
      try {
        const result = await runAssistantTool(toolCall, context);
        toolResults.push({
          name: String(toolCall && toolCall.name ? toolCall.name : ''),
          ok: true,
          result,
        });
      } catch (error) {
        toolResults.push({
          name: String(toolCall && toolCall.name ? toolCall.name : ''),
          ok: false,
          error: error && error.message ? error.message : String(error),
        });
      }
    }

    if (mutationLog.length) {
      workbook = await persistAssistantWorkbook(sheetId, adapter.snapshot());
      workbook = await hydrateWorkbookAttachmentArtifacts(workbook);
    } else {
      workbook = adapter.snapshot();
    }

    activity.push({
      assistantMessage: envelope.message || '',
      toolResults,
      mutations: mutationLog,
    });

    messages.push({
      role: 'assistant',
      content: JSON.stringify({
        message: envelope.message || '',
        toolCalls: envelope.toolCalls,
      }),
    });
    messages.push({
      role: 'user',
      content: JSON.stringify({
        message:
          'Tool results for the previous assistant action. Use these results to continue, summarize, or issue the next tool calls if needed.',
        workbook: compactWorkbookForPrompt(workbook),
        workbookContext: buildWorkbookPromptContext(workbook),
        channelContext: buildChannelPromptContext(manifest),
        chatFiles: compactUploadsForPrompt(promptUploads),
        toolResults,
      }),
    });
    while (
      messages.length > 2 &&
      estimateAssistantMessageTokens(messages) > 100000
    ) {
      messages.splice(1, 1);
    }
  }

  return {
    message: assistantMessage,
    workbook,
    manifest,
    activity,
    workbookMutated,
    uploads: persistedUploads.map((item) => serializeAssistantUpload(item, false)),
    conversation: conversation.concat(
      assistantMessage
        ? [createConversationMessage('assistant', assistantMessage)]
        : [],
    ),
  };
}
